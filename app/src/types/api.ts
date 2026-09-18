/**
 * N-Guard Frontend — API Types
 *
 * Mirrors the CAP OData/REST shapes returned by NGuardService and AdminService.
 * Keep in sync with the CDS domain model (db/schema.cds).
 *
 * Phase 2 additions:
 *  - SAPProduct, TransformationType, CleanCorePolicy types
 *  - SAPDeploymentProfile, UserActor interfaces
 *  - Project enhanced with Phase 2 fields
 *
 * Phase 3 additions:
 *  - WorkItemType, WorkItemPriority, RelationType types
 *  - DesignRequest enhanced with Phase 3 workspace fields
 *  - RelatedWorkItem interface
 *  - CSV import/export payload types
 */

export type S4Edition =
  | 'ON_PREMISE'
  | 'CLOUD_PRIVATE'
  | 'CLOUD_PUBLIC';

export const S4_EDITION_LABELS: Record<S4Edition, string> = {
  ON_PREMISE    : 'SAP S/4HANA On-Premise',
  CLOUD_PRIVATE : 'SAP S/4HANA Cloud, Private Edition',
  CLOUD_PUBLIC  : 'SAP S/4HANA Cloud, Public Edition',
};

export type Verdict =
  | 'FIT_TO_STANDARD'
  | 'ACCEPTABLE_GAP'
  | 'CUSTOMIZATION_RISK'
  | 'REJECT'
  | 'NEEDS_REVIEW';

export type AssessmentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSESSING'
  | 'ASSESSED'
  | 'APPROVED'
  | 'REJECTED';

// ─── Phase 2 types ────────────────────────────────────────────────────────────

export type SAPProduct = 'S4HANA';

export type TransformationType =
  | 'GREENFIELD'
  | 'BROWNFIELD'
  | 'SELECTIVE'
  | 'OTHER';

export const TRANSFORMATION_TYPE_LABELS: Record<TransformationType, string> = {
  GREENFIELD : 'Greenfield — New implementation on clean system',
  BROWNFIELD : 'Brownfield — System conversion / technical migration',
  SELECTIVE  : 'Selective Data Transition',
  OTHER      : 'Other / Custom approach',
};

export type CleanCorePolicy =
  | 'STRICT'
  | 'STANDARD'
  | 'FLEXIBLE'
  | 'NOT_SET';

export const CLEAN_CORE_POLICY_LABELS: Record<CleanCorePolicy, string> = {
  STRICT   : 'Strict — Extensions only via BTP side-by-side',
  STANDARD : 'Standard — SAP-approved extensibility patterns',
  FLEXIBLE : 'Flexible — Project-defined governance',
  NOT_SET  : 'Not Set — Policy requires architecture decision',
};

// ─── Phase 3 types ────────────────────────────────────────────────────────────

export type WorkItemType =
  | 'REQUIREMENT'
  | 'USER_STORY'
  | 'CHANGE_REQUEST'
  | 'DESIGN_ARTIFACT';

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  REQUIREMENT    : 'Business Requirement',
  USER_STORY     : 'User Story',
  CHANGE_REQUEST : 'Change Request',
  DESIGN_ARTIFACT: 'Design Artifact',
};

export const WORK_ITEM_TYPES: WorkItemType[] = [
  'REQUIREMENT', 'USER_STORY', 'CHANGE_REQUEST', 'DESIGN_ARTIFACT',
];

export type WorkItemPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const WORK_ITEM_PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  CRITICAL : 'Critical',
  HIGH     : 'High',
  MEDIUM   : 'Medium',
  LOW      : 'Low',
};

export const WORK_ITEM_PRIORITIES: WorkItemPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export type RelationType =
  | 'RELATES_TO'
  | 'BLOCKS'
  | 'DEPENDS_ON'
  | 'DUPLICATES'
  | 'CHILD_OF'
  | 'PARENT_OF';

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface Tenant {
  ID          : string;
  name        : string;
  description?: string;
  isActive    : boolean;
  createdAt   : string;
  modifiedAt  : string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  ID                  : string;
  tenant_ID           : string;
  name                : string;
  description?        : string;
  edition             : S4Edition;
  release?            : string;
  status              : string;
  transformationType? : TransformationType;
  cleanCorePolicy     : CleanCorePolicy;
  createdAt           : string;
  modifiedAt          : string;
  deploymentProfiles? : SAPDeploymentProfile[];
}

