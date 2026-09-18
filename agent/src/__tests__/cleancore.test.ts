/**
 * N-Guard — Phase 9 Clean Core and Extensibility Governance Tests
 *
 * Tests cover:
 *  1. Catalog version and structure
 *  2. Edition-aware technique applicability (rule 2)
 *  3. Classic custom code NOT applicable in Cloud Public Edition
 *  4. Developer extensibility NOT applicable in Cloud Public Edition
 *  5. Key-user extensibility available in all three editions
 *  6. BTP side-by-side available in all three editions
 *  7. STRICT policy escalates risk level
 *  8. F6/F7 classifications add risk factors
 *  9. High-risk approaches route to human review (not auto-rejected)
 * 10. Safer alternative is provided for high-risk techniques
 * 11. Technique inference from keywords
 * 12. Analysis result structure is complete
 * 13. Analyzer never throws
 * 14. Tier 4 (CLASSIC_CUSTOM) always requires architecture review + exception
 */

import { describe, it, expect } from '@jest/globals';
import { CleanCoreAnalyzer }     from '../cleancore/CleanCoreAnalyzer.js';
import { DEFAULT_CATALOG, getRulesForEdition } from '../cleancore/catalog.js';
import type { CleanCoreAnalysisInput } from '../cleancore/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides?: Partial<CleanCoreAnalysisInput>): CleanCoreAnalysisInput {
  return {
    designRequestId  : 'dr-cc-001',
    projectId        : 'proj-cc-001',
    tenantId         : 'tenant-cc-001',
    edition          : 'CLOUD_PUBLIC',
    release          : '2024',
    cleanCorePolicy  : 'STANDARD',
    fitClassification: 'F6',
    proposedApproach : 'We need custom code to handle pricing.',
    businessIntent   : 'Custom pricing logic',
    ...overrides,
  };
}

const analyzer = new CleanCoreAnalyzer();

// ── 1. Catalog structure ──────────────────────────────────────────────────────

describe('DEFAULT_CATALOG', () => {
  it('catalog has version 1.0', () => {
    expect(DEFAULT_CATALOG.version).toBe('1.0');
  });

  it('catalog has exactly 6 rules (one per technique)', () => {
    expect(DEFAULT_CATALOG.rules).toHaveLength(6);
  });

  it('all rules have required fields', () => {
    for (const rule of DEFAULT_CATALOG.rules) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.technique.length).toBeGreaterThan(0);
      expect(rule.tier.length).toBeGreaterThan(0);
      expect(rule.applicableEditions.length).toBeGreaterThan(0);
      expect(rule.sapRecommendation.length).toBeGreaterThan(0);
    }
  });
});

// ── 2. Edition-aware applicability (rule 2) ───────────────────────────────────

describe('CleanCoreAnalyzer — edition-aware applicability (rule 2)', () => {
  it('Cloud Public Edition has fewer applicable techniques than On-Premise', () => {
    const pubRules = getRulesForEdition(DEFAULT_CATALOG, 'CLOUD_PUBLIC');
    const opRules  = getRulesForEdition(DEFAULT_CATALOG, 'ON_PREMISE');
    expect(pubRules.length).toBeLessThan(opRules.length);
  });

  it('Cloud Public Edition does NOT have CLASSIC_CUSTOM', () => {
    const rules = getRulesForEdition(DEFAULT_CATALOG, 'CLOUD_PUBLIC');
    const hasClassic = rules.some(r => r.technique === 'CLASSIC_CUSTOM');
    expect(hasClassic).toBe(false);
  });

  it('Cloud Public Edition does NOT have DEVELOPER_EXTENSIBILITY', () => {
    const rules = getRulesForEdition(DEFAULT_CATALOG, 'CLOUD_PUBLIC');
    const hasDev = rules.some(r => r.technique === 'DEVELOPER_EXTENSIBILITY');
    expect(hasDev).toBe(false);
  });

  it('On-Premise has DEVELOPER_EXTENSIBILITY', () => {
    const rules = getRulesForEdition(DEFAULT_CATALOG, 'ON_PREMISE');
    const hasDev = rules.some(r => r.technique === 'DEVELOPER_EXTENSIBILITY');
    expect(hasDev).toBe(true);
  });

  it('Cloud Private Edition has DEVELOPER_EXTENSIBILITY', () => {
    const rules = getRulesForEdition(DEFAULT_CATALOG, 'CLOUD_PRIVATE');
    const hasDev = rules.some(r => r.technique === 'DEVELOPER_EXTENSIBILITY');
    expect(hasDev).toBe(true);
  });

  it('On-Premise has CLASSIC_CUSTOM', () => {
    const rules = getRulesForEdition(DEFAULT_CATALOG, 'ON_PREMISE');
    const hasCc = rules.some(r => r.technique === 'CLASSIC_CUSTOM');
    expect(hasCc).toBe(true);
  });
});

