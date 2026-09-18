/**
 * N-Guard — Clean Core and Extensibility Governance Types (Phase 9)
 *
 * Versioned, configurable rules catalog for SAP S/4HANA implementation techniques.
 * Rules carry edition/release applicability metadata — no technique is assumed
 * universally available (architecture rule 2).
 *
 * Architecture rules:
 *  - Rule 2:  Every technique carries explicit edition applicability.
 *  - Rule 5:  CleanCoreAnalyzer recommends; it never rejects automatically.
 *             High-risk designs route to human review.
 *  - Rule 12: Rules are versioned code — NOT buried in prompt text.
 */

import type { S4Edition } from '../types/index.js';

// ─── Clean Core Tiers ─────────────────────────────────────────────────────────

/**
 * SAP S/4HANA Clean Core tiers.
 * Tier 1 = fully standard; Tier 4 = exceptional / requires governance.
 */
export type CleanCoreTier =
  | 'TIER_1'   // Core — SAP standard only; zero custom code
  | 'TIER_2'   // Stable — configuration + key-user/in-app extensions
  | 'TIER_3'   // Resilient — developer extensibility + BTP side-by-side
  | 'TIER_4';  // Exception — classic custom code; architecture approval required

export const CLEAN_CORE_TIER_LABELS: Record<CleanCoreTier, string> = {
  TIER_1 : 'Tier 1 — Core (SAP Standard Only)',
  TIER_2 : 'Tier 2 — Stable (Configuration + Key-User)',
  TIER_3 : 'Tier 3 — Resilient (Developer + BTP Side-by-Side)',
  TIER_4 : 'Tier 4 — Exception (Classic Custom; Requires Approval)',
};

export const CLEAN_CORE_TIER_COLORS: Record<CleanCoreTier, string> = {
  TIER_1 : '#22c55e',  // green
  TIER_2 : '#84cc16',  // lime
  TIER_3 : '#fb923c',  // orange
  TIER_4 : '#ef4444',  // red
};

// ─── Extensibility Techniques ─────────────────────────────────────────────────

/**
 * SAP S/4HANA extensibility implementation techniques.
 * Each technique belongs to a Clean Core tier.
 */
export type ExtensibilityTechnique =
  | 'STANDARD_ADOPTION'       // Use SAP standard process — no extension
  | 'CONFIGURATION'           // Standard Customizing/IMG (table entries, SPRO)
  | 'KEY_USER_EXTENSIBILITY'  // Key-user tools: custom fields, BAdI, CBO
  | 'DEVELOPER_EXTENSIBILITY' // On-stack ABAP: BAdI impl, append, enhancement spot
  | 'BTP_SIDE_BY_SIDE'        // Clean Core: SAP BTP extension (RAP, CAP, etc.)
  | 'CLASSIC_CUSTOM';         // Z/Y objects, modifications — requires exception

export const EXTENSIBILITY_TECHNIQUE_LABELS: Record<ExtensibilityTechnique, string> = {
  STANDARD_ADOPTION       : 'Standard Process Adoption',
  CONFIGURATION           : 'Standard Configuration (Customizing)',
  KEY_USER_EXTENSIBILITY  : 'Key-User / In-App Extensibility',
  DEVELOPER_EXTENSIBILITY : 'Developer / On-Stack Extensibility',
  BTP_SIDE_BY_SIDE        : 'SAP BTP Side-by-Side Extension',
  CLASSIC_CUSTOM          : 'Classic Custom Code (Exception Required)',
};

export const TECHNIQUE_TIER: Record<ExtensibilityTechnique, CleanCoreTier> = {
  STANDARD_ADOPTION       : 'TIER_1',
  CONFIGURATION           : 'TIER_1',
  KEY_USER_EXTENSIBILITY  : 'TIER_2',
  DEVELOPER_EXTENSIBILITY : 'TIER_3',
  BTP_SIDE_BY_SIDE        : 'TIER_3',
  CLASSIC_CUSTOM          : 'TIER_4',
};

// ─── Risk Levels ──────────────────────────────────────────────────────────────

export type CleanCoreRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const CLEAN_CORE_RISK_COLORS: Record<CleanCoreRisk, string> = {
  LOW      : '#22c55e',
  MEDIUM   : '#facc15',
  HIGH     : '#f97316',
  CRITICAL : '#ef4444',
};

// ─── Clean Core Rule ──────────────────────────────────────────────────────────

/**
 * A single versioned rule in the Clean Core catalog.
 * Rules carry edition applicability — no technique is assumed cross-edition.
 */
