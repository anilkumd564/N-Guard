/**
 * N-Guard — Core Domain Model
 *
 * Permanent architecture rules:
 *  - Every entity is tenant/project scoped (rule 10).
 *  - S/4HANA edition is a first-class field; never inferred (rule 2).
 *  - Knowledge retrieval is filtered by edition/release BEFORE semantic search (rule 3).
 *
 * Phase 2: SAPProduct, TransformationType, CleanCorePolicy, SAPDeploymentProfiles, UserActors
 * Phase 3: WorkItemType, WorkItemPriority, enhanced DesignRequests, RelatedWorkItems
 * Phase 4: KnowledgeSourceType, IngestionStatus, KnowledgeSources, KnowledgeChunks, IngestionJobs;
 *           KnowledgeDocuments enhanced with full metadata fields
 */

namespace nguard;

using { cuid, managed, temporal } from '@sap/cds/common';

// ─── Phase 1–3 Enumerations ───────────────────────────────────────────────────

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
  PENDING = 'PENDING'; PROCESSING = 'PROCESSING'; COMPLETED = 'COMPLETED'; FAILED = 'FAILED';
}

type RequestStatus : String(20) enum {
  DRAFT = 'DRAFT'; SUBMITTED = 'SUBMITTED'; ASSESSING = 'ASSESSING';
  ASSESSED = 'ASSESSED'; APPROVED = 'APPROVED'; REJECTED = 'REJECTED';
}

type DocType : String(50) enum {
  SAP_BEST_PRACTICE = 'SAP_BEST_PRACTICE'; RELEASE_NOTE = 'RELEASE_NOTE';
  CUSTOMIZING_GUIDE = 'CUSTOMIZING_GUIDE'; EXTENSIBILITY_GUIDE = 'EXTENSIBILITY_GUIDE';
  FIT_GAP_ANALYSIS = 'FIT_GAP_ANALYSIS'; ARCHITECTURE_DECISION = 'ARCHITECTURE_DECISION';
  OTHER = 'OTHER';
}

type SAPProduct : String(50) enum { S4HANA = 'S4HANA'; }

type TransformationType : String(20) enum {
  GREENFIELD = 'GREENFIELD'; BROWNFIELD = 'BROWNFIELD';
  SELECTIVE = 'SELECTIVE'; OTHER = 'OTHER';
}

type CleanCorePolicy : String(20) enum {
  STRICT = 'STRICT'; STANDARD = 'STANDARD'; FLEXIBLE = 'FLEXIBLE'; NOT_SET = 'NOT_SET';
}

type WorkItemType : String(20) enum {
  REQUIREMENT = 'REQUIREMENT'; USER_STORY = 'USER_STORY';
  CHANGE_REQUEST = 'CHANGE_REQUEST'; DESIGN_ARTIFACT = 'DESIGN_ARTIFACT';
}

type WorkItemPriority : String(20) enum {
  CRITICAL = 'CRITICAL'; HIGH = 'HIGH'; MEDIUM = 'MEDIUM'; LOW = 'LOW';
}

// ─── Phase 4 Enumerations ─────────────────────────────────────────────────────

/**
 * Classification of a knowledge source's origin.
 */
type KnowledgeSourceType : String(30) enum {
  SAP_HELP_PORTAL    = 'SAP_HELP_PORTAL';     // help.sap.com, documentation
  SAP_BEST_PRACTICE  = 'SAP_BEST_PRACTICE';    // SAP Best Practice Explorer, Signavio
  RELEASE_NOTE       = 'RELEASE_NOTE';          // SAP Release Notes / What's New
  PARTNER_CONTENT    = 'PARTNER_CONTENT';       // Certified partner knowledge
  INTERNAL_GUIDELINE = 'INTERNAL_GUIDELINE';    // Customer / project-internal
  FILE_UPLOAD        = 'FILE_UPLOAD';           // Manually uploaded document
}

/**
 * Authority classification for knowledge content.
 * Controls how evidence is weighted in assessments.
 */
type AuthorityLevel : String(20) enum {
  SAP_OFFICIAL = 'SAP_OFFICIAL';  // SAP official documentation
  PARTNER      = 'PARTNER';       // Certified partner / SI content
  INTERNAL     = 'INTERNAL';      // Customer / project-internal
}

/**
 * Status of document ingestion processing.
 */