// ── 3. Key-user and BTP availability ─────────────────────────────────────────

describe('CleanCoreAnalyzer — cross-edition techniques', () => {
  const editions = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'] as const;

  it('KEY_USER_EXTENSIBILITY is available in all three editions', () => {
    for (const ed of editions) {
      const rules = getRulesForEdition(DEFAULT_CATALOG, ed);
      expect(rules.some(r => r.technique === 'KEY_USER_EXTENSIBILITY')).toBe(true);
    }
  });

  it('BTP_SIDE_BY_SIDE is available in all three editions', () => {
    for (const ed of editions) {
      const rules = getRulesForEdition(DEFAULT_CATALOG, ed);
      expect(rules.some(r => r.technique === 'BTP_SIDE_BY_SIDE')).toBe(true);
    }
  });

  it('STANDARD_ADOPTION is available in all three editions', () => {
    for (const ed of editions) {
      const rules = getRulesForEdition(DEFAULT_CATALOG, ed);
      expect(rules.some(r => r.technique === 'STANDARD_ADOPTION')).toBe(true);
    }
  });

  it('CONFIGURATION is available in all three editions', () => {
    for (const ed of editions) {
      const rules = getRulesForEdition(DEFAULT_CATALOG, ed);
      expect(rules.some(r => r.technique === 'CONFIGURATION')).toBe(true);
    }
  });
});

// ── 4. Classic custom in Cloud Public → redirected + concern raised ───────────

describe('CleanCoreAnalyzer — CLASSIC_CUSTOM in Cloud Public (rule 5)', () => {
  it('CLASSIC_CUSTOM proposed for Cloud Public redirects to BTP_SIDE_BY_SIDE', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'We need z-class custom code for pricing.',
      fitClassification: 'F7',
    }));
    // Should NOT recommend CLASSIC_CUSTOM — not applicable in Cloud Public
    expect(result.preferredTechnique).not.toBe('CLASSIC_CUSTOM');
    expect(['BTP_SIDE_BY_SIDE', 'KEY_USER_EXTENSIBILITY', 'CONFIGURATION', 'STANDARD_ADOPTION'])
      .toContain(result.preferredTechnique);
  });

  it('Concern is raised when CLASSIC_CUSTOM is proposed for Cloud Public', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'We need z-class custom code.',
      fitClassification: 'F7',
    }));
    const allText = [...result.concerns, ...result.riskFactors].join(' ').toLowerCase();
    expect(allText).toMatch(/not applicable|classic_custom|unsupported/i);
  });

  it('requiredArchitectureReview is true when technique is not applicable', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Modification to SAP standard code',
      fitClassification: 'F7',
    }));
    expect(result.requiredArchitectureReview).toBe(true);
  });

  it('Analyzer never auto-rejects — always returns a recommendation', async () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Z report and ABAP modification',
      fitClassification: 'F7',
    }));
    // Must always have a preferred technique — never null/undefined
    expect(result.preferredTechnique).toBeDefined();
    expect(result.preferredTechnique.length).toBeGreaterThan(0);
  });
});

// ── 5. STRICT policy escalation ───────────────────────────────────────────────

