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

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ODataListResponse<T> {
  value: T[];
}

export interface ActionResponse<T> {
  value: T;
}
