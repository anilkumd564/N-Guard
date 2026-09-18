/**
 * N-Guard — Fit-to-Standard Assessment Types (Phase 7)
 *
 * F1–F8 fit classification model, DP-* deployment compatibility codes,
 * EvidenceConfidence levels, and the full FitAssessmentResult structure.
 *
 * Architecture rules:
 *  - Rule 2: Edition is always explicit; no deployment model is assumed.
 *  - Rule 4: Every assessment cites evidence references.
 *  - Rule 5: These results are RECOMMENDATIONS — human architects decide.
 *  - F8/DP-VERIFY are valid outcomes when evidence is insufficient.
 */

import type { AssessmentRecommendation } from '../types/index.js';
import type { EvidenceReference } from '../orchestration/types.js';

// ─── F1–F8 Fit Classification ─────────────────────────────────────────────────

/**
 * N-Guard Fit Classification Model.
 * F8 (Insufficient Evidence) and DP-VERIFY are valid outcomes — the agent
 * must never claim standard support when evidence is absent.
 */
export type FitClassification =
  | 'F1'   // Standard Fit — SAP standard fully covers the requirement
  | 'F2'   // Configuration Fit — meets via configuration, no code change
  | 'F3'   // Standard + Minor Extension — small approved extension needed
  | 'F4'   // Clean Core Extension — BTP side-by-side or key-user extension
  | 'F5'   // Standardization Opportunity — requirement can be redesigned to fit
  | 'F6'   // Potential Customization Risk — significant risk, challenge required
  | 'F7'   // Legitimate Business Differentiator — justified custom requirement
  | 'F8';  // Insufficient Evidence — cannot classify without more information

export const ALL_FIT_CLASSIFICATIONS: readonly FitClassification[] = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8',
] as const;

export const FIT_CLASSIFICATION_LABELS: Record<FitClassification, string> = {
  F1 : 'F1 — Standard Fit',
  F2 : 'F2 — Configuration Fit',
  F3 : 'F3 — Standard + Minor Extension',
  F4 : 'F4 — Clean Core Extension',
  F5 : 'F5 — Standardization Opportunity',
  F6 : 'F6 — Potential Customization Risk',
  F7 : 'F7 — Legitimate Business Differentiator',
  F8 : 'F8 — Insufficient Evidence',
};

export const FIT_CLASSIFICATION_DESCRIPTIONS: Record<FitClassification, string> = {
  F1 : 'SAP standard process or functionality fully covers this requirement without modification.',
  F2 : 'Requirement can be met through standard SAP configuration alone.',
  F3 : 'Requirement mostly fits standard; a small SAP-approved extension is required.',
  F4 : 'Requirement requires a Clean Core extension (key-user extensibility or BTP side-by-side).',
  F5 : 'Requirement can be redesigned to fit standard SAP — represents a standardization opportunity.',
  F6 : 'Requirement presents significant customization risk; requires architecture challenge.',
  F7 : 'Requirement is a legitimate, justified business differentiator where customization is warranted.',
  F8 : 'Evidence is insufficient to classify. Further research or SME input is required.',
};

// ─── Deployment Compatibility Codes ──────────────────────────────────────────

/**
 * SAP S/4HANA deployment compatibility.
 * Always edition-specific — never assume cross-edition availability (rule 2).
 */
export type DeploymentCompatibilityCode =
  | 'DP-OP'      // Applicable to S/4HANA On-Premise
  | 'DP-PCE'     // Applicable to S/4HANA Cloud Private Edition
  | 'DP-PUB'     // Applicable to S/4HANA Cloud Public Edition
  | 'DP-ALL'     // Applicable across all three editions (with evidence)
  | 'DP-NA'      // Not applicable / not available in the target edition
  | 'DP-VERIFY'; // Requires edition/release verification before confirming

export const ALL_DEPLOYMENT_CODES: readonly DeploymentCompatibilityCode[] = [
  'DP-OP', 'DP-PCE', 'DP-PUB', 'DP-ALL', 'DP-NA', 'DP-VERIFY',
] as const;