describe('CleanCoreAnalyzer — STRICT policy (rule 5)', () => {
  it('STRICT policy escalates risk for Tier 2+ techniques', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'ON_PREMISE',
      cleanCorePolicy  : 'STRICT',
      proposedApproach : 'Use BAdI implementation for custom logic',
      fitClassification: 'F3',
    }));
    // BAdI → DEVELOPER_EXTENSIBILITY (Tier 3) → should be escalated under STRICT
    expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
  });

  it('STRICT policy adds risk factor warning', () => {
    const result = analyzer.analyze(makeInput({
      edition         : 'ON_PREMISE',
      cleanCorePolicy : 'STRICT',
      proposedApproach: 'Developer extensibility via enhancement spot',
      fitClassification: 'F3',
    }));
    const hasStrictWarning = result.riskFactors.some(f => f.includes('STRICT'));
    expect(hasStrictWarning).toBe(true);
  });

  it('STRICT + STANDARD_ADOPTION does NOT escalate risk', () => {
    const result = analyzer.analyze(makeInput({
      edition         : 'CLOUD_PUBLIC',
      cleanCorePolicy : 'STRICT',
      proposedApproach: 'Use standard SAP pricing conditions',
      fitClassification: 'F1',
    }));
    expect(result.riskLevel).toBe('LOW');
  });
});

// ── 6. F6/F7 risk factor injection ────────────────────────────────────────────

describe('CleanCoreAnalyzer — fit classification risk factors', () => {
  it('F6 assessment adds risk factor', () => {
    const result = analyzer.analyze(makeInput({ fitClassification: 'F6' }));
    const hasF6 = result.riskFactors.some(f => f.includes('F6'));
    expect(hasF6).toBe(true);
  });

  it('F7 assessment adds risk factor', () => {
    const result = analyzer.analyze(makeInput({
      fitClassification: 'F7',
      proposedApproach: 'Custom differentiator implementation',
    }));
    const hasF7 = result.riskFactors.some(f => f.includes('F7'));
    expect(hasF7).toBe(true);
  });

  it('F8 assessment adds concern about insufficient evidence', () => {
    const result = analyzer.analyze(makeInput({
      fitClassification: 'F8',
      proposedApproach: 'Unknown approach',
    }));
    const hasInsufficient = result.concerns.some(c => c.toLowerCase().includes('insufficient'));
    expect(hasInsufficient).toBe(true);
  });
});

// ── 7. Tier 4 governance ──────────────────────────────────────────────────────

describe('CleanCoreAnalyzer — Tier 4 governance', () => {
  it('CLASSIC_CUSTOM on On-Premise requires architecture review', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'ON_PREMISE',
      proposedApproach : 'Z class with custom logic',
      fitClassification: 'F7',
    }));
    expect(result.requiredArchitectureReview).toBe(true);
  });

  it('CLASSIC_CUSTOM on On-Premise requires exception', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'ON_PREMISE',
      proposedApproach : 'ABAP modification to standard SAP code',
      fitClassification: 'F7',
    }));
    expect(result.requiresException).toBe(true);
  });

  it('CLASSIC_CUSTOM risk is CRITICAL', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'ON_PREMISE',
      proposedApproach : 'Custom ABAP Z-report',
      fitClassification: 'F7',
    }));
    expect(result.riskLevel).toBe('CRITICAL');
  });
});

// ── 8. Safer alternative ──────────────────────────────────────────────────────

describe('CleanCoreAnalyzer — safer alternatives', () => {
  it('DEVELOPER_EXTENSIBILITY has a safer alternative (key-user or BTP)', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'ON_PREMISE',
      proposedApproach : 'Use BAdI implementation',
      fitClassification: 'F3',
    }));
    expect(result.saferAlternative).toBeDefined();
    expect(['KEY_USER_EXTENSIBILITY', 'BTP_SIDE_BY_SIDE', 'STANDARD_ADOPTION', 'CONFIGURATION'])
      .toContain(result.saferAlternative);
  });

  it('STANDARD_ADOPTION has no safer alternative (already safest)', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Use standard SAP pricing conditions',
      fitClassification: 'F1',
    }));
    // Standard adoption has no safer alternative
    expect(result.saferAlternative).toBeUndefined();
  });
});

// ── 9. Technique applicability matrix ────────────────────────────────────────

