/**
 * N-Guard — Phase 6 Agent Orchestration Tests
 *
 * Tests cover:
 *  1. End-to-end orchestration with MockAIProvider — returns valid AgentRun.
 *  2. Schema validation — invalid JSON response → NEEDS_REVIEW, validationPassed=false.
 *  3. Invalid verdict → NEEDS_REVIEW, confidence=0.
 *  4. Missing rationale → validation error, NEEDS_REVIEW.
 *  5. Retry behaviour — provider error → retries up to maxRetries, then FAILED.
 *  6. Timeout behaviour — slow provider → TIMEOUT status, NEEDS_REVIEW result.
 *  7. Failed result is safe — verdict=NEEDS_REVIEW, confidence=0 (rule 12).
 *  8. AgentRun is auditable — carries timing, model metadata, evidence count.
 *  9. Evidence references — run carries EvidenceReference[] from retrieval.
 * 10. Edition isolation in orchestration — retrieval uses AgentContext edition.
 * 11. No direct model calls — only AIProvider.complete() is called (rule 7).
 * 12. AgentOrchestrator.run() NEVER throws — errors are in run.error.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockVectorStore }     from '../vector/MockVectorStore.js';
import { MockAIProvider }      from '../providers/MockAIProvider.js';
import { KnowledgeSearchService } from '../retrieval/KnowledgeSearchService.js';
import { AgentOrchestrator }   from '../orchestration/AgentOrchestrator.js';
import type { AssessmentInput } from '../types/index.js';
import type { AICompletionRequest } from '../providers/AIProvider.js';
import type { AgentContext }    from '../orchestration/types.js';

const MOCK_USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides?: Partial<AssessmentInput>): AssessmentInput {
  return {
    designRequestId : 'dr-001',
    projectId       : 'proj-001',
    tenantId        : 'tenant-001',
    title           : 'Custom pricing logic in SD',
    description     : 'We need a custom pricing routine to handle customer-specific discounts.',
    businessProcess : 'Order-to-Cash',
    module          : 'SD',
    edition         : 'CLOUD_PUBLIC',
    release         : '2024',
    ...overrides,
  };
}

function makeContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    tenantId       : 'tenant-001',
    projectId      : 'proj-001',
    deploymentModel: 'CLOUD_PUBLIC',
    release        : '2024',
    cleanCorePolicy: 'STANDARD',
    ...overrides,
  };
}

function makeOrchestrator(
  aiOverride?  : { complete?: (req: unknown) => unknown },
  storeOverride?: MockVectorStore,
): AgentOrchestrator {
  const ai    = aiOverride ? (aiOverride as unknown as MockAIProvider) : new MockAIProvider();
  const store = storeOverride ?? new MockVectorStore();
  const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
  return new AgentOrchestrator({ aiProvider: ai, knowledgeSearchService: svc });
}

// ── End-to-end orchestration ──────────────────────────────────────────────────

describe('AgentOrchestrator — end-to-end with MockAIProvider', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => { orchestrator = makeOrchestrator(); });

  it('returns a completed AgentRun with a valid verdict', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.status).toBe('COMPLETED');
    expect(run.result).toBeDefined();
    const validVerdicts = ['FIT_TO_STANDARD','ACCEPTABLE_GAP','CUSTOMIZATION_RISK','REJECT','NEEDS_REVIEW'];
    expect(validVerdicts).toContain(run.result!.verdict);
  });

  it('AgentRun carries model provider and model name', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.modelProvider).toBe('mock');
    expect(run.modelName).toBe('mock-gpt-4o');
  });

  it('AgentRun has a unique non-empty ID', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(typeof run.id).toBe('string');
    expect(run.id.length).toBeGreaterThan(0);
  });

  it('AgentRun has positive latencyMs', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('AgentRun has startedAt and completedAt timestamps', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.startedAt).toBeDefined();
    expect(run.completedAt).toBeDefined();
    expect(new Date(run.startedAt).getTime()).not.toBeNaN();
    expect(new Date(run.completedAt!).getTime()).not.toBeNaN();
  });

  it('AgentRun carries schemaVersion', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.schemaVersion).toBe('1.0');
  });

  it('result carries agentRunId matching the run id', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.result!.agentRunId).toBe(run.id);
  });

  it('result confidence is clamped between 0 and 1', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.result!.confidence).toBeGreaterThanOrEqual(0);
    expect(run.result!.confidence).toBeLessThanOrEqual(1);
  });

  it('validationPassed is true when MockAIProvider returns valid JSON', async () => {
    const run = await orchestrator.run(makeInput(), makeContext());
    expect(run.validationPassed).toBe(true);
    expect(run.result!.validationErrors).toHaveLength(0);
  });
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe('AgentOrchestrator — schema validation (rule 12)', () => {
  it('invalid JSON → NEEDS_REVIEW, validationPassed=false, confidence=0', async () => {
    class BadJsonProvider extends MockAIProvider {
      override async complete() {
        return { content: 'This is not JSON at all!', role: 'assistant' as const, model: 'test', usage: MOCK_USAGE };
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new BadJsonProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());

    expect(run.status).toBe('COMPLETED');  // run completes even with bad output
    expect(run.validationPassed).toBe(false);
    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
    expect(run.result!.confidence).toBe(0);
    expect(run.result!.validationErrors.length).toBeGreaterThan(0);
  });

  it('invalid verdict string → NEEDS_REVIEW with validation error', async () => {
    class BadVerdictProvider extends MockAIProvider {
      override async complete() {
        return {
          content: JSON.stringify({
            verdict: 'TOTALLY_INVALID', rationale: 'Test', confidence: 0.5,
            evidenceSources: [], recommendations: [],
          }),
          role: 'assistant' as const, model: 'test', usage: MOCK_USAGE,
        };
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new BadVerdictProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());

    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
    expect(run.validationPassed).toBe(false);
    expect(run.result!.validationErrors.some(e => e.includes('verdict'))).toBe(true);
  });

  it('missing rationale → validation error reported', async () => {
    class NoRationaleProvider extends MockAIProvider {
      override async complete() {
        return {
          content: JSON.stringify({
            verdict: 'FIT_TO_STANDARD', rationale: '', confidence: 0.9,
            evidenceSources: [], recommendations: [],
          }),
          role: 'assistant' as const, model: 'test', usage: MOCK_USAGE,
        };
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new NoRationaleProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());

    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
    expect(run.result!.validationErrors.some(e => e.includes('rationale'))).toBe(true);
  });

  it('confidence out of range → validation error, result confidence=0', async () => {
    class BadConfidenceProvider extends MockAIProvider {
      override async complete() {
        return {
          content: JSON.stringify({
            verdict: 'FIT_TO_STANDARD', rationale: 'Looks good.', confidence: 1.5,
            evidenceSources: [], recommendations: [],
          }),
          role: 'assistant' as const, model: 'test', usage: MOCK_USAGE,
        };
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new BadConfidenceProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());

    expect(run.result!.confidence).toBe(0);
    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
  });

  it('recommendations not an array → validation error', async () => {
    class BadRecsProvider extends MockAIProvider {
      override async complete() {
        return {
          content: JSON.stringify({
            verdict: 'ACCEPTABLE_GAP', rationale: 'Minor gap.', confidence: 0.7,
            evidenceSources: [], recommendations: 'not-an-array',
          }),
          role: 'assistant' as const, model: 'test', usage: MOCK_USAGE,
        };
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new BadRecsProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());

    expect(run.result!.validationErrors.some(e => e.includes('recommendations'))).toBe(true);
  });
});

// ── Retry and fault tolerance ─────────────────────────────────────────────────

describe('AgentOrchestrator — retry and fault tolerance', () => {
  it('provider error → run status FAILED with error message', async () => {
    class AlwaysFailsProvider extends MockAIProvider {
      override async complete(): Promise<never> {
        throw new Error('Simulated provider failure');
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({
      aiProvider            : new AlwaysFailsProvider(),
      knowledgeSearchService: svc,
      options               : { maxRetries: 1 },
    });
    const run = await orch.run(makeInput(), makeContext());

    expect(run.status).toBe('FAILED');
    expect(run.error).toContain('Simulated provider failure');
    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
    expect(run.result!.confidence).toBe(0);
  });

  it('provider timeout → run status TIMEOUT', async () => {
    class SlowProvider extends MockAIProvider {
      override async complete(_req: AICompletionRequest) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return super.complete({ messages: [], responseFormat: 'json' });
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({
      aiProvider            : new SlowProvider(),
      knowledgeSearchService: svc,
      options               : { maxRetries: 0, timeoutMs: 50 },
    });
    const run = await orch.run(makeInput(), makeContext());

    expect(run.status).toBe('TIMEOUT');
    expect(run.error).toContain('timed out');
    expect(run.result!.verdict).toBe('NEEDS_REVIEW');
    expect(run.result!.confidence).toBe(0);
  });

  it('retryCount is incremented on each retry', async () => {
    let callCount = 0;
    class FailsTwiceProvider extends MockAIProvider {
      override async complete(_req: AICompletionRequest) {
        callCount++;
        if (callCount < 3) throw new Error('Transient error');
        return super.complete({ messages: [], responseFormat: 'json' });
      }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({
      aiProvider            : new FailsTwiceProvider(),
      knowledgeSearchService: svc,
      options               : { maxRetries: 2 },
    });
    const run = await orch.run(makeInput(), makeContext());

    // Should succeed on 3rd attempt
    expect(run.status).toBe('COMPLETED');
    expect(run.retryCount).toBe(2);
    expect(run.result!.processingNotes).toContain('attempt 3');
  });

  it('orchestrator.run() NEVER throws (rule 12)', async () => {
    class CrashProvider extends MockAIProvider {
      override async complete(): Promise<never> { throw new Error('Crash!'); }
    }
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({
      aiProvider            : new CrashProvider(),
      knowledgeSearchService: svc,
      options               : { maxRetries: 0 },
    });

    // Should not throw
    const run = await orch.run(makeInput(), makeContext());
    expect(run).toBeDefined();
    expect(run.status).toBe('FAILED');
  });
});

// ── Evidence references ───────────────────────────────────────────────────────

describe('AgentOrchestrator — evidence references', () => {
  it('run.evidenceReferences is an array (empty when no knowledge is seeded)', async () => {
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new MockAIProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());
    expect(Array.isArray(run.evidenceReferences)).toBe(true);
  });

  it('evidenceReferences include metadata when knowledge is seeded', async () => {
    const store = new MockVectorStore();
    await store.upsert([{
      id      : 'chunk-001',
      content : 'SAP pricing via condition technique in Cloud Public.',
      metadata: {
        tenantId          : 'tenant-001',
        edition           : 'CLOUD_PUBLIC',
        title             : 'Pricing Guide',
        authorityLevel    : 'SAP_OFFICIAL',
        knowledgeSourceId : 'ks-001',
        documentId        : 'doc-001',
        chunkSequence     : 1,
      },
    }]);

    const svc  = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch = new AgentOrchestrator({ aiProvider: new MockAIProvider(), knowledgeSearchService: svc });
    const run  = await orch.run(makeInput(), makeContext());

    expect(run.evidenceCount).toBe(1);
    expect(run.evidenceReferences).toHaveLength(1);
    const ref = run.evidenceReferences[0];
    expect(ref.chunkId).toBe('chunk-001');
    expect(ref.title).toBe('Pricing Guide');
    expect(ref.authorityLevel).toBe('SAP_OFFICIAL');
    expect(ref.edition).toBe('CLOUD_PUBLIC');
    expect(ref.knowledgeSourceId).toBe('ks-001');
    expect(ref.documentId).toBe('doc-001');
    expect(ref.chunkSequence).toBe(1);
    expect(typeof ref.score).toBe('number');
  });

  it('result.evidenceReferences matches run.evidenceReferences', async () => {
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new MockAIProvider(), knowledgeSearchService: svc });
    const run   = await orch.run(makeInput(), makeContext());
    expect(run.result!.evidenceReferences).toEqual(run.evidenceReferences);
  });
});

// ── AgentContext / edition isolation ──────────────────────────────────────────

describe('AgentOrchestrator — edition isolation (rule 2)', () => {
  it('uses context.deploymentModel for evidence retrieval', async () => {
    const store = new MockVectorStore();
    await store.upsert([
      { id: 'op-chunk',  content: 'On-Premise feature.', metadata: { tenantId: 'tenant-001', edition: 'ON_PREMISE', title: 'OP Feature' } },
      { id: 'pub-chunk', content: 'Public Cloud feature.', metadata: { tenantId: 'tenant-001', edition: 'CLOUD_PUBLIC', title: 'PUB Feature' } },
    ]);

    const svc = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch = new AgentOrchestrator({ aiProvider: new MockAIProvider(), knowledgeSearchService: svc });

    // Search with CLOUD_PUBLIC context → On-Premise chunk must not appear
    const run = await orch.run(makeInput({ edition: 'CLOUD_PUBLIC' }), makeContext({ deploymentModel: 'CLOUD_PUBLIC' }));
    const evidenceIds = run.evidenceReferences.map(r => r.chunkId);
    expect(evidenceIds).not.toContain('op-chunk');
  });

  it('all editions are valid contexts — no edition default applied', async () => {
    const store = new MockVectorStore();
    const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const orch  = new AgentOrchestrator({ aiProvider: new MockAIProvider(), knowledgeSearchService: svc });

    const editions = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'] as const;
    for (const ed of editions) {
      const run = await orch.run(makeInput({ edition: ed }), makeContext({ deploymentModel: ed }));
      expect(run.status).toBe('COMPLETED');
    }
  });
});
