/**
 * N-Guard — Service Layer
 *
 * Phase 2: Projects writable, SAPDeploymentProfiles, createProject action.
 * Phase 3: Enhanced DesignRequests, RelatedWorkItems, importRequirements/exportRequirements.
 * Phase 4: KnowledgeSources, KnowledgeChunks, IngestionJobs exposed;
 *           ingestDocument, createKnowledgeSource, deleteKnowledgeSource actions.
 */

using { nguard } from '../db/schema';

@path: '/api/v1'
service NGuardService {

  @readonly entity Tenants as projection on nguard.Tenants
    excluding { projects, userActors };

  entity Projects as projection on nguard.Projects
    excluding { designRequests, knowledgeDocs };

  entity SAPDeploymentProfiles as projection on nguard.SAPDeploymentProfiles;

  @readonly entity UserActors as projection on nguard.UserActors
    excluding { tenant };

  entity DesignRequests as projection on nguard.DesignRequests
    excluding { assessments, relatedItems };

  entity RelatedWorkItems as projection on nguard.RelatedWorkItems;

  @readonly entity ComplianceAssessments as projection on nguard.ComplianceAssessments;
  @readonly entity Recommendations       as projection on nguard.Recommendations;

  // ── Phase 4: Knowledge Base ────────────────────────────────────────────────

  /**
   * KnowledgeSources — named origins for knowledge documents.
   * Read/write: users can manage sources from the Knowledge admin UI.
   */
  entity KnowledgeSources as projection on nguard.KnowledgeSources
    excluding { documents };

  /**
   * KnowledgeDocuments — list/read ingested documents.
   * Write access is via the ingestDocument action (not direct POST).
   * Excludes embedding vector (internal; never exposed via API).
   */
  entity KnowledgeDocuments as projection on nguard.KnowledgeDocuments
    excluding { embedding, chunks };

  /**
   * KnowledgeChunks — read-only inspection of document chunks.
   * Used for admin preview; never used for semantic search directly.
   */
  @readonly
  entity KnowledgeChunks as projection on nguard.KnowledgeChunks
    excluding { embedding };

  /**
   * IngestionJobs — status tracking for ingestion operations.
   */
  @readonly
  entity IngestionJobs as projection on nguard.IngestionJobs;

  // ── Phase 6: Agent Orchestration ─────────────────────────────────────────
  /** AgentRuns — audit trail of every orchestration execution. */
  @readonly
  entity AgentRuns as projection on nguard.AgentRuns
    excluding { evidenceRefs };

  /** EvidenceReferences — traceable evidence used in each run. */
  @readonly
  entity EvidenceReferences as projection on nguard.EvidenceReferences;

  // ── Phase 9: Clean Core Analysis ─────────────────────────────────────────
  /** CleanCoreAnalyses — audit trail of Clean Core governance decisions. */
  @readonly
  entity CleanCoreAnalyses as projection on nguard.CleanCoreAnalyses;

  // ── Phase 8: Cross-Edition Comparison ────────────────────────────────────
  /** CrossEditionComparisons — audit trail of comparison runs. */
  @readonly
  entity CrossEditionComparisons as projection on nguard.CrossEditionComparisons
    excluding { editionResults };

  /** EditionComparisonResults — per-edition results of a comparison. */
  @readonly
  entity EditionComparisonResults as projection on nguard.EditionComparisonResults;

  // ── Unbound Actions ────────────────────────────────────────────────────────

  action createProject(
    name: String, description: String, edition: String, release: String,
    transformationType: String, cleanCorePolicy: String,
    profileName: String, deploymentModel: String, profileRelease: String,
    country: String, industry: String, processAreas: String,
    sourceSystemDescription: String
  ) returns Projects;

  /**
   * Create a knowledge source (named repository of documents).
   */
  action createKnowledgeSource(
    name           : String,
    description    : String,
    sourceType     : String,
    authorityLevel : String,
    baseUrl        : String,
    projectId      : UUID
  ) returns KnowledgeSources;

  /**
   * Ingest a document into a knowledge source.
   *
   * The document content is passed as a Base64-encoded string to avoid
   * binary transport issues with the CAP REST/OData protocol.
   * The handler decodes, extracts text, chunks, and creates KnowledgeDocument
   * + KnowledgeChunk records. No LLM embedding occurs in Phase 4.
   *
   * Metadata fields (edition, release, country, etc.) are optional;
   * they default to the KnowledgeSource's values when not provided.
   */
  action ingestDocument(
    knowledgeSourceId : UUID,
    fileName          : String,
    mimeType          : String,
    contentBase64     : LargeString,
    title             : String,
    edition           : String,
    release           : String,
    country           : String,
    industry          : String,
    processArea       : String,
    scopeItem         : String,
    authorityLevel    : String,
    docType           : String,
    language          : String
  ) returns IngestionJobs;

  /**
   * Delete a knowledge source and all its associated documents/chunks.
   */
  action deleteKnowledgeSource(knowledgeSourceId : UUID) returns Boolean;

  /**
   * Delete a specific knowledge document and its chunks.
   */
  action deleteKnowledgeDocument(documentId : UUID) returns Boolean;

  action importRequirements(projectId : UUID, csv : LargeString)
    returns { imported: Integer; errorCount: Integer; errors: LargeString; };

  action exportRequirements(projectId : UUID, workItemType : String)
    returns LargeString;

  action submitForAssessment(designRequestId : UUID)
    returns ComplianceAssessments;

  /**
   * Run a cross-edition comparison for a design request.
   * Runs three independent FitAssessment contexts (one per S/4HANA edition).
   * Returns the persisted CrossEditionComparisons record.
   */
  action runCrossEditionComparison(designRequestId : UUID)
    returns CrossEditionComparisons;

  /**
   * Run Clean Core analysis for a design request.
   * Uses the versioned rule catalog — NOT buried in prompt text.
   * Returns the persisted CleanCoreAnalyses record.
   */
  action runCleanCoreAnalysis(
    designRequestId  : UUID,
    proposedApproach : String
  ) returns CleanCoreAnalyses;

  action approveAssessment(assessmentId : UUID, notes : String)
    returns Boolean;

  action rejectAssessment(assessmentId : UUID, reason : String)
    returns Boolean;
}

@path: '/api/v1/admin'
service AdminService {

  entity Tenants               as projection on nguard.Tenants        excluding { projects };
  entity Projects              as projection on nguard.Projects;
  entity SAPDeploymentProfiles as projection on nguard.SAPDeploymentProfiles;
  entity UserActors            as projection on nguard.UserActors;
  entity DesignRequests        as projection on nguard.DesignRequests;
  entity RelatedWorkItems      as projection on nguard.RelatedWorkItems;
  entity KnowledgeSources      as projection on nguard.KnowledgeSources;
  entity KnowledgeDocuments    as projection on nguard.KnowledgeDocuments
    excluding { embedding };
  entity KnowledgeChunks       as projection on nguard.KnowledgeChunks
    excluding { embedding };
  entity IngestionJobs         as projection on nguard.IngestionJobs;

  @readonly entity AuditLogs   as projection on nguard.AuditLogs;

  action embedDocument(documentId : UUID) returns Boolean;

  /**
   * Embed all chunks of a knowledge document into the vector store.
   * Called after ingestion completes (Phase 5: connects Phase 4 chunks to vector index).
   * Returns the number of chunks indexed.
   */
  action embedChunks(documentId : UUID) returns Integer;
}
