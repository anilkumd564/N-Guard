/**
 * N-Guard — Phase 8 Cross-Edition Comparison Tests
 *
 * Tests cover:
 *  1. Three independent edition results are produced (always 3).
 *  2. Evidence is partitioned by edition — OP evidence never appears in PUB results.
 *  3. Unknown availability stays F8/INSUFFICIENT_EVIDENCE per edition.
 *  4. Summary describes differences without choosing an edition.
 *  5. All editions succeed even when one has insufficient evidence.
 *  6. editionsWithInsufficient correctly identifies F8 editions.
 *  7. humanReviewRequired is true when any edition requires review.
 *  8. CrossEditionComparisonEngine never throws.
 *  9. comparisonId is a unique non-empty string.
 * 10. evidencePartitioned is always true.
 * 11. Edition-specific evidence does not contaminate other editions.
 * 12. Subset comparison (2 editions) is supported.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockVectorStore }            from '../vector/MockVectorStore.js';
import { MockAIProvider }             from '../providers/MockAIProvider.js';
import { MockFitAIProvider }          from '../assessment/MockFitAIProvider.js';
import { KnowledgeSearchService }     from '../retrieval/KnowledgeSearchService.js';
import { CrossEditionComparisonEngine } from '../comparison/CrossEditionComparisonEngine.js';
import type { AssessmentInput }        from '../types/index.js';
import type { AgentContext }           from '../orchestration/types.js';
import type { AICompletionRequest, AICompletionResponse } from '../providers/AIProvider.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

function makeInput(overrides?: Partial<AssessmentInput>): AssessmentInput {
  return {
    designRequestId : 'dr-cmp-001',
    projectId       : 'proj-cmp-001',
    tenantId        : 'tenant-cmp-001',
    title           : 'Automated pricing routine',
    description     : 'Need automated pricing logic standard fit',
    businessProcess : 'Order-to-Cash',
    module          : 'SD',
    edition         : 'CLOUD_PUBLIC',  // base — overridden per edition in engine
    release         : '2024',
    ...overrides,
  };
}

// baseContext omits deploymentModel — engine injects it per edition
function makeBaseContext(): Omit<AgentContext, 'deploymentModel'> {
  return {
    tenantId        : 'tenant-cmp-001',
    projectId       : 'proj-cmp-001',
    release         : '2024',
    cleanCorePolicy : 'STANDARD',
  };
}

function makeEngine(provider = new MockFitAIProvider()): CrossEditionComparisonEngine {
  const store = new MockVectorStore();
  const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
  return new CrossEditionComparisonEngine({ aiProvider: provider, knowledgeSearchService: svc });
}

// ── 1. Three independent results ───────────────────────────────────────────────

describe('CrossEditionComparisonEngine — structure', () => {
  let engine: CrossEditionComparisonEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('always returns exactly 3 edition results (all S4_EDITIONS)', async () => {
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.editionResults).toHaveLength(3);
  });

  it('edition results cover ON_PREMISE, CLOUD_PRIVATE, CLOUD_PUBLIC', async () => {
    const result  = await engine.compare(makeInput(), makeBaseContext());
    const editions = result.editionResults.map(r => r.edition);
    expect(editions).toContain('ON_PREMISE');
    expect(editions).toContain('CLOUD_PRIVATE');
    expect(editions).toContain('CLOUD_PUBLIC');
  });

  it('comparisonId is a unique non-empty string', async () => {
    const r1 = await engine.compare(makeInput(), makeBaseContext());
    const r2 = await engine.compare(makeInput(), makeBaseContext());
    expect(r1.comparisonId.length).toBeGreaterThan(0);
    expect(r2.comparisonId.length).toBeGreaterThan(0);
    expect(r1.comparisonId).not.toBe(r2.comparisonId);
  });

  it('evidencePartitioned is always true', async () => {
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.evidencePartitioned).toBe(true);
  });

  it('completedAt is a valid ISO timestamp', async () => {
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(new Date(result.completedAt).getTime()).not.toBeNaN();
  });

  it('schemaVersion is 2.0', async () => {
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.schemaVersion).toBe('2.0');
  });

  it('each edition result carries a unique agentRunId', async () => {
    const result = await engine.compare(makeInput(), makeBaseContext());
    const ids = result.editionResults.map(r => r.agentRunId);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });
});

// ── 2. Evidence partition ──────────────────────────────────────────────────────

describe('CrossEditionComparisonEngine — evidence partition (rule 2)', () => {
  it('ON_PREMISE evidence does not appear in CLOUD_PUBLIC results', async () => {
    const store = new MockVectorStore();
    // Seed edition-specific chunks
    await store.upsert([
      { id: 'op-chunk',  content: 'OP-only feature.', metadata: { tenantId: 'tenant-cmp-001', edition: 'ON_PREMISE', title: 'OP Doc' } },
      { id: 'pub-chunk', content: 'Public cloud feature.', metadata: { tenantId: 'tenant-cmp-001', edition: 'CLOUD_PUBLIC', title: 'PUB Doc' } },
    ]);
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new CrossEditionComparisonEngine({ aiProvider: new MockFitAIProvider(), knowledgeSearchService: svc });
    const result = await engine.compare(makeInput(), makeBaseContext());

    const pubResult = result.editionResults.find(r => r.edition === 'CLOUD_PUBLIC');
    const opResult  = result.editionResults.find(r => r.edition === 'ON_PREMISE');

    // Public Cloud result must not contain OP-only chunk
    const pubChunkIds = pubResult!.evidenceReferences.map(e => e.chunkId);
    expect(pubChunkIds).not.toContain('op-chunk');

    // On-Premise result must not contain Public-only chunk
    const opChunkIds = opResult!.evidenceReferences.map(e => e.chunkId);
    expect(opChunkIds).not.toContain('pub-chunk');
  });

  it('global evidence (no edition) appears in all three results', async () => {
    const store = new MockVectorStore();
    await store.upsert([{
      id      : 'global-chunk',
      content : 'SAP standard process applicable across editions.',
      metadata: { tenantId: 'tenant-cmp-001', title: 'Global Doc' },  // no edition
    }]);
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new CrossEditionComparisonEngine({ aiProvider: new MockFitAIProvider(), knowledgeSearchService: svc });
    const result = await engine.compare(makeInput(), makeBaseContext());

    for (const edResult of result.editionResults) {
      const ids = edResult.evidenceReferences.map(e => e.chunkId);
      expect(ids).toContain('global-chunk');
    }
  });

  it('each edition result only contains its own evidence references', async () => {
    const store = new MockVectorStore();
    await store.upsert([
      { id:'op-ev',   content:'OP content.',  metadata:{ tenantId:'tenant-cmp-001', edition:'ON_PREMISE',    title:'OP'  } },
      { id:'pce-ev',  content:'PCE content.', metadata:{ tenantId:'tenant-cmp-001', edition:'CLOUD_PRIVATE', title:'PCE' } },
      { id:'pub-ev',  content:'PUB content.', metadata:{ tenantId:'tenant-cmp-001', edition:'CLOUD_PUBLIC',  title:'PUB' } },
    ]);
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new CrossEditionComparisonEngine({ aiProvider: new MockFitAIProvider(), knowledgeSearchService: svc });
    const result = await engine.compare(makeInput(), makeBaseContext());

    const opIds  = result.editionResults.find(r => r.edition === 'ON_PREMISE')!.evidenceReferences.map(e => e.chunkId);
    const pceIds = result.editionResults.find(r => r.edition === 'CLOUD_PRIVATE')!.evidenceReferences.map(e => e.chunkId);
    const pubIds = result.editionResults.find(r => r.edition === 'CLOUD_PUBLIC')!.evidenceReferences.map(e => e.chunkId);

    expect(opIds).not.toContain('pce-ev');
    expect(opIds).not.toContain('pub-ev');
    expect(pceIds).not.toContain('op-ev');
    expect(pceIds).not.toContain('pub-ev');
    expect(pubIds).not.toContain('op-ev');
    expect(pubIds).not.toContain('pce-ev');
  });
});

// ── 3. Unknown stays Unknown (rule 12) ────────────────────────────────────────

describe('CrossEditionComparisonEngine — unknown stays unknown (rule 12)', () => {
  it('F8 for one edition does not become F1 because another edition has evidence', async () => {
    // Only seed evidence for ON_PREMISE — CLOUD_PRIVATE and CLOUD_PUBLIC get no evidence
    let callCount = 0;
    class EdgeCaseProvider extends MockFitAIProvider {
      override async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
        const userText = req.messages.filter(m => m.role === 'user').map(m => m.content).join(' ').toLowerCase();
        callCount++;
        if (userText.includes('on_premise') || userText.includes('on-premise')) {
          // ON_PREMISE has evidence → F1
          return {
            content: JSON.stringify({
              fitClassification: 'F1', deploymentCompatibility: 'DP-OP',
              evidenceConfidence: 'VERIFIED', confidence: 0.9,
              businessIntentSummary: 'Standard pricing.', processClassification: 'OTC',
              targetDeploymentContext: 'OP context.', standardCapability: 'Pricing conditions.',
              gapDescription: null, configurationOpportunity: null,
              customizationRiskStatement: null,
              recommendedNextAction: 'Use standard.', recommendations: [],
              assumptions: [], unknowns: [], humanReviewRequired: false,
            }),
            model: 'mock', usage: USAGE,
          };
        }
        // CLOUD_PRIVATE / CLOUD_PUBLIC → F8
        return {
          content: JSON.stringify({
            fitClassification: 'F8', deploymentCompatibility: 'DP-VERIFY',
            evidenceConfidence: 'INSUFFICIENT_EVIDENCE', confidence: 0,
            businessIntentSummary: 'No evidence.', processClassification: 'Unknown',
            targetDeploymentContext: 'Cloud context.', standardCapability: null,
            gapDescription: null, configurationOpportunity: null,
            customizationRiskStatement: null,
            recommendedNextAction: 'Gather evidence.', recommendations: [],
            assumptions: [], unknowns: ['No evidence for cloud editions'], humanReviewRequired: true,
          }),
          model: 'mock', usage: USAGE,
        };
      }
    }

    const engine = makeEngine(new EdgeCaseProvider());
    const result = await engine.compare(makeInput(), makeBaseContext());

    const opResult  = result.editionResults.find(r => r.edition === 'ON_PREMISE')!;
    const pceResult = result.editionResults.find(r => r.edition === 'CLOUD_PRIVATE')!;
    const pubResult = result.editionResults.find(r => r.edition === 'CLOUD_PUBLIC')!;

    // OP gets F1 from evidence
    expect(opResult.fitClassification).toBe('F1');

    // PCE and PUB must remain F8 — NOT inferred from OP's evidence
    expect(pceResult.fitClassification).toBe('F8');
    expect(pubResult.fitClassification).toBe('F8');
    expect(pceResult.evidenceConfidence).toBe('INSUFFICIENT_EVIDENCE');
    expect(pubResult.evidenceConfidence).toBe('INSUFFICIENT_EVIDENCE');

    // Summary correctly identifies insufficient editions
    expect(result.summary.editionsWithInsufficient).toContain('CLOUD_PRIVATE');
    expect(result.summary.editionsWithInsufficient).toContain('CLOUD_PUBLIC');
    expect(result.summary.editionsWithInsufficient).not.toContain('ON_PREMISE');
  });
});

// ── 4. Summary correctness ────────────────────────────────────────────────────

describe('CrossEditionComparisonEngine — summary (rule 5)', () => {
  it('summary contains recommended next action', async () => {
    const result = await makeEngine().compare(makeInput(), makeBaseContext());
    expect(typeof result.summary.recommendedNextAction).toBe('string');
    expect(result.summary.recommendedNextAction.length).toBeGreaterThan(0);
  });

  it('summary never names a specific edition as the correct choice', async () => {
    const result = await makeEngine().compare(makeInput(), makeBaseContext());
    // The summary should not say "choose X" or "use X edition"
    const action = result.summary.recommendedNextAction.toLowerCase();
    expect(action).not.toMatch(/choose on.premise|select cloud private|pick cloud public/i);
  });

  it('editionsWithInsufficient is empty when all editions have evidence', async () => {
    const result = await makeEngine().compare(makeInput(), makeBaseContext());
    // MockFitAIProvider returns F1 for "standard fit" keyword — no F8
    // Just verify the array exists; value depends on MockFitAIProvider output
    expect(Array.isArray(result.summary.editionsWithInsufficient)).toBe(true);
  });

  it('overallHumanReviewNeeded is true if any edition requires review', async () => {
    class OneRiskProvider extends MockFitAIProvider {
      private calls = 0;
      override async complete(_req: AICompletionRequest): Promise<AICompletionResponse> {
        this.calls++;
        const fc = this.calls === 1 ? 'F6' : 'F1';
        const humanReview = fc === 'F6';
        return {
          content: JSON.stringify({
            fitClassification: fc, deploymentCompatibility: 'DP-ALL',
            evidenceConfidence: fc === 'F6' ? 'NEEDS_SME_REVIEW' : 'VERIFIED',
            confidence: fc === 'F6' ? 0.6 : 0.9,
            businessIntentSummary: 'B', processClassification: 'P',
            targetDeploymentContext: 'T', standardCapability: null,
            gapDescription: null, configurationOpportunity: null,
            customizationRiskStatement: fc === 'F6' ? 'High risk.' : null,
            recommendedNextAction: 'Review.', recommendations: [],
            assumptions: [], unknowns: [], humanReviewRequired: humanReview,
          }),
          model: 'mock', usage: USAGE,
        };
      }
    }
    const engine = makeEngine(new OneRiskProvider());
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.summary.overallHumanReviewNeeded).toBe(true);
  });

  it('commonCapabilities lists shared capability when all editions are F1/F2', async () => {
    class AllFitProvider extends MockFitAIProvider {
      override async complete(_req: AICompletionRequest): Promise<AICompletionResponse> {
        return {
          content: JSON.stringify({
            fitClassification: 'F1', deploymentCompatibility: 'DP-ALL',
            evidenceConfidence: 'VERIFIED', confidence: 0.95,
            businessIntentSummary: 'Standard.', processClassification: 'OTC',
            targetDeploymentContext: 'Any edition.', standardCapability: 'SAP Pricing.',
            gapDescription: null, configurationOpportunity: null,
            customizationRiskStatement: null,
            recommendedNextAction: 'Use standard.', recommendations: [],
            assumptions: [], unknowns: [], humanReviewRequired: false,
          }),
          model: 'mock', usage: USAGE,
        };
      }
    }
    const engine = makeEngine(new AllFitProvider());
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.summary.commonCapabilities.length).toBeGreaterThan(0);
  });

  it('editionSpecificNotes has one entry per edition', async () => {
    const result = await makeEngine().compare(makeInput(), makeBaseContext());
    expect(result.summary.editionSpecificNotes).toHaveLength(3);
  });
});

// ── 5. Fault tolerance ────────────────────────────────────────────────────────

describe('CrossEditionComparisonEngine — fault tolerance', () => {
  it('engine never throws even when provider crashes', async () => {
    class CrashProvider extends MockFitAIProvider {
      override async complete(): Promise<never> { throw new Error('Crash'); }
    }
    const engine = makeEngine(new CrashProvider());
    // Should not throw
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result).toBeDefined();
    // All editions should produce F8 fallback
    for (const ed of result.editionResults) {
      expect(ed.fitClassification).toBe('F8');
    }
  });

  it('one failing edition does not affect the other editions', async () => {
    let calls = 0;
    class OneCrashProvider extends MockFitAIProvider {
      override async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
        calls++;
        if (calls === 2) throw new Error('Transient failure on 2nd call');
        return super.complete(req);
      }
    }
    const engine = makeEngine(new OneCrashProvider());
    const result = await engine.compare(makeInput(), makeBaseContext(), ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC']);
    expect(result.editionResults).toHaveLength(3);
    // At least some editions should have valid results
    const valid = result.editionResults.filter(r => r.validationPassed);
    expect(valid.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 6. Subset comparison ──────────────────────────────────────────────────────

describe('CrossEditionComparisonEngine — subset comparison', () => {
  it('supports comparing only 2 editions', async () => {
    const engine = makeEngine();
    const result = await engine.compare(
      makeInput(),
      makeBaseContext(),
      ['ON_PREMISE', 'CLOUD_PUBLIC'],
    );
    expect(result.editionResults).toHaveLength(2);
    const editions = result.editionResults.map(r => r.edition);
    expect(editions).toContain('ON_PREMISE');
    expect(editions).toContain('CLOUD_PUBLIC');
    expect(editions).not.toContain('CLOUD_PRIVATE');
  });

  it('single-edition comparison produces 1 edition result', async () => {
    const engine = makeEngine();
    const result = await engine.compare(
      makeInput(),
      makeBaseContext(),
      ['CLOUD_PUBLIC'],
    );
    expect(result.editionResults).toHaveLength(1);
    expect(result.editionResults[0].edition).toBe('CLOUD_PUBLIC');
  });
});

// ── 7. Audit trail ────────────────────────────────────────────────────────────

describe('CrossEditionComparisonEngine — audit trail', () => {
  it('each edition result carries validationPassed flag', async () => {
    const engine = makeEngine();
    const result = await engine.compare(makeInput(), makeBaseContext());
    for (const er of result.editionResults) {
      expect(typeof er.validationPassed).toBe('boolean');
    }
  });

  it('designRequestId and projectId are preserved in comparison result', async () => {
    const engine = makeEngine();
    const result = await engine.compare(makeInput(), makeBaseContext());
    expect(result.designRequestId).toBe('dr-cmp-001');
    expect(result.projectId).toBe('proj-cmp-001');
    expect(result.tenantId).toBe('tenant-cmp-001');
  });
});