type IngestionStatus : String(20) enum {
  PENDING    = 'PENDING';    // Queued, not yet started
  PROCESSING = 'PROCESSING'; // Extraction / chunking in progress
  COMPLETED  = 'COMPLETED';  // Ingested successfully
  FAILED     = 'FAILED';     // Ingestion failed; see ingestionError
  SKIPPED    = 'SKIPPED';    // No extractable content found
}

// ─── Core Entities ────────────────────────────────────────────────────────────

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

entity DesignRequests : cuid, managed {
  project           : Association to Projects not null;
  tenant            : Association to Tenants  not null;
  workItemType      : WorkItemType default 'REQUIREMENT';
  title             : String(500)  not null;
  description       : LargeString  not null;
  businessObjective : String(1000);
  businessProcess   : String(200);
  module            : String(100);
  priority          : WorkItemPriority default 'MEDIUM';
  source            : String(200);
  requestedBy       : String(200);
  owner             : String(200);
  tags              : LargeString;
  externalReference : String(300);
  deploymentProfile : Association to SAPDeploymentProfiles;
  status            : RequestStatus default 'DRAFT';
  assessments       : Composition of many ComplianceAssessments
                        on assessments.designRequest = $self;
  relatedItems      : Composition of many RelatedWorkItems
                        on relatedItems.sourceItem = $self;
}