// ─── SAP Deployment Profile ───────────────────────────────────────────────────

export interface SAPDeploymentProfile {
  ID                      : string;
  project_ID              : string;
  tenant_ID               : string;
  profileName             : string;
  sapProduct              : SAPProduct;
  deploymentModel         : S4Edition;
  release?                : string;
  releaseFrom?            : string;
  releaseTo?              : string;
  country?                : string;
  industry?               : string;
  transformationType?     : TransformationType;
  cleanCorePolicy         : CleanCorePolicy;
  processAreas?           : string;   // JSON: string[]
  sourceSystemDescription?: string;
  isPrimary               : boolean;
  isActive                : boolean;
  createdAt               : string;
  modifiedAt              : string;
}

// ─── User Actor ───────────────────────────────────────────────────────────────

export interface UserActor {
  ID          : string;
  externalId  : string;
  displayName?: string;
  email?      : string;
  roles?      : string;   // JSON: string[]
  isActive    : boolean;
}

// ─── Design Request (Phase 3 Requirements Workspace Item) ────────────────────

export interface DesignRequest {
  ID                : string;
  project_ID        : string;
  tenant_ID         : string;
  workItemType      : WorkItemType;
  title             : string;
  description       : string;
  businessObjective?: string;
  businessProcess?  : string;
  module?           : string;
  priority          : WorkItemPriority;
  source?           : string;
  requestedBy?      : string;
  owner?            : string;
  tags?             : string;   // JSON: string[]
  externalReference?: string;
  deploymentProfile_ID?: string;
  status            : RequestStatus;
  createdAt         : string;
  modifiedAt        : string;
}

// ─── Related Work Items ───────────────────────────────────────────────────────

export interface RelatedWorkItem {
  ID          : string;
  sourceItem_ID: string;
  targetItem_ID: string;
  relation    : RelationType;
  note?       : string;
}

// ─── CSV Import/Export ────────────────────────────────────────────────────────

export interface CsvImportRowError {
  row     : number;
  field   : string;
  message : string;
}

