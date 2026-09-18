/**
 * N-Guard — Async Job Types (Phase 12)
 *
 * Typed contracts for the durable asynchronous job framework.
 * All long-running operations (ingestion, bulk import, batch assessment,
 * knowledge re-indexing) execute through this model — never inside a
 * browser HTTP request.
 *
 * Architecture rules:
 *  - The queue implementation is replaceable: local adapter → BTP Job Scheduling
 *    without rewriting business logic.
 *  - Job states are persisted and recoverable after server restart.
 *  - No credentials are stored in job payloads.
 */

// ─── Job Types ────────────────────────────────────────────────────────────────

/**
 * The class of work a job performs.
 * Add new types here; keep the switch/handler in AsyncJobQueue.
 */
export type JobType =
  | 'DOCUMENT_INGESTION'   // Ingest + chunk + embed a document
  | 'BULK_REQUIREMENT_IMPORT' // CSV import of requirements
  | 'BATCH_ASSESSMENT'     // Run assessments for a list of design requests
  | 'KNOWLEDGE_REINDEX'    // Re-embed all chunks for a knowledge source
  | 'INTEGRATION_SYNC';    // Sync from an external system (placeholder)

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  DOCUMENT_INGESTION       : 'Document Ingestion',
  BULK_REQUIREMENT_IMPORT  : 'Bulk Requirement Import',
  BATCH_ASSESSMENT         : 'Batch Assessment',
  KNOWLEDGE_REINDEX        : 'Knowledge Re-index',
  INTEGRATION_SYNC         : 'Integration Sync',
};

// ─── Job Status ───────────────────────────────────────────────────────────────

export type JobStatus =
  | 'QUEUED'     // Submitted, not yet picked up by worker
  | 'RUNNING'    // Worker is actively processing
  | 'COMPLETED'  // Finished successfully
  | 'FAILED'     // Failed — see errorMessage
  | 'CANCELLED'  // Cancelled by user before completion
  | 'RETRYING';  // Transient failure — will retry automatically

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  QUEUED    : '#94a3b8',
  RUNNING   : '#60a5fa',
  COMPLETED : '#22c55e',
  FAILED    : '#ef4444',
  CANCELLED : '#475569',
  RETRYING  : '#facc15',
};

// ─── Job Record ───────────────────────────────────────────────────────────────

/**
 * A persisted job record.
 * Stored in the database; every state transition is durable.
 */
export interface AsyncJob {
  /** Unique job identifier. */
  id              : string;
  /** Type of work this job performs. */
  jobType         : JobType;
  /** Current lifecycle status. */
  status          : JobStatus;
  /** Project scope. */
  projectId       : string;
  /** Tenant scope. */
  tenantId        : string;
  /** Job-specific input parameters (no credentials). */
  payload         : Record<string, unknown>;
  /** Progress 0–100, or null if not measurable. */
  progress?       : number;
  /** Number of items processed (for batch jobs). */
  itemsProcessed  : number;
  /** Total items expected (for batch jobs). */
  itemsTotal      : number;
  /** Error message if status = FAILED. */
  errorMessage?   : string;
  /** Number of retries attempted. */
  retryCount      : number;
  /** Maximum retries before marking FAILED. */
  maxRetries      : number;
  /** ISO 8601 creation timestamp. */
  createdAt       : string;
  /** ISO 8601 start timestamp (when worker picked it up). */
  startedAt?      : string;
  /** ISO 8601 completion or failure timestamp. */
  completedAt?    : string;
  /** Actor who submitted the job. */
  submittedBy?    : string;
}

// ─── Job Submission Input ─────────────────────────────────────────────────────

/** Input to AsyncJobQueue.submit(). */
export interface SubmitJobInput {
  jobType      : JobType;
  projectId    : string;
  tenantId     : string;
  payload      : Record<string, unknown>;
  submittedBy? : string;
  maxRetries?  : number;
}

// ─── Job Result ───────────────────────────────────────────────────────────────

/** The outcome of a completed job. */
export interface JobResult {
  success        : boolean;
  itemsProcessed : number;
  errors         : string[];
  durationMs     : number;
  details?       : string;
}

// ─── Integration Health ───────────────────────────────────────────────────────

/**
 * Health status of an external integration target.
 * Returns a placeholder for all targets that don't have real credentials —
 * never returns fabricated "connected" status without real configuration.
 */
export type IntegrationHealthStatus =
  | 'CONNECTED'         // Reachable and authenticated
  | 'UNREACHABLE'       // Cannot reach host
  | 'AUTHENTICATION_ERROR' // Host reachable but auth failed
  | 'NOT_CONFIGURED'    // No destination/credentials configured
  | 'CHECKING';         // Health check in progress

export interface IntegrationHealth {
  /** Integration target name. */
  target     : string;
  /** Human-readable label. */
  label      : string;
  /** Current health status. */
  status     : IntegrationHealthStatus;
  /** Optional detail message. */
  message?   : string;
  /** Last health check timestamp. */
  checkedAt? : string;
}

export const INTEGRATION_STATUS_COLORS: Record<IntegrationHealthStatus, string> = {
  CONNECTED            : '#22c55e',
  UNREACHABLE          : '#ef4444',
  AUTHENTICATION_ERROR : '#f97316',
  NOT_CONFIGURED       : '#94a3b8',
  CHECKING             : '#60a5fa',
};
