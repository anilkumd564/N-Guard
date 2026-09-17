/**
 * N-Guard — Core Domain Model
 *
 * Permanent architecture rules enforced here:
 *  - Every entity is tenant_id + project_id scoped (rules 1, 10).
 *  - S/4HANA edition is a first-class field; never inferred or defaulted (rule 2).
 *  - Knowledge retrieval is filtered by edition/release before semantic search (rule 3).
 *  - Every entity carries managed timestamps via CAP aspects.
 *
 * Phase 2 additions:
 *  - SAPProduct, TransformationType, CleanCorePolicy enums
 *  - SAPDeploymentProfiles entity
 *  - UserActors entity
 *  - Projects enhanced
 *
 * Phase 3 additions:
 *  - WorkItemType, WorkItemPriority enums
 *  - DesignRequests enhanced with type, priority, objective, source, owner, tags, etc.
 *  - RelatedWorkItems entity (cross-references between requirements/CRs/user stories)
 */

namespace nguard;

using { cuid, managed, temporal } from '@sap/cds/common';

// ─── Enumerations ────────────────────────────────────────────────────────────

type S4Edition : String(30) enum {
  ON_PREMISE    = 'ON_PREMISE';
  CLOUD_PRIVATE = 'CLOUD_PRIVATE';
  CLOUD_PUBLIC  = 'CLOUD_PUBLIC';
}

type S4Release : String(10);

type Verdict : String(30) enum {
  FIT_TO_STANDARD    = 'FIT_TO_STANDARD';
  ACCEPTABLE_GAP     = 'ACCEPTABLE_GAP';
  CUSTOMIZATION_RISK = 'CUSTOMIZATION_RISK';
  REJECT             = 'REJECT';
  NEEDS_REVIEW       = 'NEEDS_REVIEW';
}

type AssessmentStatus : String(20) enum {
  PENDING    = 'PENDING';
  PROCESSING = 'PROCESSING';
  COMPLETED  = 'COMPLETED';
  FAILED     = 'FAILED';
}

type RequestStatus : String(20) enum {
  DRAFT      = 'DRAFT';
  SUBMITTED  = 'SUBMITTED';
  ASSESSING  = 'ASSESSING';
  ASSESSED   = 'ASSESSED';
  APPROVED   = 'APPROVED';
  REJECTED   = 'REJECTED';
}

type DocType : String(50) enum {
  SAP_BEST_PRACTICE     = 'SAP_BEST_PRACTICE';
  RELEASE_NOTE          = 'RELEASE_NOTE';
  CUSTOMIZING_GUIDE     = 'CUSTOMIZING_GUIDE';
  EXTENSIBILITY_GUIDE   = 'EXTENSIBILITY_GUIDE';
  FIT_GAP_ANALYSIS      = 'FIT_GAP_ANALYSIS';
  ARCHITECTURE_DECISION = 'ARCHITECTURE_DECISION';
  OTHER                 = 'OTHER';
}

// ─── Phase 2 Enumerations ─────────────────────────────────────────────────────

type SAPProduct : String(50) enum {
  S4HANA = 'S4HANA';
}

type TransformationType : String(20) enum {
  GREENFIELD = 'GREENFIELD';
  BROWNFIELD = 'BROWNFIELD';
  SELECTIVE  = 'SELECTIVE';
  OTHER      = 'OTHER';
}

type CleanCorePolicy : String(20) enum {
  STRICT   = 'STRICT';
  STANDARD = 'STANDARD';
  FLEXIBLE = 'FLEXIBLE';
  NOT_SET  = 'NOT_SET';
}

// ─── Phase 3 Enumerations ─────────────────────────────────────────────────────

/**
 * Workspace item type discriminant.
 * All four types share the DesignRequests entity; the workItemType
 * field identifies which flavour the record represents.
 */
type WorkItemType : String(20) enum {
  REQUIREMENT      = 'REQUIREMENT';      // Business requirement / functional requirement
  USER_STORY       = 'USER_STORY';       // Agile user story
  CHANGE_REQUEST   = 'CHANGE_REQUEST';   // Formal change request / deviation request
  DESIGN_ARTIFACT  = 'DESIGN_ARTIFACT';  // Design decision, blueprint reference, or artefact link
}

/**
 * Work item priority.  Applies to all workItemTypes.
 */
type WorkItemPriority : String(20) enum {
  CRITICAL = 'CRITICAL';
  HIGH     = 'HIGH';
  MEDIUM   = 'MEDIUM';
  LOW      = 'LOW';
}

// ─── Core Entities ───────────────────────────────────────────────────────────

entity Tenants : cuid, managed {
  name        : String(200) not null;
  description : String(1000);
  isActive    : Boolean default true;
  projects    : Composition of many Projects on projects.tenant = $self;
  userActors  : Composition of many UserActors on userActors.tenant = $self;
}