describe('CleanCoreAnalyzer — technique applicability matrix', () => {
  it('matrix has 6 entries (one per technique)', () => {
    const result = analyzer.analyze(makeInput());
    expect(result.techniqueApplicability).toHaveLength(6);
  });

  it('CLASSIC_CUSTOM is marked non-applicable in Cloud Public', () => {
    const result = analyzer.analyze(makeInput({ edition: 'CLOUD_PUBLIC' }));
    const ccEntry = result.techniqueApplicability.find(t => t.technique === 'CLASSIC_CUSTOM');
    expect(ccEntry?.applicable).toBe(false);
  });

  it('KEY_USER_EXTENSIBILITY is marked applicable in Cloud Public', () => {
    const result = analyzer.analyze(makeInput({ edition: 'CLOUD_PUBLIC' }));
    const kuEntry = result.techniqueApplicability.find(t => t.technique === 'KEY_USER_EXTENSIBILITY');
    expect(kuEntry?.applicable).toBe(true);
  });
});

// ── 10. Analyzer never throws ────────────────────────────────────────────────

describe('CleanCoreAnalyzer — fault tolerance', () => {
  it('analyzer.analyze() never throws', () => {
    // Should not throw with minimal input
    expect(() => analyzer.analyze({
      designRequestId  : 'x',
      projectId        : 'y',
      tenantId         : 'z',
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : '',
    })).not.toThrow();
  });

  it('empty proposedApproach falls back gracefully', () => {
    const result = analyzer.analyze(makeInput({ proposedApproach: '' }));
    expect(result.preferredTechnique).toBeDefined();
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it('result always has analysisId and schemaVersion', () => {
    const result = analyzer.analyze(makeInput());
    expect(result.analysisId.length).toBeGreaterThan(0);
    expect(result.schemaVersion).toBe('1.0');
  });
});

// ── 11. Keyword inference ─────────────────────────────────────────────────────

describe('CleanCoreAnalyzer — keyword inference', () => {
  it('"btp" keyword infers BTP_SIDE_BY_SIDE', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Build a BTP extension using CAP',
      fitClassification: 'F4',
    }));
    expect(result.preferredTechnique).toBe('BTP_SIDE_BY_SIDE');
  });

  it('"customizing" keyword infers CONFIGURATION', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Configure via IMG customizing table entry',
      fitClassification: 'F2',
    }));
    expect(result.preferredTechnique).toBe('CONFIGURATION');
  });

  it('"key user" keyword infers KEY_USER_EXTENSIBILITY', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Add custom field using key user tools',
      fitClassification: 'F3',
    }));
    expect(result.preferredTechnique).toBe('KEY_USER_EXTENSIBILITY');
  });

  it('F1 classification with no keywords infers STANDARD_ADOPTION', () => {
    const result = analyzer.analyze(makeInput({
      edition          : 'CLOUD_PUBLIC',
      proposedApproach : 'Meet requirement with SAP standard',
      fitClassification: 'F1',
    }));
    expect(result.preferredTechnique).toBe('STANDARD_ADOPTION');
  });
});

// ── 12. Analysis result structure ─────────────────────────────────────────────

describe('CleanCoreAnalyzer — result structure completeness', () => {
  it('result has all required fields', () => {
    const result = analyzer.analyze(makeInput());
    expect(result.analysisId).toBeDefined();
    expect(result.schemaVersion).toBeDefined();
    expect(result.preferredTechnique).toBeDefined();
    expect(result.cleanCoreTier).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    expect(Array.isArray(result.concerns)).toBe(true);
    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(typeof result.requiredArchitectureReview).toBe('boolean');
    expect(typeof result.requiresException).toBe('boolean');
    expect(Array.isArray(result.unknowns)).toBe(true);
    expect(Array.isArray(result.appliedRules)).toBe(true);
    expect(Array.isArray(result.techniqueApplicability)).toBe(true);
  });

  it('appliedRules contains only rules for the target edition', () => {
    const result = analyzer.analyze(makeInput({ edition: 'CLOUD_PUBLIC' }));
    for (const rule of result.appliedRules) {
      expect(rule.applicableEditions).toContain('CLOUD_PUBLIC');
    }
  });
});