export interface CleanCoreRule {
  /** Unique rule identifier within the catalog version. */
  id                        : string;
  /** Catalog version this rule belongs to. */
  catalogVersion            : string;
  /** The extensibility technique this rule covers. */
  technique                 : ExtensibilityTechnique;
  /** The Clean Core tier classification. */
  tier                      : CleanCoreTier;
  /** S/4HANA editions where this technique is applicable. */
  applicableEditions        : S4Edition[];
  /** Earliest applicable release (null = all releases). */
  applicableReleaseFrom?    : string;
  /** Latest applicable release (null = current). */
  applicableReleaseTo?      : string;
  /** Overall risk level of using this technique. */
  riskLevel                 : CleanCoreRisk;
  /** Whether this technique requires architecture board review. */
  requiresArchitectureReview: boolean;
  /** Whether this technique requires a formal exception/deviation. */
  requiresException         : boolean;
  /** SAP official guidance for this technique. */
  sapRecommendation         : string;
  /** Evidence basis (e.g. SAP documentation reference). */
  evidenceBasis             : string;
  /** Required safeguards when using this technique. */
  safeguards                : string[];
  /** Safer alternative techniques to consider first. */
  alternatives              : ExtensibilityTechnique[];
  /** Key constraints or upgrade impact notes. */
  constraints               : string[];
}

// ─── Clean Core Catalog ───────────────────────────────────────────────────────

/**
 * A versioned catalog of Clean Core rules.
 * Rules are code — not prompt text — ensuring auditability and configurability.
 */
export interface CleanCoreCatalog {
  /** Catalog version identifier (e.g. '1.0'). */
  version : string;
  /** Human-readable catalog description. */
  name    : string;
  /** All rules in this catalog. */
  rules   : CleanCoreRule[];
}

// ─── Clean Core Analysis Input ────────────────────────────────────────────────

/**
 * Input to CleanCoreAnalyzer.analyze().
 * Derived from a completed FitAssessmentResult.
 */
export interface CleanCoreAnalysisInput {
  /** Associated design request / assessment context. */
  designRequestId       : string;
  projectId             : string;
  tenantId              : string;
  /** S/4HANA edition being assessed. */
  edition               : S4Edition;
  /** Release being assessed. */
  release?              : string;
  /** Current project Clean Core policy. */
  cleanCorePolicy?      : string;
  /** The F1-F8 fit classification from the Phase 7 assessment. */
  fitClassification?    : string;
  /** The proposed implementation approach description. */
  proposedApproach      : string;
  /** Business intent summary from Phase 7 assessment. */
  businessIntent?       : string;
  /** Gap description from Phase 7 assessment. */
  gapDescription?       : string;
  /** Configuration opportunity from Phase 7 assessment. */
  configurationOpportunity?: string;
}

// ─── Clean Core Analysis Result ───────────────────────────────────────────────

/**
 * The structured output of a Clean Core analysis.
 * Rule 5: This is a recommendation; it never auto-rejects.
 * High-risk → human review flag, not automatic rejection.
 */
export interface CleanCoreAnalysisResult {
  /** Unique analysis identifier. */
  analysisId                 : string;
  /** Analysis schema version. */
  schemaVersion              : string;
  /** Preferred extensibility technique based on rules + evidence. */
  preferredTechnique         : ExtensibilityTechnique;
  /** Clean Core tier of the preferred technique. */
  cleanCoreTier              : CleanCoreTier;
  /** Risk level of the proposed approach. */
  riskLevel                  : CleanCoreRisk;
  /** Clean Core concerns for this assessment. */
  concerns                   : string[];
  /** Specific customization risk factors. */
  riskFactors                : string[];
  /** Whether architecture board review is required. */
  requiredArchitectureReview : boolean;
  /** Whether a formal exception/deviation request is required. */
  requiresException          : boolean;
  /** Safer alternative if the proposed approach is high-risk. */
  saferAlternative?          : ExtensibilityTechnique;
  /** Unknowns that require SME verification before proceeding. */
  unknowns                   : string[];
  /** Applicable Clean Core rules from the catalog used in this analysis. */
  appliedRules               : CleanCoreRule[];
  /** Per-technique applicability for the target edition. */
  techniqueApplicability     : TechniqueApplicability[];
}

// ─── Technique Applicability ──────────────────────────────────────────────────

/**
 * Whether a specific technique is applicable to the target edition.
 * Produced by CleanCoreAnalyzer for each technique in the catalog.
 */
export interface TechniqueApplicability {
  technique    : ExtensibilityTechnique;
  edition      : S4Edition;
  applicable   : boolean;
  tier         : CleanCoreTier;
  riskLevel    : CleanCoreRisk;
  notes?       : string;
}