export const DEPLOYMENT_CODE_LABELS: Record<DeploymentCompatibilityCode, string> = {
  'DP-OP'     : 'DP-OP — On-Premise',
  'DP-PCE'    : 'DP-PCE — Cloud Private Edition',
  'DP-PUB'    : 'DP-PUB — Cloud Public Edition',
  'DP-ALL'    : 'DP-ALL — All Editions',
  'DP-NA'     : 'DP-NA — Not Applicable',
  'DP-VERIFY' : 'DP-VERIFY — Requires Verification',
};

// ─── Evidence Confidence ──────────────────────────────────────────────────────

/**
 * Confidence classification for assessment evidence.
 * The agent must use INSUFFICIENT_EVIDENCE when knowledge is sparse.
 */
export type EvidenceConfidence =
  | 'VERIFIED'               // Evidence is authoritative and directly applicable
  | 'LIKELY'                 // Evidence strongly suggests the classification
  | 'NEEDS_SME_REVIEW'       // Classification is plausible but needs expert validation
  | 'INSUFFICIENT_EVIDENCE'; // Cannot classify — F8 should be used

export const ALL_CONFIDENCE_LEVELS: readonly EvidenceConfidence[] = [
  'VERIFIED',
  'LIKELY',
  'NEEDS_SME_REVIEW',
  'INSUFFICIENT_EVIDENCE',
] as const;

export const CONFIDENCE_LABELS: Record<EvidenceConfidence, string> = {
  VERIFIED              : 'Verified — authoritative evidence supports the classification',
  LIKELY                : 'Likely — evidence strongly suggests the classification',
  NEEDS_SME_REVIEW      : 'Needs SME Review — classification requires expert validation',
  INSUFFICIENT_EVIDENCE : 'Insufficient Evidence — cannot classify without more information',
};

// ─── Fit Assessment Result ────────────────────────────────────────────────────

/**
 * The complete structured Fit-to-Standard assessment result.
 *
 * This is the Phase 7 extension of StructuredAgentResult.
 * Every field that would normally be "null" must instead be explicit —
 * F8/DP-VERIFY must be emitted when evidence is insufficient.
 *
 * Architecture rule 5: This is a RECOMMENDATION. Human architects decide.
 */
export interface FitAssessmentResult {
  // ── Identification ───────────────────────────────────────────────────────
  /** Agent run ID for audit linkage. */
  agentRunId            : string;
  /** Schema version of the assessment contract. */
  schemaVersion         : string;

  // ── Fit Classification ───────────────────────────────────────────────────
  /** F1–F8 fit classification. */
  fitClassification     : FitClassification;
  /** Deployment compatibility code for the target edition. */
  deploymentCompatibility: DeploymentCompatibilityCode;
  /** Evidence confidence level. */
  evidenceConfidence    : EvidenceConfidence;
  /** Numeric confidence 0.0–1.0 (maps to evidenceConfidence). */
  confidence            : number;

  // ── Assessment Content ───────────────────────────────────────────────────
  /** Brief summary of the business intent behind the requirement. */
  businessIntentSummary : string;
  /** SAP process area / process classification (e.g. 'Order-to-Cash'). */
  processClassification : string;
  /** Target deployment context description. */
  targetDeploymentContext: string;
  /** Identified SAP standard capability that covers the requirement (if any). */
  standardCapability?   : string;
  /** Description of the gap between the requirement and standard. */
  gapDescription?       : string;
  /** Configuration opportunity — how to meet via config rather than code. */
  configurationOpportunity?: string;
  /** Customization risk statement — risk level and consequences. */
  customizationRiskStatement?: string;
  /** Recommended next action for the design authority. */
  recommendedNextAction : string;

  // ── Evidence + Recommendations ───────────────────────────────────────────
  /** Evidence references used to support the classification. */
  evidenceReferences    : EvidenceReference[];
  /** Actionable recommendations. */
  recommendations       : AssessmentRecommendation[];

  // ── Governance ───────────────────────────────────────────────────────────
  /** Explicit assumptions made during assessment. */
  assumptions           : string[];
  /** Unknowns that could change the classification. */
  unknowns              : string[];
  /** Whether human review is required before proceeding. */
  humanReviewRequired   : boolean;

  // ── Validation ───────────────────────────────────────────────────────────
  validationPassed      : boolean;
  validationErrors      : string[];
  processingNotes?      : string;
}
