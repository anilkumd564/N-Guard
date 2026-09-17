/**
 * N-Guard — Service Layer
 *
 * NGuardService  : Tenant/project-scoped operations for architects and consultants.
 * AdminService   : Tenant administration and knowledge management.
 *
 * Phase 2: Projects writable, SAPDeploymentProfiles, createProject action.
 * Phase 3: DesignRequests enhanced (all new fields visible),
 *           RelatedWorkItems exposed, importRequirements / exportRequirements actions.
 */

using { nguard } from '../db/schema';

@path: '/api/v1'
service NGuardService {

  // ── Tenants (read-only) ───────────────────────────────────────────────────
  @readonly
  entity Tenants as projection on nguard.Tenants
    excluding { projects, userActors };

  // ── Projects ──────────────────────────────────────────────────────────────
  entity Projects as projection on nguard.Projects
    excluding { designRequests, knowledgeDocs };

  // ── Deployment Profiles ───────────────────────────────────────────────────
  entity SAPDeploymentProfiles as projection on nguard.SAPDeploymentProfiles;

  // ── User Actors ───────────────────────────────────────────────────────────
  @readonly
  entity UserActors as projection on nguard.UserActors
    excluding { tenant };

  // ── Requirements Workspace ────────────────────────────────────────────────
  /**
   * DesignRequests exposes the full Phase 3 workspace model.
   * Excludes assessments from list responses (expand explicitly when needed).
   * Server-side validation enforces project isolation and required fields.
   */
  entity DesignRequests as projection on nguard.DesignRequests
    excluding { assessments, relatedItems };

  /**
   * RelatedWorkItems — cross-references between workspace items.
   */
  entity RelatedWorkItems as projection on nguard.RelatedWorkItems;

  // ── Assessments (read-only) ───────────────────────────────────────────────
  @readonly
  entity ComplianceAssessments as projection on nguard.ComplianceAssessments;

  @readonly
  entity Recommendations as projection on nguard.Recommendations;

  // ── Unbound Actions ───────────────────────────────────────────────────────

  /** Create project + initial deployment profile (tenant auto-resolved). */
  action createProject(
    name               : String,
    description        : String,
    edition            : String,
    release            : String,
    transformationType : String,
    cleanCorePolicy    : String,
    profileName        : String,
    deploymentModel    : String,
    profileRelease     : String,
    country            : String,
    industry           : String,
    processAreas       : String,
    sourceSystemDescription : String
  ) returns Projects;

  /**
   * Import requirements/user stories/CRs from a CSV string.
   *
   * The CSV must have a header row.  Required columns: workItemType, title, description.
   * Optional columns: businessObjective, businessProcess, module, priority, source,
   *   owner, tags, externalReference.
   *
   * Returns the number of successfully imported rows and a JSON array of
   * row-level errors so the caller can display per-row feedback.
   */
  action importRequirements(
    projectId : UUID,
    csv       : LargeString
  ) returns {
    imported   : Integer;
    errorCount : Integer;
    errors     : LargeString;   // JSON: Array<{ row: number, field: string, message: string }>
  };

  /**
   * Export requirements for a project as a CSV string.
   * Optionally filtered by workItemType.
   */
  action exportRequirements(
    projectId    : UUID,
    workItemType : String
  ) returns LargeString;

  /** Submit a design request for assessment. */
  action submitForAssessment(designRequestId : UUID)
    returns ComplianceAssessments;

  /** Human architect approval (rule 5). */
  action approveAssessment(assessmentId : UUID, notes : String)
    returns Boolean;

  /** Reject and request revision. */
  action rejectAssessment(assessmentId : UUID, reason : String)
    returns Boolean;
}

// ─── Admin Service ────────────────────────────────────────────────────────────

@path: '/api/v1/admin'
service AdminService {

  entity Tenants             as projection on nguard.Tenants
    excluding { projects };
  entity Projects            as projection on nguard.Projects;
  entity SAPDeploymentProfiles as projection on nguard.SAPDeploymentProfiles;
  entity UserActors          as projection on nguard.UserActors;
  entity DesignRequests      as projection on nguard.DesignRequests;
  entity RelatedWorkItems    as projection on nguard.RelatedWorkItems;

  entity KnowledgeDocuments  as projection on nguard.KnowledgeDocuments
    excluding { embedding };

  @readonly
  entity AuditLogs as projection on nguard.AuditLogs;

  action embedDocument(documentId : UUID) returns Boolean;
}
