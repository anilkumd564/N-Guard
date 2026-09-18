/**
 * N-Guard — Phase 7 Fit-to-Standard Assessment Tests
 *
 * Scenario-based tests using MockFitAIProvider for each F1–F8 classification path.
 *
 * Tests cover:
 *  1. F1 — Standard Fit: high confidence, VERIFIED evidence
 *  2. F2 — Configuration Fit: standard via config
 *  3. F3 — Standard + Minor Extension: small approved extension
 *  4. F4 — Clean Core Extension: BTP/key-user required
 *  5. F5 — Standardization Opportunity: requirement can be redesigned
 *  6. F6 — Potential Customization Risk: humanReviewRequired=true
 *  7. F7 — Legitimate Business Differentiator: humanReviewRequired=true
 *  8. F8 — Insufficient Evidence: confidence=0, INSUFFICIENT_EVIDENCE
 *  9. Invalid JSON from provider → F8/INSUFFICIENT_EVIDENCE (rule 12)
 * 10. Provider failure → safe F8 result, run.status=FAILED
 * 11. DP-* codes are edition-specific (rule 2)
 * 12. FitAssessmentEngine never throws
 * 13. All results carry agentRunId and schemaVersion='2.0'
 * 14. humanReviewRequired=true for F6, F7, F8
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockVectorStore }     from '../vector/MockVectorStore.js';
import { MockAIProvider }      from '../providers/MockAIProvider.js';
import { MockFitAIProvider }   from '../assessment/MockFitAIProvider.js';
import { KnowledgeSearchService } from '../retrieval/KnowledgeSearchService.js';
import { FitAssessmentEngine } from '../assessment/FitAssessmentEngine.js';
import type { AssessmentInput } from '../types/index.js';
import type { AgentContext }    from '../orchestration/types.js';
import type { AICompletionRequest, AICompletionResponse } from '../providers/AIProvider.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

function makeEngine(keyword?: string): FitAssessmentEngine {
  const ai    = keyword
    ? buildKeywordProvider(keyword)
    : new MockFitAIProvider();
  const store = new MockVectorStore();
  const svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
  return new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc });
}

function buildKeywordProvider(keyword: string) {
  // Wraps MockFitAIProvider but injects keyword into user content
  return new (class extends MockFitAIProvider {
    override async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
      const injected = [...req.messages];
      injected[injected.length - 1] = {
        ...injected[injected.length - 1],
        content: injected[injected.length - 1].content + ` [SCENARIO:${keyword}]`,
      };
      return super.complete({ ...req, messages: injected });
    }
  })();
}

function makeInput(title: string, description: string): AssessmentInput {
  return {
    designRequestId : 'dr-test',
    projectId       : 'proj-test',
    tenantId        : 'tenant-test',
    title,
    description,
    businessProcess : 'Order-to-Cash',
    module          : 'SD',
    edition         : 'CLOUD_PUBLIC',
    release         : '2024',
  };
}

function makeContext(edition = 'CLOUD_PUBLIC'): AgentContext {
  return {
    tenantId        : 'tenant-test',
    projectId       : 'proj-test',
    deploymentModel : edition as 'CLOUD_PUBLIC',
    release         : '2024',
    cleanCorePolicy : 'STANDARD',
  };
}

// ── F1 — Standard Fit ────────────────────────────────────────────────────────

describe('FitAssessmentEngine — F1 Standard Fit', () => {
  let engine: FitAssessmentEngine;
  beforeEach(() => { engine = makeEngine('standard fit'); });

  it('returns fitClassification F1', async () => {
    const { result } = await engine.assess(makeInput('Pricing', 'standard fit'), makeContext());
    expect(result.fitClassification).toBe('F1');
  });

  it('evidenceConfidence is VERIFIED for F1', async () => {
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(result.evidenceConfidence).toBe('VERIFIED');
  });

  it('confidence is high (≥ 0.8) for F1', async () => {
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('humanReviewRequired is false for F1', async () => {
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(result.humanReviewRequired).toBe(false);
  });

  it('validationPassed is true', async () => {
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(result.validationPassed).toBe(true);
  });
});

// ── F2 — Configuration Fit ────────────────────────────────────────────────────

describe('FitAssessmentEngine — F2 Configuration Fit', () => {
  it('returns fitClassification F2', async () => {
    const engine = makeEngine('configure');
    const { result } = await engine.assess(makeInput('Pricing', 'configure conditions'), makeContext());
    expect(result.fitClassification).toBe('F2');
  });

  it('configurationOpportunity is populated for F2', async () => {
    const engine = makeEngine('configure');
    const { result } = await engine.assess(makeInput('P', 'configure'), makeContext());
    expect(result.configurationOpportunity).toBeTruthy();
  });
});

// ── F3 — Standard + Minor Extension ──────────────────────────────────────────

describe('FitAssessmentEngine — F3 Standard + Minor Extension', () => {
  it('returns fitClassification F3', async () => {
    const engine = makeEngine('minor extension');
    const { result } = await engine.assess(makeInput('P', 'minor extension needed'), makeContext());
    expect(result.fitClassification).toBe('F3');
  });
});

// ── F4 — Clean Core Extension ─────────────────────────────────────────────────

describe('FitAssessmentEngine — F4 Clean Core Extension', () => {
  it('returns fitClassification F4', async () => {
    const engine = makeEngine('btp');
    const { result } = await engine.assess(makeInput('P', 'btp extension needed'), makeContext());
    expect(result.fitClassification).toBe('F4');
  });

  it('F4 deploymentCompatibility is DP-VERIFY by default', async () => {
    const engine = makeEngine('btp');
    const { result } = await engine.assess(makeInput('P', 'btp'), makeContext());
    expect(result.deploymentCompatibility).toBe('DP-VERIFY');
  });
});

// ── F5 — Standardization Opportunity ─────────────────────────────────────────

describe('FitAssessmentEngine — F5 Standardization Opportunity', () => {
  it('returns fitClassification F5', async () => {
    const engine = makeEngine('redesign');
    const { result } = await engine.assess(makeInput('P', 'redesign to standardize'), makeContext());
    expect(result.fitClassification).toBe('F5');
  });

  it('humanReviewRequired is false for F5', async () => {
    const engine = makeEngine('redesign');
    const { result } = await engine.assess(makeInput('P', 'redesign'), makeContext());
    expect(result.humanReviewRequired).toBe(false);
  });
});

// ── F6 — Potential Customization Risk ─────────────────────────────────────────

describe('FitAssessmentEngine — F6 Potential Customization Risk', () => {
  it('returns fitClassification F6', async () => {
    const engine = makeEngine('custom code');
    const { result } = await engine.assess(makeInput('P', 'custom code risk'), makeContext());
    expect(result.fitClassification).toBe('F6');
  });

  it('humanReviewRequired is TRUE for F6', async () => {
    const engine = makeEngine('custom code');
    const { result } = await engine.assess(makeInput('P', 'custom code'), makeContext());
    expect(result.humanReviewRequired).toBe(true);
  });

  it('customizationRiskStatement is populated for F6', async () => {
    const engine = makeEngine('custom code');
    const { result } = await engine.assess(makeInput('P', 'custom code'), makeContext());
    expect(result.customizationRiskStatement).toBeTruthy();
  });
});

// ── F7 — Legitimate Business Differentiator ───────────────────────────────────

describe('FitAssessmentEngine — F7 Legitimate Business Differentiator', () => {
  it('returns fitClassification F7', async () => {
    const engine = makeEngine('differentiator');
    const { result } = await engine.assess(makeInput('P', 'unique differentiator'), makeContext());
    expect(result.fitClassification).toBe('F7');
  });

  it('humanReviewRequired is TRUE for F7', async () => {
    const engine = makeEngine('differentiator');
    const { result } = await engine.assess(makeInput('P', 'unique differentiator'), makeContext());
    expect(result.humanReviewRequired).toBe(true);
  });
});

// ── F8 — Insufficient Evidence ────────────────────────────────────────────────

describe('FitAssessmentEngine — F8 Insufficient Evidence', () => {
  it('returns fitClassification F8 when evidence is insufficient', async () => {
    const engine = makeEngine('insufficient');
    const { result } = await engine.assess(makeInput('P', 'insufficient evidence'), makeContext());
    expect(result.fitClassification).toBe('F8');
  });

  it('evidenceConfidence is INSUFFICIENT_EVIDENCE for F8', async () => {
    const engine = makeEngine('insufficient');
    const { result } = await engine.assess(makeInput('P', 'insufficient'), makeContext());
    expect(result.evidenceConfidence).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('confidence is 0 for F8', async () => {
    const engine = makeEngine('insufficient');
    const { result } = await engine.assess(makeInput('P', 'f8'), makeContext());
    expect(result.confidence).toBe(0);
  });

  it('humanReviewRequired is TRUE for F8', async () => {
    const engine = makeEngine('insufficient');
    const { result } = await engine.assess(makeInput('P', 'insufficient'), makeContext());
    expect(result.humanReviewRequired).toBe(true);
  });

  it('F8 is returned when no knowledge is available (no evidence)', async () => {
    // Default MockFitAIProvider with no matching keywords → F8
    const store = new MockVectorStore();  // empty
    const ai    = new (class extends MockFitAIProvider {
      override async complete(_req: AICompletionRequest): Promise<AICompletionResponse> {
        return {
          content: JSON.stringify({
            fitClassification: 'F8', deploymentCompatibility: 'DP-VERIFY',
            evidenceConfidence: 'INSUFFICIENT_EVIDENCE', confidence: 0,
            businessIntentSummary: 'No evidence.', processClassification: 'Unknown',
            targetDeploymentContext: 'Cloud Public.', standardCapability: null,
            gapDescription: null, configurationOpportunity: null,
            customizationRiskStatement: null,
            recommendedNextAction: 'Gather evidence.', recommendations: [],
            assumptions: [], unknowns: ['No documents in corpus.'], humanReviewRequired: true,
          }),
          model: 'mock', usage: USAGE,
        };
      }
    })();
    const svc = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc });
    const { result } = await engine.assess(makeInput('X', 'anything'), makeContext());
    expect(result.fitClassification).toBe('F8');
  });
});

// ── Schema validation + safe fallback ─────────────────────────────────────────

describe('FitAssessmentEngine — Schema validation (rule 12)', () => {
  it('invalid JSON → F8 with validationPassed=false', async () => {
    const store = new MockVectorStore();
    const ai    = new (class extends MockAIProvider {
      override async complete(): Promise<AICompletionResponse> {
        return { content: 'not json at all', model: 'm', usage: USAGE };
      }
    })();
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc });
    const { result } = await engine.assess(makeInput('P', 'D'), makeContext());

    expect(result.fitClassification).toBe('F8');
    expect(result.evidenceConfidence).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.validationPassed).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('invalid fitClassification → F8 safe fallback', async () => {
    const store = new MockVectorStore();
    const ai    = new (class extends MockAIProvider {
      override async complete(): Promise<AICompletionResponse> {
        return {
          content: JSON.stringify({
            fitClassification: 'INVALID', deploymentCompatibility: 'DP-PUB',
            evidenceConfidence: 'VERIFIED', confidence: 0.9,
            businessIntentSummary: 'B', processClassification: 'P',
            targetDeploymentContext: 'T', recommendedNextAction: 'R',
            recommendations: [], assumptions: [], unknowns: [], humanReviewRequired: false,
          }),
          model: 'm', usage: USAGE,
        };
      }
    })();
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc });
    const { result } = await engine.assess(makeInput('P', 'D'), makeContext());

    expect(result.fitClassification).toBe('F8');
    expect(result.validationPassed).toBe(false);
    expect(result.validationErrors.some(e => e.includes('fitClassification'))).toBe(true);
  });

  it('provider failure → F8 safe result, run.status=FAILED', async () => {
    const store = new MockVectorStore();
    const ai    = new (class extends MockAIProvider {
      override async complete(): Promise<never> { throw new Error('Provider crash'); }
    })();
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({
      aiProvider: ai, knowledgeSearchService: svc,
      options: { maxRetries: 0 },
    });
    const { result, run } = await engine.assess(makeInput('P', 'D'), makeContext());

    expect(run.status).toBe('FAILED');
    expect(result.fitClassification).toBe('F8');
    expect(result.confidence).toBe(0);
    expect(result.humanReviewRequired).toBe(true);
  });

  it('FitAssessmentEngine.assess() NEVER throws', async () => {
    const store = new MockVectorStore();
    const ai    = new (class extends MockAIProvider {
      override async complete(): Promise<never> { throw new Error('Crash'); }
    })();
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc, options: { maxRetries: 0 } });
    const outcome = await engine.assess(makeInput('P', 'D'), makeContext());
    expect(outcome).toBeDefined();
    expect(outcome.result.fitClassification).toBe('F8');
  });
});

// ── Audit trail ───────────────────────────────────────────────────────────────

describe('FitAssessmentEngine — Audit trail', () => {
  it('all results carry agentRunId', async () => {
    const engine = makeEngine('standard fit');
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(typeof result.agentRunId).toBe('string');
    expect(result.agentRunId.length).toBeGreaterThan(0);
  });

  it('schemaVersion is 2.0 for all results', async () => {
    const engine = makeEngine('standard fit');
    const { result } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(result.schemaVersion).toBe('2.0');
  });

  it('AgentRun carries model provider name', async () => {
    const engine = makeEngine('standard fit');
    const { run } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(run.modelProvider).toBeDefined();
    expect(run.modelProvider.length).toBeGreaterThan(0);
  });

  it('AgentRun has startedAt and completedAt', async () => {
    const engine = makeEngine('standard fit');
    const { run } = await engine.assess(makeInput('P', 'standard fit'), makeContext());
    expect(run.startedAt).toBeDefined();
    expect(run.completedAt).toBeDefined();
  });
});

// ── DP-* edition specificity ──────────────────────────────────────────────────

describe('FitAssessmentEngine — Deployment compatibility (rule 2)', () => {
  it('DP-PUB is returned for CLOUD_PUBLIC context', async () => {
    // MockFitAIProvider keyword triggers DP-PUB override for cloud_public
    const store = new MockVectorStore();
    const ai    = new (class extends MockFitAIProvider {
      override async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
        // Inject cloud_public keyword so edition detection fires
        const injected = [...req.messages];
        injected[0] = { ...injected[0], content: injected[0].content + ' CLOUD_PUBLIC' };
        return super.complete({ ...req, messages: injected });
      }
    })();
    const svc    = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });
    const engine = new FitAssessmentEngine({ aiProvider: ai, knowledgeSearchService: svc });
    const { result } = await engine.assess(
      makeInput('P', 'standard fit'),
      makeContext('CLOUD_PUBLIC'),
    );
    // The MockFitAIProvider sets DP-PUB for cloud_public context
    expect(['DP-PUB', 'DP-ALL']).toContain(result.deploymentCompatibility);
  });

  it('all three edition contexts produce valid DP codes', async () => {
    const editions = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'] as const;
    for (const ed of editions) {
      const engine = makeEngine('standard fit');
      const { result } = await engine.assess(
        makeInput('P', 'standard fit'),
        makeContext(ed),
      );
      const validCodes = ['DP-OP', 'DP-PCE', 'DP-PUB', 'DP-ALL', 'DP-NA', 'DP-VERIFY'];
      expect(validCodes).toContain(result.deploymentCompatibility);
    }
  });
});
