/**
 * N-Guard — CleanCoreAnalyzer (Phase 9)
 *
 * Evaluates a proposed implementation approach against the versioned
 * Clean Core rule catalog. Produces a structured CleanCoreAnalysisResult.
 *
 * Architecture rules:
 *  - Rule 2:  Technique applicability is edition-specific.
 *  - Rule 5:  Analyzer recommends — never auto-rejects.
 *             CLASSIC_CUSTOM in Cloud Public → routes to human review, not rejection.
 *  - Rule 12: Rules are from the versioned catalog — not buried in prompts.
 *
 * The analyzer is deterministic: same inputs always produce the same outputs.
 * No LLM calls are made here (LLM analysis happens in FitAssessmentEngine).
 */

import { randomUUID } from 'node:crypto';
import { DEFAULT_CATALOG, getRulesForEdition, getRuleForTechnique } from './catalog.js';
import type {
  CleanCoreAnalysisInput,
  CleanCoreAnalysisResult,
  CleanCoreCatalog,
  CleanCoreRule,
  CleanCoreRisk,
  CleanCoreTier,
  ExtensibilityTechnique,
  TechniqueApplicability,
} from './types.js';
import { TECHNIQUE_TIER } from './types.js';
import type { S4Edition } from '../types/index.js';

const SCHEMA_VERSION = '1.0';

// ── Technique classification keywords ─────────────────────────────────────────
// Used to infer the proposed technique from the description when not explicit.

const TECHNIQUE_KEYWORDS: Array<{ keywords: string[]; technique: ExtensibilityTechnique }> = [
  { keywords: ['btp', 'side-by-side', 'cap app', 'extension app', 'event mesh', 'odata api'],
    technique: 'BTP_SIDE_BY_SIDE' },
  { keywords: ['z-class', 'z class', 'y-class', 'z report', 'abap program', 'custom code',
               'modification', 'user exit', 'classic enhancement', 'implicit enhancement', 'source code'],
    technique: 'CLASSIC_CUSTOM' },
  { keywords: ['badi', 'enhancement spot', 'append structure', 'developer extensibility',
               'abap extension', 'se18', 'se19'],
    technique: 'DEVELOPER_EXTENSIBILITY' },
  { keywords: ['key user', 'key-user', 'custom field', 'custom business object', 'cbo',
               'adaptation transport', 'ato', 'in-app extension', 'fiori adaptation'],
    technique: 'KEY_USER_EXTENSIBILITY' },
  { keywords: ['customizing', 'img', 'spro', 'configuration', 'table entry', 'number range',
               'output type', 'message class', 'standard config'],
    technique: 'CONFIGURATION' },
];

// ── Analyzer ──────────────────────────────────────────────────────────────────

export class CleanCoreAnalyzer {
  private readonly catalog: CleanCoreCatalog;

  constructor(catalog?: CleanCoreCatalog) {
    this.catalog = catalog ?? DEFAULT_CATALOG;
  }

