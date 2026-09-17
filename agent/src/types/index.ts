/**
 * N-Guard Agent Engine — Shared Domain Types
 *
 * These types are the typed contract between the Agent Engine,
 * the AIProvider, and the VectorStore (architecture rule 12).
 *
 * Architecture rules:
 *  - Rule 1/2: S4Edition is a first-class discriminant; never optional in
 *              assessment inputs.
 *  - Rule 12:  All AI input/output is structured via these interfaces.
 */

// ─── SAP S/4HANA Edition ─────────────────────────────────────────────────────

export type S4Edition =
  | 'ON_PREMISE'
  | 'CLOUD_PRIVATE'
  | 'CLOUD_PUBLIC';

export const S4_EDITIONS: readonly S4Edition[] = [
  'ON_PREMISE',
  'CLOUD_PRIVATE',
  'CLOUD_PUBLIC',
] as const;

// ─── Assessment Types ─────────────────────────────────────────────────────────

export type Verdict =
  | 'FIT_TO_STANDARD'
  | 'ACCEPTABLE_GAP'
  | 'CUSTOMIZATION_RISK'
  | 'REJECT'
  | 'NEEDS_REVIEW';

export type RecommendationType =
  | 'STANDARD_ALTERNATIVE'
  | 'CONFIGURATION'
  | 'EXTENSIBILITY'
  | 'PROCESS_CHANGE';

export type Effort   = 'LOW' | 'MEDIUM' | 'HIGH';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvidenceSource {
  docId   : string;
  title   : string;
  excerpt : string;
  score   : number;
}

export interface AssessmentRecommendation {
  type        : RecommendationType;
  description : string;
  effort      : Effort;
  priority    : Priority;
  rationale   : string;
}

// ─── Agent Engine Contracts ───────────────────────────────────────────────────

/** Input to the Agent Engine assess() method. */
export interface AssessmentInput {
  designRequestId : string;
  projectId       : string;
  tenantId        : string;
  title           : string;
  description     : string;
  businessProcess?: string;
  module?         : string;
  edition         : S4Edition;   // Required — rule 1/2
  release?        : string;
}

/** The structured result returned by the Agent Engine. */
export interface AssessmentResult {
  verdict         : Verdict;
  rationale       : string;
  evidenceSources : EvidenceSource[];
  confidence      : number;          // 0.0 – 1.0
  recommendations : AssessmentRecommendation[];
}

/** Input for embedding a knowledge document into the VectorStore. */
export interface EmbedDocumentInput {
  id       : string;
  content  : string;
  metadata : {
    tenantId?  : string;
    projectId? : string;
    edition?   : S4Edition | string;
    release?   : string;
    title?     : string;
    [key: string]: unknown;
  };
}