export interface CsvImportResult {
  imported   : number;
  errorCount : number;
  errors     : string;   // JSON: CsvImportRowError[]
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface EvidenceSource {
  docId   : string;
  title   : string;
  excerpt : string;
  score   : number;
}

export interface Recommendation {
  ID            : string;
  assessment_ID : string;
  sequence      : number;
  type          : string;
  description   : string;
  effort        : string;
  priority      : string;
  rationale?    : string;
}

// ─── Phase 7: F1-F8 Fit Classification types ─────────────────────────────────

export type FitClassification = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';
export type DeploymentCompatibilityCode = 'DP-OP' | 'DP-PCE' | 'DP-PUB' | 'DP-ALL' | 'DP-NA' | 'DP-VERIFY';
export type EvidenceConfidence = 'VERIFIED' | 'LIKELY' | 'NEEDS_SME_REVIEW' | 'INSUFFICIENT_EVIDENCE';

export const FIT_CLASSIFICATION_LABELS: Record<FitClassification, string> = {
  F1: 'F1 — Standard Fit',           F2: 'F2 — Configuration Fit',
  F3: 'F3 — Standard + Minor Ext.',  F4: 'F4 — Clean Core Extension',
  F5: 'F5 — Standardization Opp.',   F6: 'F6 — Customization Risk',
  F7: 'F7 — Business Differentiator',F8: 'F8 — Insufficient Evidence',
};

export const FIT_CLASSIFICATION_COLORS: Record<FitClassification, string> = {
  F1: '#22c55e',  // green
  F2: '#86efac',  // light green
  F3: '#facc15',  // yellow
  F4: '#fb923c',  // orange
  F5: '#60a5fa',  // blue
  F6: '#f87171',  // red
  F7: '#a78bfa',  // purple
  F8: '#94a3b8',  // gray
};

export const CONFIDENCE_LABELS: Record<EvidenceConfidence, string> = {
  VERIFIED              : 'Verified',
  LIKELY                : 'Likely',
  NEEDS_SME_REVIEW      : 'Needs SME Review',
  INSUFFICIENT_EVIDENCE : 'Insufficient Evidence',
};

// ─── Assessment (Phase 7 enhanced) ───────────────────────────────────────────

export interface ComplianceAssessment {
  ID               : string;
  designRequest_ID : string;
  project_ID       : string;
  tenant_ID        : string;
  verdict?         : Verdict;
  status           : AssessmentStatus;
  rationale?       : string;
  evidenceSources? : string;   // JSON string of EvidenceSource[]
  confidence?      : number;
  agentVersion?    : string;
  processedAt?     : string;
  createdAt        : string;
  modifiedAt       : string;
  recommendations? : Recommendation[];
  // Phase 7: F1-F8 fields
  fitClassification?         : FitClassification;
  deploymentCompatibility?   : DeploymentCompatibilityCode;
  evidenceConfidence?        : EvidenceConfidence;
  businessIntentSummary?     : string;
  processClassification?     : string;
  targetDeploymentContext?   : string;
  standardCapability?        : string;
  gapDescription?            : string;
  configurationOpportunity?  : string;
  customizationRiskStatement?: string;
  recommendedNextAction?     : string;
  assumptions?               : string;  // JSON: string[]
  unknowns?                  : string;  // JSON: string[]
  humanReviewRequired?       : boolean;
  agentSchemaVersion?        : string;
}

// ─── Phase 4: Knowledge types ────────────────────────────────────────────────

export type KnowledgeSourceType =
  | 'SAP_HELP_PORTAL'
  | 'SAP_BEST_PRACTICE'
  | 'RELEASE_NOTE'
  | 'PARTNER_CONTENT'
  | 'INTERNAL_GUIDELINE'
  | 'FILE_UPLOAD';

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  SAP_HELP_PORTAL    : 'SAP Help Portal',
  SAP_BEST_PRACTICE  : 'SAP Best Practice Explorer',
  RELEASE_NOTE       : 'Release Notes',
  PARTNER_CONTENT    : 'Partner Content',
  INTERNAL_GUIDELINE : 'Internal Guideline',
  FILE_UPLOAD        : 'File Upload',
};

export type AuthorityLevel = 'SAP_OFFICIAL' | 'PARTNER' | 'INTERNAL';

export const AUTHORITY_LEVEL_LABELS: Record<AuthorityLevel, string> = {
  SAP_OFFICIAL : 'SAP Official Documentation',
  PARTNER      : 'Certified Partner / SI Content',
  INTERNAL     : 'Customer / Project-Internal',
};

export type IngestionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface KnowledgeSource {
  ID             : string;
  tenant_ID?     : string;
  project_ID?    : string;
  name           : string;
  description?   : string;
  sourceType     : KnowledgeSourceType;
  baseUrl?       : string;
  authorityLevel : AuthorityLevel;
  isActive       : boolean;
  createdAt      : string;
  modifiedAt     : string;
}

export interface KnowledgeDocument {
  ID                : string;
  tenant_ID?        : string;
  project_ID?       : string;
  knowledgeSource_ID?: string;
  edition?          : S4Edition;
  release?          : string;
  title             : string;
  content           : string;
  source?           : string;
  docType           : string;
  authorityLevel    : AuthorityLevel;
  country?          : string;
  industry?         : string;
  processArea?      : string;
  processId?        : string;
  scopeItem?        : string;
  capability?       : string;
  extensionType?    : string;
  documentVersion?  : string;
  documentDate?     : string;
  language?         : string;
  mimeType?         : string;
  fileSizeBytes?    : number;
  ingestionStatus   : IngestionStatus;
  ingestionError?   : string;
  chunkCount        : number;
  isActive          : boolean;
  createdAt         : string;
  modifiedAt        : string;
}

