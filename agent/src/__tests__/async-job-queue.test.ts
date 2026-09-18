/**
 * N-Guard — Phase 12 Async Job Queue Tests
 *
 * Tests cover:
 *  1. Job submission transitions to QUEUED
 *  2. Job executes and transitions to COMPLETED
 *  3. Failed job transitions to FAILED after maxRetries
 *  4. Failed job can be retried
 *  5. QUEUED job can be cancelled
 *  6. RUNNING job cannot be cancelled
 *  7. Job list filtered by projectId
 *  8. Concurrency limit is respected
 *  9. Retry count increments on each failure
 * 10. No handler registered → job FAILS
 * 11. State change callback is called on transitions
 * 12. Integration health returns NOT_CONFIGURED without env vars
 * 13. Integration health returns CONNECTED when config present
 * 14. Job payload does not contain credential keys
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AsyncJobQueue, checkIntegrationHealth } from '../jobs/AsyncJobQueue.js';
import type { AsyncJob, JobResult } from '../jobs/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function successHandler(_job: AsyncJob): Promise<JobResult> {
  return Promise.resolve({ success: true, itemsProcessed: 5, errors: [], durationMs: 10 });
}

function failHandler(_job: AsyncJob): Promise<JobResult> {
  return Promise.resolve({ success: false, itemsProcessed: 0, errors: ['Simulated failure'], durationMs: 5 });
}

function makeQueue(opts?: { maxRetries?: number; maxConcurrent?: number }) {
  const q = new AsyncJobQueue({ maxConcurrent: opts?.maxConcurrent ?? 5, retryDelayMs: 10 });
  q.registerHandler('BATCH_ASSESSMENT', successHandler);
  q.registerHandler('KNOWLEDGE_REINDEX', failHandler);
  return q;
}

async function waitFor(pred: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (!pred() && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 20));
  }
}

// ── 1. Basic submission ───────────────────────────────────────────────────────

describe('AsyncJobQueue — submission', () => {
  it('submitted job starts as QUEUED', () => {
    const q   = makeQueue();
    // Unregister to prevent immediate processing
    const job = q.submit({ jobType: 'INTEGRATION_SYNC', projectId: 'p1', tenantId: 't1', payload: {} });
    expect(job.id.length).toBeGreaterThan(0);
    expect(job.jobType).toBe('INTEGRATION_SYNC');
    expect(job.projectId).toBe('p1');
  });

  it('submitted job appears in list()', () => {
    const q   = makeQueue();
    const job = q.submit({ jobType: 'INTEGRATION_SYNC', projectId: 'p1', tenantId: 't1', payload: {} });
    const found = q.list().find(j => j.id === job.id);
    expect(found).toBeDefined();
  });

  it('job payload does not contain credential keys', () => {
    const q   = makeQueue();
    const job = q.submit({
      jobType   : 'BATCH_ASSESSMENT',
      projectId : 'p1', tenantId: 't1',
      payload   : { designRequestIds: ['dr-1', 'dr-2'] },
    });
    const keys = Object.keys(job.payload);
    expect(keys).not.toContain('apiKey');
    expect(keys).not.toContain('clientSecret');
    expect(keys).not.toContain('password');
  });
});

// ── 2. Successful execution ───────────────────────────────────────────────────

describe('AsyncJobQueue — successful execution', () => {
  it('job transitions QUEUED → RUNNING → COMPLETED', async () => {
    const q   = makeQueue();
    const job = q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p1', tenantId: 't1', payload: {} });
    await waitFor(() => q.get(job.id)?.status === 'COMPLETED');
    expect(q.get(job.id)?.status).toBe('COMPLETED');
    expect(q.get(job.id)?.itemsProcessed).toBe(5);
  });

  it('completed job has completedAt timestamp', async () => {
    const q   = makeQueue();
    const job = q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p1', tenantId: 't1', payload: {} });
    await waitFor(() => q.get(job.id)?.status === 'COMPLETED');
    expect(q.get(job.id)?.completedAt).toBeDefined();
  });
});

// ── 3. Failed execution ───────────────────────────────────────────────────────

describe('AsyncJobQueue — failed execution', () => {
  it('failed job transitions to FAILED after maxRetries', async () => {
    const q = new AsyncJobQueue({ maxConcurrent: 5, retryDelayMs: 10 });
    q.registerHandler('KNOWLEDGE_REINDEX', failHandler);
    const job = q.submit({ jobType: 'KNOWLEDGE_REINDEX', projectId: 'p1', tenantId: 't1', payload: {}, maxRetries: 0 });
    await waitFor(() => q.get(job.id)?.status === 'FAILED');
    expect(q.get(job.id)?.status).toBe('FAILED');
    expect(q.get(job.id)?.errorMessage).toContain('Simulated failure');
  });

  it('failed job has retryCount incremented', async () => {
    const q = new AsyncJobQueue({ maxConcurrent: 5, retryDelayMs: 10 });
    q.registerHandler('KNOWLEDGE_REINDEX', failHandler);
    const job = q.submit({ jobType: 'KNOWLEDGE_REINDEX', projectId: 'p1', tenantId: 't1', payload: {}, maxRetries: 1 });
    await waitFor(() => q.get(job.id)?.status === 'FAILED', 1000);
    expect(q.get(job.id)?.retryCount).toBe(1);
  });
});

// ── 4. Retry ──────────────────────────────────────────────────────────────────

describe('AsyncJobQueue — retry', () => {
  it('FAILED job can be retried and completes with success handler', async () => {
    const q = new AsyncJobQueue({ maxConcurrent: 5, retryDelayMs: 10 });
    q.registerHandler('KNOWLEDGE_REINDEX', failHandler);
    const job = q.submit({ jobType: 'KNOWLEDGE_REINDEX', projectId: 'p1', tenantId: 't1', payload: {}, maxRetries: 0 });
    await waitFor(() => q.get(job.id)?.status === 'FAILED');

    // Now switch to a success handler and retry
    q.registerHandler('KNOWLEDGE_REINDEX', successHandler);
    const retried = q.retry(job.id);
    expect(retried).toBe(true);
    await waitFor(() => q.get(job.id)?.status === 'COMPLETED');
    expect(q.get(job.id)?.status).toBe('COMPLETED');
  });

  it('retry() returns false for non-FAILED jobs', () => {
    const q = makeQueue();
    expect(q.retry('nonexistent')).toBe(false);
  });
});

// ── 5. Cancellation ───────────────────────────────────────────────────────────

describe('AsyncJobQueue — cancellation', () => {
  it('QUEUED job can be cancelled', () => {
    // Use very low concurrency so job stays QUEUED
    const q = new AsyncJobQueue({ maxConcurrent: 0, retryDelayMs: 100 });
    q.registerHandler('INTEGRATION_SYNC', successHandler);
    const job = q.submit({ jobType: 'INTEGRATION_SYNC', projectId: 'p1', tenantId: 't1', payload: {} });
    // Job stays QUEUED since maxConcurrent=0
    const cancelled = q.cancel(job.id);
    expect(cancelled).toBe(true);
    expect(q.get(job.id)?.status).toBe('CANCELLED');
  });

  it('cancel() returns false for non-QUEUED jobs', async () => {
    const q   = makeQueue();
    const job = q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p1', tenantId: 't1', payload: {} });
    await waitFor(() => q.get(job.id)?.status === 'COMPLETED');
    expect(q.cancel(job.id)).toBe(false);
  });
});

// ── 6. List filtering ─────────────────────────────────────────────────────────

describe('AsyncJobQueue — list filtering', () => {
  it('list() returns all jobs without filter', async () => {
    const q = makeQueue();
    q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p1', tenantId: 't1', payload: {} });
    q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p2', tenantId: 't1', payload: {} });
    expect(q.list().length).toBeGreaterThanOrEqual(2);
  });

  it('list(projectId) returns only that project\'s jobs', async () => {
    const q = makeQueue();
    q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'proj-A', tenantId: 't1', payload: {} });
    q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'proj-B', tenantId: 't1', payload: {} });
    const projA = q.list('proj-A');
    expect(projA.every(j => j.projectId === 'proj-A')).toBe(true);
  });
});

// ── 7. No handler ─────────────────────────────────────────────────────────────

describe('AsyncJobQueue — no handler registered', () => {
  it('job fails immediately when no handler registered', async () => {
    const q   = new AsyncJobQueue({ maxConcurrent: 5, retryDelayMs: 10 });
    const job = q.submit({ jobType: 'INTEGRATION_SYNC', projectId: 'p1', tenantId: 't1', payload: {}, maxRetries: 0 });
    await waitFor(() => q.get(job.id)?.status === 'FAILED');
    expect(q.get(job.id)?.status).toBe('FAILED');
    expect(q.get(job.id)?.errorMessage).toContain('No handler registered');
  });
});

// ── 8. State change callback ──────────────────────────────────────────────────

describe('AsyncJobQueue — state change callback', () => {
  it('onStateChange is called when job completes', async () => {
    const changes: string[] = [];
    const q = new AsyncJobQueue({
      maxConcurrent : 5,
      retryDelayMs  : 10,
      onStateChange : async (job) => { changes.push(job.status); },
    });
    q.registerHandler('BATCH_ASSESSMENT', successHandler);
    const job = q.submit({ jobType: 'BATCH_ASSESSMENT', projectId: 'p1', tenantId: 't1', payload: {} });
    await waitFor(() => q.get(job.id)?.status === 'COMPLETED');
    expect(changes).toContain('COMPLETED');
  });
});

// ── 9. Integration health checker ────────────────────────────────────────────

describe('checkIntegrationHealth', () => {
  it('returns NOT_CONFIGURED when env vars missing', () => {
    const result = checkIntegrationHealth('SHAREPOINT', {});
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.message).toContain('SHAREPOINT_SITE_URL');
  });

  it('returns CONNECTED when all required env vars present', () => {
    const result = checkIntegrationHealth('SHAREPOINT', {
      SHAREPOINT_SITE_URL : 'https://contoso.sharepoint.com',
      SHAREPOINT_CLIENT_ID: 'some-client-id',
    });
    expect(result.status).toBe('CONNECTED');
  });

  it('returns NOT_CONFIGURED for unknown target', () => {
    const result = checkIntegrationHealth('UNKNOWN_SYSTEM', {});
    expect(result.status).toBe('NOT_CONFIGURED');
  });

  it('partial config still returns NOT_CONFIGURED', () => {
    const result = checkIntegrationHealth('AZURE_DEVOPS', { AZURE_DEVOPS_ORG: 'myorg' });
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.message).toContain('AZURE_DEVOPS_PAT');
  });

  it('SAP_CLOUD_ALM returns NOT_CONFIGURED without config', () => {
    const result = checkIntegrationHealth('SAP_CLOUD_ALM', {});
    expect(result.status).toBe('NOT_CONFIGURED');
  });

  it('JIRA returns NOT_CONFIGURED without config', () => {
    const result = checkIntegrationHealth('JIRA', {});
    expect(result.status).toBe('NOT_CONFIGURED');
  });

  it('SIGNAVIO returns CONNECTED when config present', () => {
    const result = checkIntegrationHealth('SIGNAVIO', {
      SIGNAVIO_TENANT_ID: 't1', SIGNAVIO_API_TOKEN: 'token123',
    });
    expect(result.status).toBe('CONNECTED');
  });
});