entity Projects : cuid, managed {
  tenant             : Association to Tenants not null;
  name               : String(200) not null;
  description        : String(2000);
  edition            : S4Edition not null;
  release            : S4Release;
  status             : String(20) default 'ACTIVE';
  transformationType : TransformationType;
  cleanCorePolicy    : CleanCorePolicy default 'NOT_SET';
  deploymentProfiles : Composition of many SAPDeploymentProfiles
                         on deploymentProfiles.project = $self;
  designRequests     : Composition of many DesignRequests on designRequests.project = $self;
  knowledgeDocs      : Composition of many KnowledgeDocuments on knowledgeDocs.project = $self;
}

entity SAPDeploymentProfiles : cuid, managed {
  project                 : Association to Projects not null;
  tenant                  : Association to Tenants  not null;
  profileName             : String(200) not null;
  sapProduct              : SAPProduct default 'S4HANA';
  deploymentModel         : S4Edition not null;
  release                 : S4Release;
  releaseFrom             : S4Release;
  releaseTo               : S4Release;
  country                 : String(100);
  industry                : String(100);
  transformationType      : TransformationType;
  cleanCorePolicy         : CleanCorePolicy default 'NOT_SET';
  processAreas            : LargeString;
  sourceSystemDescription : String(1000);
  isPrimary               : Boolean default false;
  isActive                : Boolean default true;
}

entity UserActors : cuid, managed {
  tenant      : Association to Tenants;
  externalId  : String(500) not null;
  displayName : String(200);
  email       : String(300);
  roles       : LargeString;
  isActive    : Boolean default true;
}

/**
 * DesignRequests is the Phase 3 Requirements Workspace entity.
 *
 * Unified model for Business Requirements, User Stories, Change Requests,
 * and Design Artifacts via the workItemType discriminant.
 *
 * Phase 3 additions (backward-compatible):
 *  - workItemType: discriminant for the four item types
 *  - priority, businessObjective, source, owner, tags, externalReference
 *  - deploymentProfile association (optional link to a specific profile)
 *  - relatedItems composition
 *
 * Every record remains scoped by project + tenant (rule 10).
 * Multiple ComplianceAssessments can be attached to one DesignRequest
 * (ready for Phase 7+) via the assessments composition.
 */
entity DesignRequests : cuid, managed {
  project           : Association to Projects not null;
  tenant            : Association to Tenants  not null;
  workItemType      : WorkItemType default 'REQUIREMENT';
  title             : String(500)  not null;
  description       : LargeString  not null;
  businessObjective : String(1000);          // Business value / why this matters
  businessProcess   : String(200);           // e.g. 'Order-to-Cash'
  module            : String(100);           // SAP module, e.g. 'SD', 'MM', 'FI'
  priority          : WorkItemPriority default 'MEDIUM';
  source            : String(200);           // Origin: workshop, migration analysis, business user
  requestedBy       : String(200);           // Submitting person
  owner             : String(200);           // Responsible person / team
  tags              : LargeString;           // JSON: string[]
  externalReference : String(300);           // Jira, ADO, ServiceNow ticket reference
  deploymentProfile : Association to SAPDeploymentProfiles; // Optional: profile context
  status            : RequestStatus default 'DRAFT';
  assessments       : Composition of many ComplianceAssessments
                        on assessments.designRequest = $self;
  relatedItems      : Composition of many RelatedWorkItems
                        on relatedItems.sourceItem = $self;
}

/**
 * RelatedWorkItems captures cross-references between workspace items.
 * e.g. a Change Request that DEPENDS_ON a Business Requirement.
 */
entity RelatedWorkItems : cuid {
  sourceItem  : Association to DesignRequests not null;
  targetItem  : Association to DesignRequests not null;
  relation    : String(50) default 'RELATES_TO';
  // Supported relations: RELATES_TO | BLOCKS | DEPENDS_ON | DUPLICATES | CHILD_OF | PARENT_OF
  note        : String(500);
}

entity ComplianceAssessments : cuid, managed {
  designRequest   : Association to DesignRequests not null;
  project         : Association to Projects       not null;
  tenant          : Association to Tenants        not null;
  verdict         : Verdict;
  status          : AssessmentStatus default 'PENDING';
  rationale       : LargeString;
  evidenceSources : LargeString;
  confidence      : Decimal(4, 3);
  agentVersion    : String(50);
  processedAt     : Timestamp;
  recommendations : Composition of many Recommendations
                      on recommendations.assessment = $self;
}

entity Recommendations : cuid {
  assessment  : Association to ComplianceAssessments not null;
  sequence    : Integer not null;
  type        : String(50);
  description : LargeString not null;
  effort      : String(20);
  priority    : String(20);
  rationale   : LargeString;
}

entity KnowledgeDocuments : cuid, managed {
  tenant      : Association to Tenants;
  project     : Association to Projects;
  edition     : S4Edition;
  release     : S4Release;
  title       : String(500) not null;
  content     : LargeString not null;
  source      : String(1000);
  docType     : DocType default 'OTHER';
  embedding   : LargeString;
  isActive    : Boolean default true;
}

entity AuditLogs : cuid {
  tenant      : Association to Tenants;
  project     : Association to Projects;
  entityType  : String(100) not null;
  entityId    : UUID        not null;
  action      : String(50)  not null;
  actor       : String(200);
  details     : LargeString;
  occurredAt  : Timestamp   not null;
}