export interface KnowledgeChunk {
  ID             : string;
  document_ID    : string;
  sequence       : number;
  text           : string;
  tokenCount?    : number;
  edition?       : S4Edition;
  release?       : string;
  country?       : string;
  industry?      : string;
  processArea?   : string;
  scopeItem?     : string;
  authorityLevel : AuthorityLevel;
}

export interface IngestionJob {
  ID               : string;
  tenant_ID?       : string;
  project_ID?      : string;
  knowledgeSource_ID?: string;
  document_ID?     : string;
  status           : IngestionStatus;
  sourceFileName?  : string;
  sourceMimeType?  : string;
  extractedLength? : number;
  chunkCount       : number;
  error?           : string;
  startedAt?       : string;
  completedAt?     : string;
  createdAt        : string;
  modifiedAt       : string;
}

// ─── Project creation payload ─────────────────────────────────────────────────

export interface CreateProjectPayload {
  name                    : string;
  description?            : string;
  edition                 : S4Edition;
  release?                : string;
  transformationType?     : TransformationType;
  cleanCorePolicy?        : CleanCorePolicy;
  profileName?            : string;
  deploymentModel?        : S4Edition;
  profileRelease?         : string;
  country?                : string;
  industry?               : string;
  processAreas?           : string;   // JSON: string[]
  sourceSystemDescription?: string;
}

// ─── Phase 8: Cross-Edition Comparison types ─────────────────────────────────

export interface EditionComparisonResult {
  ID?                     : string;
  comparison_ID?          : string;
  edition                 : S4Edition;
  fitClassification?      : FitClassification;
  deploymentCompatibility?: DeploymentCompatibilityCode;
  evidenceConfidence?     : EvidenceConfidence;
  confidence?             : number;
  standardCapability?     : string;
  gapDescription?         : string;
  configurationApproach?  : string;
  extensibilityOptions?   : string;
  majorConstraints?       : string;
  cleanCoreImplications?  : string;
  processIdentifiers?     : string;  // JSON: string[]
  evidenceRefs?           : string;  // JSON: EvidenceReference[]
  agentRunId?             : string;
  humanReviewRequired?    : boolean;
  validationPassed?       : boolean;
}

export interface CrossEditionComparison {
  ID?                 : string;
  designRequest_ID    : string;
  project_ID          : string;
  tenant_ID           : string;
  businessIntent?     : string;
  processArea?        : string;
  summary?            : string;   // JSON: CrossEditionSummary
  evidencePartitioned : boolean;
  schemaVersion?      : string;
  completedAt?        : string;
  createdAt?          : string;
  modifiedAt?         : string;
  editionResults?     : EditionComparisonResult[];
}

export interface CrossEditionSummary {
  commonCapabilities       : string[];
  editionSpecificNotes     : string[];
  recommendedNextAction    : string;
  overallHumanReviewNeeded : boolean;
  editionsWithInsufficient : S4Edition[];
}

// ─── Phase 9: Clean Core Analysis types ──────────────────────────────────────

export type CleanCoreTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
export type CleanCoreRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExtensibilityTechnique =
  | 'STANDARD_ADOPTION' | 'CONFIGURATION' | 'KEY_USER_EXTENSIBILITY'
  | 'DEVELOPER_EXTENSIBILITY' | 'BTP_SIDE_BY_SIDE' | 'CLASSIC_CUSTOM';

export const CLEAN_CORE_TIER_LABELS: Record<CleanCoreTier, string> = {
  TIER_1: 'Tier 1 — Core (SAP Standard Only)',
  TIER_2: 'Tier 2 — Stable (Configuration + Key-User)',
  TIER_3: 'Tier 3 — Resilient (Developer + BTP Side-by-Side)',
  TIER_4: 'Tier 4 — Exception (Classic Custom; Requires Approval)',
};