  /**
   * Analyze a proposed approach against the Clean Core rule catalog.
   * Returns a structured, edition-aware CleanCoreAnalysisResult.
   * NEVER throws.
   */
  analyze(input: CleanCoreAnalysisInput): CleanCoreAnalysisResult {
    const analysisId = randomUUID();
    const { edition, release } = input;

    // Step 1: Get all rules applicable to this edition
    const applicableRules = getRulesForEdition(this.catalog, edition, release);

    // Step 2: Build per-technique applicability matrix
    const techniqueApplicability = this._buildApplicabilityMatrix(edition, release);

    // Step 3: Infer the proposed technique from the description
    const proposedTechnique = this._inferTechnique(input);

    // Step 4: Get the rule for the proposed technique
    const proposedRule = applicableRules.find(r => r.technique === proposedTechnique);

    // Step 5: Determine if the technique is applicable at all for this edition
    const isApplicable = !!proposedRule;

    // Step 6: If not applicable, override to the safest available technique
    const effectiveTechnique = isApplicable
      ? proposedTechnique
      : this._findSafestAlternative(input, applicableRules, proposedTechnique);

    const effectiveRule = applicableRules.find(r => r.technique === effectiveTechnique)
      ?? this._buildFallbackRule(edition, effectiveTechnique);

    // Step 7: Build concerns list
    const concerns: string[] = [];
    const riskFactors: string[] = [];

    if (!isApplicable) {
      concerns.push(
        `${proposedTechnique.replace(/_/g, ' ')} is NOT applicable for SAP S/4HANA ${editionLabel(edition)}.`,
      );
      riskFactors.push(
        `Using this technique on ${editionLabel(edition)} would create an unsupported customization.`,
      );
    }

    if (effectiveRule.constraints.length > 0) {
      concerns.push(...effectiveRule.constraints.slice(0, 3));
    }

    // F6/F7 from assessment → additional risk factors
    if (input.fitClassification === 'F6') {
      riskFactors.push('Assessment classified this requirement as F6 — Potential Customization Risk.');
    }
    if (input.fitClassification === 'F7') {
      riskFactors.push('Assessment classified this requirement as F7 — Legitimate Business Differentiator; exception may be warranted.');
    }
    if (input.fitClassification === 'F8') {
      concerns.push('Insufficient evidence from the fit assessment — Clean Core technique selection may need SME review.');
    }

    // Policy enforcement
    const policy = input.cleanCorePolicy;
    if (policy === 'STRICT' && effectiveRule.tier !== 'TIER_1') {
      riskFactors.push(`Project Clean Core Policy is STRICT — only Tier 1 techniques are permitted without exception. Proposed technique is ${effectiveRule.tier}.`);
    }

    // Step 8: Build unknowns
    const unknowns: string[] = [];
    if (!input.gapDescription) {
      unknowns.push('Gap description not available — verify whether SAP standard truly cannot cover the requirement.');
    }
    if (effectiveRule.tier === 'TIER_3' || effectiveRule.tier === 'TIER_4') {
      unknowns.push('Confirm that all lower-tier alternatives have been evaluated and rejected with documented rationale.');
    }
    if (effectiveTechnique === 'BTP_SIDE_BY_SIDE') {
      unknowns.push('Verify that the required SAP API is released, stable, and available on the target system.');
    }

    // Step 9: Determine safer alternative
    const saferAlternative = this._findSaferAlternative(effectiveTechnique, applicableRules);

    return {
      analysisId,
      schemaVersion              : SCHEMA_VERSION,
      preferredTechnique         : effectiveTechnique,
      cleanCoreTier              : effectiveRule.tier,
      riskLevel                  : this._escalateRiskIfNeeded(effectiveRule.riskLevel, input, effectiveRule.tier),
      concerns,
      riskFactors,
      requiredArchitectureReview : effectiveRule.requiresArchitectureReview || riskFactors.length > 0,
      requiresException          : effectiveRule.requiresException,
      saferAlternative,
      unknowns,
      appliedRules               : applicableRules,
      techniqueApplicability,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _inferTechnique(input: CleanCoreAnalysisInput): ExtensibilityTechnique {
    const text = [
      input.proposedApproach,
      input.gapDescription ?? '',
      input.businessIntent ?? '',
    ].join(' ').toLowerCase();

    for (const { keywords, technique } of TECHNIQUE_KEYWORDS) {
      if (keywords.some(kw => text.includes(kw))) return technique;
    }

    // Map from fit classification to likely technique
    const fcMap: Record<string, ExtensibilityTechnique> = {
      F1: 'STANDARD_ADOPTION',
      F2: 'CONFIGURATION',
      F3: 'KEY_USER_EXTENSIBILITY',
      F4: 'BTP_SIDE_BY_SIDE',
      F5: 'CONFIGURATION',
      F6: 'DEVELOPER_EXTENSIBILITY',
      F7: 'CLASSIC_CUSTOM',
      F8: 'KEY_USER_EXTENSIBILITY',  // safest fallback
    };

    return fcMap[input.fitClassification ?? 'F8'] ?? 'KEY_USER_EXTENSIBILITY';
  }

  private _findSafestAlternative(
    input          : CleanCoreAnalysisInput,
    applicableRules: CleanCoreRule[],
    _proposed      : ExtensibilityTechnique,
  ): ExtensibilityTechnique {
    // Ordered from safest to least safe
    const preference: ExtensibilityTechnique[] = [
      'STANDARD_ADOPTION',
      'CONFIGURATION',
      'KEY_USER_EXTENSIBILITY',
      'BTP_SIDE_BY_SIDE',
      'DEVELOPER_EXTENSIBILITY',
    ];
    void input;
    for (const t of preference) {
      if (applicableRules.some(r => r.technique === t)) return t;
    }
    return 'KEY_USER_EXTENSIBILITY';
  }

  private _findSaferAlternative(
    current        : ExtensibilityTechnique,
    applicableRules: CleanCoreRule[],
  ): ExtensibilityTechnique | undefined {
    const rule = applicableRules.find(r => r.technique === current);
    if (!rule || rule.alternatives.length === 0) return undefined;
    // Return the first alternative that is applicable in this edition
    for (const alt of rule.alternatives) {
      if (applicableRules.some(r => r.technique === alt)) return alt;
    }
    return undefined;
  }

  private _buildApplicabilityMatrix(
    edition : S4Edition,
    release?: string,
  ): TechniqueApplicability[] {
    const techniques: ExtensibilityTechnique[] = [
      'STANDARD_ADOPTION',
      'CONFIGURATION',
      'KEY_USER_EXTENSIBILITY',
      'DEVELOPER_EXTENSIBILITY',
      'BTP_SIDE_BY_SIDE',
      'CLASSIC_CUSTOM',
    ];

    return techniques.map(technique => {
      const rule = getRuleForTechnique(this.catalog, technique, edition, release);
      if (rule) {
        return {
          technique,
          edition,
          applicable : true,
          tier       : rule.tier,
          riskLevel  : rule.riskLevel,
        };
      }
      // Not applicable — determine why
      const anyRule = this.catalog.rules.find(r => r.technique === technique);
      return {
        technique,
        edition,
        applicable : false,
        tier       : anyRule?.tier ?? TECHNIQUE_TIER[technique],
        riskLevel  : 'CRITICAL' as CleanCoreRisk,
        notes      : `${technique.replace(/_/g, ' ')} is not applicable for ${editionLabel(edition)}.`,
      };
    });
  }

  private _buildFallbackRule(edition: S4Edition, technique: ExtensibilityTechnique): CleanCoreRule {
    return {
      id                        : 'cc-fallback',
      catalogVersion            : this.catalog.version,
      technique,
      tier                      : TECHNIQUE_TIER[technique],
      applicableEditions        : [edition],
      riskLevel                 : 'MEDIUM',
      requiresArchitectureReview: true,
      requiresException         : false,
      sapRecommendation         : `Use ${technique.replace(/_/g, ' ')} with documented governance.`,
      evidenceBasis             : 'N-Guard fallback rule',
      safeguards                : ['Obtain architecture board approval.'],
      alternatives              : ['KEY_USER_EXTENSIBILITY', 'BTP_SIDE_BY_SIDE'],
      constraints               : [],
    };
  }

  private _escalateRiskIfNeeded(
    base  : CleanCoreRisk,
    input : CleanCoreAnalysisInput,
    tier  : CleanCoreTier,
  ): CleanCoreRisk {
    // Escalate only when STRICT policy applies to non-Tier-1 techniques.
    // Tier 1 (STANDARD_ADOPTION, CONFIGURATION) IS the STRICT goal — never escalate it.
    if (input.cleanCorePolicy === 'STRICT' &&
        tier !== 'TIER_1' &&
        (base === 'LOW' || base === 'MEDIUM')) {
      return 'HIGH';
    }
    return base;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function editionLabel(edition: S4Edition): string {
  const labels: Record<S4Edition, string> = {
    ON_PREMISE    : 'S/4HANA On-Premise',
    CLOUD_PRIVATE : 'S/4HANA Cloud Private Edition',
    CLOUD_PUBLIC  : 'S/4HANA Cloud Public Edition',
  };
  return labels[edition] ?? edition;
}

// Suppress unused import
void (TECHNIQUE_TIER as unknown);
