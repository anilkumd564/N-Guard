/**
 * N-Guard — Cross-Edition Comparison Types (Phase 8)
 *
 * For a selected business requirement, N-Guard runs three independent
 * FitAssessment contexts — one per S/4HANA edition — and produces a
 * normalized comparison result.
 *
 * Architecture rules:
 *  - Rule 2:  Each edition is assessed independently; evidence from one
 *             edition is NEVER used as proof for another.
 *  - Rule 4:  Every edition result cites EvidenceReferences.
 *  - Rule 5:  The comparison summary describes differences without choosing
 *             an edition for the user.
 *  - Rule 12: Unknown availability stays Unknown/Needs Verification.
 *             Evidence absence → F8/INSUFFICIENT_EVIDENCE, not assumed Fit.
 */

import type { S4Edition } from '../types/index.js';
import type { FitClassification, DeploymentCompatibilityCode, EvidenceConfidence } from '../assessment/types.js';
import type { EvidenceReference } from '../orchestration/types.js';

// ─── Per-Edition Result ───────────────────────────────────────────────────────

/**
 * FitAssessmentResult for a single S/4HANA edition within a cross-edition
 * comparison run. Evidence is always edition-partitioned.
 */
export interface EditionComparisonResult {
  /** S/4HANA edition this result applies to. */
  edition                 : S4Edition;
  /** F1-F8 fit classification for this edition. */
  fitClassification       : FitClassification;
  /** DP-* deployment compatibility code. */
  deploymentCompatibility : DeploymentCompatibilityCode;
  /** Evidence confidence for this edition. */
  evidenceConfidence      : EvidenceConfidence;
  /** Numeric confidence 0.0–1.0 for this edition. */
  confidence              : number;
  /** Standard capability if F1/F2; absent if not applicable. */
  standardCapability?     : string;
  /** Gap between the requirement and standard for this edition. */
  gapDescription?         : string;
  /** Configuration approach available for this edition. */
  configurationApproach?  : string;
  /** Extensibility options available for this edition. */
  extensibilityOptions?   : string;
  /** Major constraints or restrictions for this edition. */
  majorConstraints?       : string;
  /** Clean Core implications specific to this edition. */
  cleanCoreImplications?  : string;
  /** SAP process/scope identifiers relevant to this edition. */
  processIdentifiers      : string[];
  /** Evidence references partitioned to this edition. */
  evidenceReferences      : EvidenceReference[];
  /** Whether human review is required for this edition. */
  humanReviewRequired     : boolean;
  /** Agent run ID for this edition's assessment (audit trail). */
  agentRunId              : string;
  /** Schema version ('2.0' for Phase 7+ assessments). */
  schemaVersion           : string;
  /** Whether the LLM response passed schema validation for this edition. */
  validationPassed        : boolean;
}

// ─── Comparison Summary ───────────────────────────────────────────────────────

/**
 * Cross-edition summary produced AFTER the three individual assessments.
 * Describes differences without making an edition recommendation.
 * Rule 5: The summary never selects an edition for the user.
 */
export interface CrossEditionSummary {
  /** Capabilities or configurations that appear consistent across all editions. */
  commonCapabilities       : string[];
  /** Edition-specific differences (not choosing, only describing). */
  editionSpecificNotes     : string[];
  /** Process-level next action (e.g. 'Align on target edition before proceeding'). */
  recommendedNextAction    : string;
  /** True if ANY edition result requires human review. */
  overallHumanReviewNeeded : boolean;
  /** Editions where evidence was insufficient — listed explicitly. */
  editionsWithInsufficient : S4Edition[];
}

// ─── Cross-Edition Comparison Result ─────────────────────────────────────────

/**
 * The complete result of a cross-edition comparison run.
 * Contains three EditionComparisonResults — one per S/4HANA edition —
 * plus an overall summary. Evidence is always partitioned by edition.
 */
export interface CrossEditionComparisonResult {
  /** Unique comparison run identifier. */
  comparisonId        : string;
  /** Associated design request. */
  designRequestId     : string;
  /** Project scope. */
  projectId           : string;
  /** Tenant scope. */
  tenantId            : string;
  /** Business intent summary (derived from first completed edition run). */
  businessIntent      : string;
  /** SAP process area classification. */
  processArea         : string;
  /** Results for each of the three editions (always 3 entries). */
  editionResults      : EditionComparisonResult[];
  /** Cross-edition summary. */
  summary             : CrossEditionSummary;
  /**
   * Always true — evidence is partitioned by edition in this engine.
   * A future audit check can verify this programmatically.
   */
  evidencePartitioned : boolean;
  /** ISO 8601 completion timestamp. */
  completedAt         : string;
  /** Schema version of the comparison contract. */
  schemaVersion       : string;
}