export const CLEAN_CORE_TIER_COLORS: Record<CleanCoreTier, string> = {
  TIER_1: '#22c55e', TIER_2: '#84cc16', TIER_3: '#fb923c', TIER_4: '#ef4444',
};

export const CLEAN_CORE_RISK_COLORS: Record<CleanCoreRisk, string> = {
  LOW: '#22c55e', MEDIUM: '#facc15', HIGH: '#f97316', CRITICAL: '#ef4444',
};

export const EXTENSIBILITY_TECHNIQUE_LABELS: Record<ExtensibilityTechnique, string> = {
  STANDARD_ADOPTION      : 'Standard Process Adoption',
  CONFIGURATION          : 'Standard Configuration (Customizing)',
  KEY_USER_EXTENSIBILITY : 'Key-User / In-App Extensibility',
  DEVELOPER_EXTENSIBILITY: 'Developer / On-Stack Extensibility',
  BTP_SIDE_BY_SIDE       : 'SAP BTP Side-by-Side Extension',
  CLASSIC_CUSTOM         : 'Classic Custom Code (Exception Required)',
};

export interface CleanCoreAnalysis {
  ID?                        : string;
  designRequest_ID           : string;
  project_ID                 : string;
  tenant_ID                  : string;
  assessment_ID?             : string;
  catalogVersion?            : string;
  schemaVersion?             : string;
  edition                    : S4Edition;
  release?                   : string;
  cleanCorePolicy?           : string;
  fitClassification?         : FitClassification;
  proposedApproach?          : string;
  preferredTechnique?        : ExtensibilityTechnique;
  cleanCoreTier?             : CleanCoreTier;
  riskLevel?                 : CleanCoreRisk;
  requiredArchitectureReview?: boolean;
  requiresException?         : boolean;
  saferAlternative?          : ExtensibilityTechnique;
  concerns?                  : string;  // JSON: string[]
  riskFactors?               : string;  // JSON: string[]
  unknowns?                  : string;  // JSON: string[]
  techniqueApplicability?    : string;  // JSON: TechniqueApplicability[]
  createdAt?                 : string;
  modifiedAt?                : string;
}

// ─── Phase 10: Human Review Workflow types ───────────────────────────────────

export type ReviewStatus =
  | 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'ACCEPTED'
  | 'MODIFIED' | 'EXCEPTION_APPROVED' | 'REJECTED' | 'RETURNED'
  | 'SME_ESCALATED' | 'ARCHIVED';

export type ReviewAction =
  | 'ACCEPT' | 'MODIFY_DISPOSITION' | 'REQUEST_MORE_EVIDENCE'
  | 'SEND_TO_SME' | 'APPROVE_EXCEPTION' | 'REJECT_CUSTOMIZATION' | 'RETURN_TO_OWNER';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  NOT_SUBMITTED     : 'Not Submitted',    PENDING_REVIEW    : 'Pending Review',
  UNDER_REVIEW      : 'Under Review',     ACCEPTED          : 'Accepted',
  MODIFIED          : 'Modified',         EXCEPTION_APPROVED: 'Exception Approved',
  REJECTED          : 'Rejected',         RETURNED          : 'Returned to Owner',
  SME_ESCALATED     : 'Escalated to SME', ARCHIVED          : 'Archived',
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  NOT_SUBMITTED     : '#475569', PENDING_REVIEW    : '#94a3b8',
  UNDER_REVIEW      : '#60a5fa', ACCEPTED          : '#22c55e',
  MODIFIED          : '#84cc16', EXCEPTION_APPROVED: '#a78bfa',
  REJECTED          : '#ef4444', RETURNED          : '#facc15',
  SME_ESCALATED     : '#fb923c', ARCHIVED          : '#334155',
};

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  ACCEPT                : 'Accept Recommendation',
  MODIFY_DISPOSITION    : 'Modify Disposition',
  REQUEST_MORE_EVIDENCE : 'Request More Evidence',
  SEND_TO_SME           : 'Send to SME Review',
  APPROVE_EXCEPTION     : 'Approve Exception',
  REJECT_CUSTOMIZATION  : 'Reject Customization',
  RETURN_TO_OWNER       : 'Return to Requirement Owner',
};