entity RelatedWorkItems : cuid {
  sourceItem : Association to DesignRequests not null;
  targetItem : Association to DesignRequests not null;
  relation   : String(50) default 'RELATES_TO';
  note       : String(500);
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
  // Phase 7: F1-F8 Fit Classification fields
  fitClassification          : String(5);    // F1|F2|F3|F4|F5|F6|F7|F8
  deploymentCompatibility    : String(20);   // DP-OP|DP-PCE|DP-PUB|DP-ALL|DP-NA|DP-VERIFY
  evidenceConfidence         : String(30);   // VERIFIED|LIKELY|NEEDS_SME_REVIEW|INSUFFICIENT_EVIDENCE
  businessIntentSummary      : String(1000);
  processClassification      : String(200);
  targetDeploymentContext    : String(500);
  standardCapability         : String(500);
  gapDescription             : LargeString;
  configurationOpportunity   : LargeString;
  customizationRiskStatement : LargeString;
  recommendedNextAction      : String(1000);
  assumptions                : LargeString; // JSON: string[]
  unknowns                   : LargeString; // JSON: string[]
  humanReviewRequired        : Boolean default false;
  agentSchemaVersion         : String(10);  // '1.0' (Phase 6) or '2.0' (Phase 7)
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

// ─── Phase 4: Knowledge Ingestion Entities ────────────────────────────────────

/**
 * KnowledgeSource represents a named origin of SAP knowledge artifacts.
 * Examples: "SAP Help Portal S/4HANA 2024", "Internal Architecture Guidelines",
 *           "Signavio Process Content".
 *
 * Every KnowledgeDocument is linked to a source for traceability.
 * Scoped by tenant; project is optional (null = tenant-wide source).
 */
entity KnowledgeSources : cuid, managed {
  tenant         : Association to Tenants;       // null = system/global source
  project        : Association to Projects;       // null = tenant-wide
  name           : String(200) not null;
  description    : String(1000);
  sourceType     : KnowledgeSourceType default 'FILE_UPLOAD';
  baseUrl        : String(500);                  // Base URL for web sources
  authorityLevel : AuthorityLevel default 'INTERNAL';
  isActive       : Boolean default true;
  documents      : Composition of many KnowledgeDocuments
                     on documents.knowledgeSource = $self;
}

/**
 * KnowledgeDocuments store ingested knowledge content.
 *
 * Phase 4 enhancements (backward-compatible additions):
 *  - knowledgeSource association
 *  - full metadata fields (authorityLevel, processArea, scopeItem, etc.)
 *  - ingestion status and error tracking
 *  - chunkCount summary field
 *
 * Retrieval rule (architecture rule 3):
 *  Filter by tenant → project → edition → release before semantic search.
 */
entity KnowledgeDocuments : cuid, managed {
  tenant           : Association to Tenants;      // null = global/system knowledge
  project          : Association to Projects;      // null = tenant-wide
  knowledgeSource  : Association to KnowledgeSources; // Phase 4: source link
  edition          : S4Edition;                   // null = all editions
  release          : S4Release;                   // null = all releases
  releaseFrom      : S4Release;                   // earliest applicable release
  releaseTo        : S4Release;                   // latest applicable (null = current)
  title            : String(500) not null;
  content          : LargeString not null;         // full extracted text
  source           : String(1000);                 // URL or citation
  docType          : DocType default 'OTHER';
  // Phase 4 metadata fields:
  authorityLevel   : AuthorityLevel default 'INTERNAL';
  country          : String(100);                 // ISO country or 'GLOBAL'
  industry         : String(100);
  processArea      : String(200);                 // e.g. 'Order-to-Cash'
  processId        : String(100);                 // SAP process ID
  scopeItem        : String(50);                  // e.g. 'BH1', 'J45'
  capability       : String(200);
  extensionType    : String(100);                 // e.g. 'In-App', 'Side-by-Side'
  documentVersion  : String(50);
  documentDate     : Date;
  retrievalDate    : Timestamp;
  language         : String(10) default 'EN';
  mimeType         : String(100);                 // original file MIME type
  fileSizeBytes    : Integer;
  // Ingestion tracking:
  ingestionStatus  : IngestionStatus default 'PENDING';
  ingestionError   : String(2000);
  chunkCount       : Integer default 0;
  // Embeddings (Phase 5 will populate):
  embedding        : LargeString;               // JSON number[] in SQLite; REAL_VECTOR in HANA
  isActive         : Boolean default true;
  chunks           : Composition of many KnowledgeChunks on chunks.document = $self;
}

/**
 * KnowledgeChunks are text segments produced by chunking a KnowledgeDocument.
 *
 * Each chunk inherits the parent document's metadata to support efficient
 * edition/release/tenant filtering at retrieval time (rule 3).
 *
 * Embeddings are populated in Phase 5 (vector indexing).
 * No LLM calls occur in Phase 4 — chunking is pure text processing.
 */
entity KnowledgeChunks : cuid {
  document       : Association to KnowledgeDocuments not null;
  tenant         : Association to Tenants;          // denormalized for efficient filtering
  project        : Association to Projects;
  sequence       : Integer not null;                // 1-based chunk index
  text           : LargeString not null;
  tokenCount     : Integer;                         // approximate word/token count
  // Denormalized metadata for retrieval filtering (rule 3):
  edition        : S4Edition;
  release        : S4Release;
  country        : String(100);
  industry       : String(100);
  processArea    : String(200);
  scopeItem      : String(50);
  authorityLevel : AuthorityLevel default 'INTERNAL';
  // Embedding (Phase 5):
  embedding      : LargeString;                     // JSON number[] → REAL_VECTOR in HANA
}

/**
 * IngestionJobs track the lifecycle of a document ingestion request.
 *
 * A job is created when a file is submitted for ingestion.
 * The handler processes extraction, chunking, and metadata assignment
 * asynchronously. No vector embedding occurs in Phase 4.
 */
entity IngestionJobs : cuid, managed {
  tenant          : Association to Tenants;
  project         : Association to Projects;
  knowledgeSource : Association to KnowledgeSources;
  document        : Association to KnowledgeDocuments;
  status          : IngestionStatus default 'PENDING';
  sourceFileName  : String(500);
  sourceMimeType  : String(100);
  extractedLength : Integer;             // character count of extracted text
  chunkCount      : Integer default 0;
  error           : String(2000);
  startedAt       : Timestamp;
  completedAt     : Timestamp;
}

// ─── Phase 6: Agent Orchestration Persistence ────────────────────────────────

/**
 * AgentRuns persists the metadata of every agent orchestration execution.
 * Enables auditing and debugging of AI-driven assessments (architecture rule 4).
 * Every run is linked to a DesignRequest and (optionally) a ComplianceAssessment.
 */
entity AgentRuns : cuid, managed {
  designRequest    : Association to DesignRequests    not null;
  project          : Association to Projects          not null;
  tenant           : Association to Tenants           not null;
  assessment       : Association to ComplianceAssessments;
  status           : String(20)   not null;  // PENDING|RUNNING|COMPLETED|FAILED|TIMEOUT
  modelProvider    : String(100);
  modelName        : String(100);
  promptTokens     : Integer default 0;
  completionTokens : Integer default 0;
  latencyMs        : Integer default 0;
  retryCount       : Integer default 0;
  error            : String(2000);
  evidenceCount    : Integer default 0;
  schemaVersion    : String(20);
  validationPassed : Boolean;
  startedAt        : Timestamp;
  completedAt      : Timestamp;
  evidenceRefs     : Composition of many EvidenceReferences on evidenceRefs.agentRun = $self;
}

/**
 * EvidenceReferences records which knowledge chunks were used as evidence
 * in each AgentRun.  Enables full traceability from verdict to source.
 */
entity EvidenceReferences : cuid {
  agentRun          : Association to AgentRuns not null;
  tenant            : Association to Tenants;
  chunkId           : String(500)  not null;
  documentId        : String(500);
  knowledgeSourceId : String(500);
  title             : String(500);
  excerpt           : LargeString;
  edition           : S4Edition;
  release           : S4Release;
  authorityLevel    : String(20);
  source            : String(1000);
  score             : Decimal(5, 4);  // 0.0000 – 1.0000
}

// ─── Phase 8: Cross-Edition Comparison Persistence ───────────────────────────

/**
 * CrossEditionComparisons stores the result of comparing all three S/4HANA
 * editions for a single business requirement.
 * Evidence is always partitioned by edition (architecture rule 2).
 */
entity CrossEditionComparisons : cuid, managed {
  designRequest       : Association to DesignRequests not null;
  project             : Association to Projects       not null;
  tenant              : Association to Tenants        not null;
  businessIntent      : String(1000);
  processArea         : String(200);
  summary             : LargeString;          // JSON: CrossEditionSummary
  evidencePartitioned : Boolean default true;
  schemaVersion       : String(10);
  completedAt         : Timestamp;
  editionResults      : Composition of many EditionComparisonResults
                          on editionResults.comparison = $self;
}

/**
 * EditionComparisonResults stores one row per S/4HANA edition per comparison.
 * Evidence references are JSON-serialized from the agent layer.
 */
entity EditionComparisonResults : cuid {
  comparison              : Association to CrossEditionComparisons not null;
  edition                 : S4Edition         not null;
  fitClassification       : String(5);        // F1|F2|F3|F4|F5|F6|F7|F8
  deploymentCompatibility : String(20);       // DP-OP|DP-PCE|…
  evidenceConfidence      : String(30);       // VERIFIED|LIKELY|…
  confidence              : Decimal(4, 3);
  standardCapability      : String(500);
  gapDescription          : LargeString;
  configurationApproach   : LargeString;
  extensibilityOptions    : LargeString;
  majorConstraints        : LargeString;
  cleanCoreImplications   : LargeString;
  processIdentifiers      : LargeString;      // JSON: string[]
  evidenceRefs            : LargeString;      // JSON: EvidenceReference[]
  agentRunId              : String(100);
  humanReviewRequired     : Boolean default false;
  validationPassed        : Boolean default false;
}

// ─── Phase 9: Clean Core Analysis Persistence ────────────────────────────────

/**
 * CleanCoreAnalyses stores the result of running the CleanCoreAnalyzer
 * against a design request/assessment.  Enables audit trail of all
 * Clean Core governance decisions.
 */
entity CleanCoreAnalyses : cuid, managed {
  designRequest              : Association to DesignRequests not null;
  project                    : Association to Projects       not null;
  tenant                     : Association to Tenants        not null;
  assessment                 : Association to ComplianceAssessments;
  // Analysis metadata
  catalogVersion             : String(20);
  schemaVersion              : String(10);
  edition                    : S4Edition   not null;
  release                    : S4Release;
  cleanCorePolicy            : String(20);
  fitClassification          : String(5);   // F1-F8 from Phase 7 assessment
  proposedApproach           : LargeString;
  // Analysis result
  preferredTechnique         : String(50);  // ExtensibilityTechnique
  cleanCoreTier              : String(10);  // TIER_1|TIER_2|TIER_3|TIER_4
  riskLevel                  : String(20);  // LOW|MEDIUM|HIGH|CRITICAL
  requiredArchitectureReview : Boolean default false;
  requiresException          : Boolean default false;
  saferAlternative           : String(50);
  concerns                   : LargeString; // JSON: string[]
  riskFactors                : LargeString; // JSON: string[]
  unknowns                   : LargeString; // JSON: string[]
  techniqueApplicability     : LargeString; // JSON: TechniqueApplicability[]
}

/**
 * AuditLogs — immutable event log.
 */
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
