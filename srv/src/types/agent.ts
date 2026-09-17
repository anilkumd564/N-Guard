/**
 * N-Guard — Agent Engine Port (Service-Layer Contract)
 *
 * These interfaces define the PORTS that the CAP service layer depends on.
 * The Agent Engine package provides the ADAPTERS (concrete implementations).
 *
 * This separation means:
 *  - The srv layer has zero compile-time dependency on agent internals (rule 6).
 *  - The interfaces can evolve independently of the framework.
 *  - Tests can inject mocks without touching the real engine.
 */

export type S4Edition =
  | 'ON_PREMISE'
  | 'CLOUD_PRIVATE'
  | 'CLOUD_PUBLIC';

export type Verdict =
  | 'FIT_TO_STANDARD'
  | 'ACCEPTABLE_GAP'
  | 'CUSTOMIZATION_RISK'
  | 'REJECT'
  | 'NEEDS_REVIEW';

export interface EvidenceSource {
  docId   : string;
  title   : string;
  excerpt : string;
  score   : number;
}

export interface AssessmentRecommendation {
  type        : string;
  description : string;
  effort      : string;
  priority    : string;
  rationale   : string;
}

export interface AssessmentInput {
  designRequestId : string;
  projectId       : string;
  tenantId        : string;
  title           : string;
  description     : string;
  businessProcess?: string;
  module?         : string;
  edition         : S4Edition;
  release?        : string;
}

export interface AssessmentResult {
  verdict         : Verdict;
  rationale       : string;
  evidenceSources : EvidenceSource[];
  confidence      : number;
  recommendations : AssessmentRecommendation[];
}

export interface EmbedDocumentInput {
  id       : string;
  content  : string;
  metadata : {
    tenantId?  : string;
    projectId? : string;
    edition?   : string;
    release?   : string;
    title?     : string;
    [key: string]: unknown;
  };
}

/** Port: what the CAP service layer requires of the Agent Engine. */
export interface AgentEngine {
  assess(input: AssessmentInput): Promise<AssessmentResult>;
  embedDocument(input: EmbedDocumentInput): Promise<void>;
}