export const RATIONALE_REQUIRED_ACTIONS: ReviewAction[] = [
  'APPROVE_EXCEPTION', 'REJECT_CUSTOMIZATION', 'MODIFY_DISPOSITION',
];

export interface DesignDecision {
  ID?               : string;
  designRequest_ID  : string;
  project_ID        : string;
  tenant_ID         : string;
  assessment_ID?    : string;
  recordType        : 'DECISION' | 'EXCEPTION' | 'ESCALATION';
  reviewAction      : ReviewAction;
  newStatus         : ReviewStatus;
  priorStatus       : ReviewStatus;
  actor             : string;
  decidedAt         : string;
  rationale?        : string;
  modifiedVerdict?  : string;
  dispositionNotes? : string;
  linkedEvidence?   : string;  // JSON: EvidenceReference[]
  isAIFinalApprover : false;
  createdAt?        : string;
  modifiedAt?       : string;
}

// ─── Phase 11: Dashboard Statistics ─────────────────────────────────────────

export interface DashboardStats {
  totalRequirements      : number;
  assessed               : number;
  pendingAssessment      : number;
  approved               : number;
  rejected               : number;
  reviewQueue            : number;
  exceptionsApproved     : number;
  customizationRisk      : number;
  fitDistribution        : string;   // JSON: Record<string,number>
  confidenceDistribution : string;   // JSON: Record<string,number>
  cleanCoreTierDist      : string;   // JSON: Record<string,number>
  decisionsByAction      : string;   // JSON: Record<string,number>
}

// ─── Phase 12: Async Job Queue types ─────────────────────────────────────────

export type JobType   = 'DOCUMENT_INGESTION' | 'BULK_REQUIREMENT_IMPORT' | 'BATCH_ASSESSMENT' | 'KNOWLEDGE_REINDEX' | 'INTEGRATION_SYNC';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETRYING';
export type IntegrationHealthStatus = 'CONNECTED' | 'UNREACHABLE' | 'AUTHENTICATION_ERROR' | 'NOT_CONFIGURED' | 'CHECKING';

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  QUEUED:'#94a3b8', RUNNING:'#60a5fa', COMPLETED:'#22c55e',
  FAILED:'#ef4444', CANCELLED:'#475569', RETRYING:'#facc15',
};

export const INTEGRATION_STATUS_COLORS: Record<IntegrationHealthStatus, string> = {
  CONNECTED:'#22c55e', UNREACHABLE:'#ef4444', AUTHENTICATION_ERROR:'#f97316',
  NOT_CONFIGURED:'#94a3b8', CHECKING:'#60a5fa',
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  DOCUMENT_INGESTION      : 'Document Ingestion',
  BULK_REQUIREMENT_IMPORT : 'Bulk Requirement Import',
  BATCH_ASSESSMENT        : 'Batch Assessment',
  KNOWLEDGE_REINDEX       : 'Knowledge Re-index',
  INTEGRATION_SYNC        : 'Integration Sync',
};

export interface AsyncJob {
  ID?            : string;
  project_ID     : string;
  tenant_ID      : string;
  jobType        : JobType;
  status         : JobStatus;
  payload?       : string;  // JSON
  progress?      : number;
  itemsProcessed?: number;
  itemsTotal?    : number;
  errorMessage?  : string;
  retryCount?    : number;
  maxRetries?    : number;
  submittedBy?   : string;
  startedAt?     : string;
  completedAt?   : string;
  createdAt?     : string;
  modifiedAt?    : string;
}

export interface IntegrationHealth {
  target      : string;
  label       : string;
  status      : IntegrationHealthStatus;
  message?    : string;
  checkedAt?  : string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ODataListResponse<T> {
  value: T[];
}

export interface ActionResponse<T> {
  value: T;
}
