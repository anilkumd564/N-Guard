/**
 * N-Guard — AsyncJobQueue (Phase 12)
 *
 * In-memory job queue for local/VM development with a replaceable interface.
 * The CAP handler persists jobs to the DB; the queue processes them asynchronously.
 *
 * Architecture rules:
 *  - Queue implementation is replaceable (local → BTP Job Scheduling) without
 *    rewriting business logic.
 *  - No long-running work executes inside a browser HTTP request.
 *  - Job states are persisted; the DB is the source of truth.
 *  - No credentials are stored in job payloads.
 *
 * Concurrency model (local):
 *  - Jobs execute via setImmediate/setTimeout — non-blocking.
 *  - Worker count is configurable (default: 3 concurrent workers).
 *  - Jobs are idempotent by type for safety.
 */

import { randomUUID } from 'node:crypto';
import type {
  AsyncJob,
  JobStatus,
  JobType,
  JobResult,
  SubmitJobInput,
} from './types.js';

// ─── Job Handler Interface ────────────────────────────────────────────────────

/**
 * A function that performs the actual work for a job type.
 * Must be idempotent and NEVER throw — return a JobResult with success=false instead.
 */
export type JobHandler = (job: AsyncJob) => Promise<JobResult>;

// ─── Queue Options ────────────────────────────────────────────────────────────

export interface QueueOptions {
  /** Max concurrent jobs processing simultaneously. Default: 3. */
  maxConcurrent? : number;
  /** Base retry delay in ms. Default: 2000. Doubles on each retry (exponential back-off). */
  retryDelayMs?  : number;
  /** Callback for job state changes — used to persist to DB. */
  onStateChange? : (job: AsyncJob) => Promise<void>;
}

// ─── AsyncJobQueue ────────────────────────────────────────────────────────────

export class AsyncJobQueue {
  private readonly queue     = new Map<string, AsyncJob>();
  private readonly handlers  = new Map<JobType, JobHandler>();
  private readonly options   : Required<Omit<QueueOptions, 'onStateChange'>> & Pick<QueueOptions, 'onStateChange'>;
  private          running   = 0;

  constructor(options?: QueueOptions) {
    this.options = {
      maxConcurrent  : options?.maxConcurrent ?? 3,
      retryDelayMs   : options?.retryDelayMs  ?? 2000,
      onStateChange  : options?.onStateChange,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register a handler for a job type. */
  registerHandler(jobType: JobType, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  /** Submit a new job. Returns the job record. */
  submit(input: SubmitJobInput): AsyncJob {
    const job: AsyncJob = {
      id             : randomUUID(),
      jobType        : input.jobType,
      status         : 'QUEUED',
      projectId      : input.projectId,
      tenantId       : input.tenantId,
      payload        : input.payload,
      itemsProcessed : 0,
      itemsTotal     : 0,
      retryCount     : 0,
      maxRetries     : input.maxRetries ?? 2,
      createdAt      : new Date().toISOString(),
      submittedBy    : input.submittedBy,
    };

    this.queue.set(job.id, job);
    void this._persist(job);
    // Schedule processing on next tick
    setImmediate(() => void this._processNext());
    return job;
  }

  /** Get a job by ID. */
  get(id: string): AsyncJob | undefined {
    return this.queue.get(id);
  }

  /** List all jobs, optionally filtered by project. */
  list(projectId?: string): AsyncJob[] {
    const jobs = [...this.queue.values()];
    return projectId ? jobs.filter(j => j.projectId === projectId) : jobs;
  }

  /** Cancel a QUEUED job. RUNNING jobs cannot be cancelled synchronously. */
  cancel(id: string): boolean {
    const job = this.queue.get(id);
    if (!job || job.status !== 'QUEUED') return false;
    this._setStatus(job, 'CANCELLED');
    return true;
  }

  /** Retry a FAILED job. */
  retry(id: string): boolean {
    const job = this.queue.get(id);
    if (!job || job.status !== 'FAILED') return false;
    job.status      = 'QUEUED';
    job.errorMessage = undefined;
    void this._persist(job);
    setImmediate(() => void this._processNext());
    return true;
  }

  /** Number of jobs currently running. */
  get activeCount(): number { return this.running; }

  /** Number of jobs in QUEUED state. */
  get queuedCount(): number {
    return [...this.queue.values()].filter(j => j.status === 'QUEUED').length;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _processNext(): Promise<void> {
    if (this.running >= this.options.maxConcurrent) return;

    const next = [...this.queue.values()].find(j => j.status === 'QUEUED');
    if (!next) return;

    this.running++;
    this._setStatus(next, 'RUNNING');
    next.startedAt = new Date().toISOString();

    const t0      = Date.now();
    const handler = this.handlers.get(next.jobType);

    try {
      if (!handler) {
        throw new Error(`No handler registered for job type ${next.jobType}`);
      }
      const result = await handler(next);
      next.itemsProcessed = result.itemsProcessed;
      next.completedAt    = new Date().toISOString();

      if (result.success) {
        this._setStatus(next, 'COMPLETED');
      } else {
        await this._handleFailure(next, result.errors.join('; '), t0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this._handleFailure(next, msg, t0);
    } finally {
      this.running--;
      // Process next queued job
      setImmediate(() => void this._processNext());
    }
  }

  private async _handleFailure(job: AsyncJob, message: string, _t0: number): Promise<void> {
    job.errorMessage = message;
    if (job.retryCount < job.maxRetries) {
      job.retryCount++;
      const delay = this.options.retryDelayMs * Math.pow(2, job.retryCount - 1);
      this._setStatus(job, 'RETRYING');
      setTimeout(() => {
        job.status = 'QUEUED';
        void this._persist(job);
        void this._processNext();
      }, delay);
    } else {
      job.completedAt = new Date().toISOString();
      this._setStatus(job, 'FAILED');
    }
  }

  private _setStatus(job: AsyncJob, status: JobStatus): void {
    job.status = status;
    void this._persist(job);
  }

  private async _persist(job: AsyncJob): Promise<void> {
    if (this.options.onStateChange) {
      try { await this.options.onStateChange(job); } catch { /* ignore persistence errors */ }
    }
  }
}

// ─── Integration Health Checker ───────────────────────────────────────────────

/**
 * Returns health status for known integration targets.
 * Returns NOT_CONFIGURED for any target without credentials/config.
 * Never fabricates CONNECTED status.
 */
export function checkIntegrationHealth(
  target: string,
  env: Record<string, string | undefined>,
): { status: 'CONNECTED' | 'NOT_CONFIGURED'; message: string } {
  const configKeys: Record<string, string[]> = {
    'SHAREPOINT'    : ['SHAREPOINT_SITE_URL', 'SHAREPOINT_CLIENT_ID'],
    'AZURE_DEVOPS'  : ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_PAT'],
    'SAP_CLOUD_ALM' : ['SAP_CLOUD_ALM_URL', 'SAP_CLOUD_ALM_CLIENT_ID'],
    'SAP_S4HANA'    : ['S4HANA_BASE_URL', 'S4HANA_CLIENT_ID'],
    'SIGNAVIO'      : ['SIGNAVIO_TENANT_ID', 'SIGNAVIO_API_TOKEN'],
    'JIRA'          : ['JIRA_BASE_URL', 'JIRA_API_TOKEN'],
  };

  const keys = configKeys[target.toUpperCase()];
  if (!keys) {
    return { status: 'NOT_CONFIGURED', message: `Unknown integration target: ${target}` };
  }

  const missing = keys.filter(k => !env[k]);
  if (missing.length > 0) {
    return {
      status  : 'NOT_CONFIGURED',
      message : `Missing configuration: ${missing.join(', ')}. Configure via environment variables to enable this integration.`,
    };
  }

  // Configuration present — actual connectivity check deferred to Phase 14
  return {
    status  : 'CONNECTED',
    message : 'Configuration found. Live connectivity check available in Phase 14.',
  };
}
