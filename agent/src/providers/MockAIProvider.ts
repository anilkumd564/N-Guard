/**
 * N-Guard — MockAIProvider
 *
 * Development and test implementation of AIProvider.
 * Makes NO external API calls.
 *
 * Completions return deterministic structured JSON shaped to the agent's
 * AssessmentOutput schema so that the full pipeline can be exercised locally.
 *
 * Embeddings return random unit vectors of dimension 1536 (matching
 * text-embedding-3-small) so cosine similarity logic can be tested.
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
} from './AIProvider.js';

/** Deterministic mock assessment output returned for any input. */
const MOCK_ASSESSMENT_RESPONSE = {
  verdict    : 'FIT_TO_STANDARD',
  rationale  : '[MOCK] The described requirement aligns with SAP standard functionality. No custom development is required. Refer to standard configuration options in Customizing.',
  confidence : 0.82,
  evidenceSources: [
    {
      docId   : 'mock-doc-001',
      title   : 'SAP S/4HANA Best Practice — Order Management',
      excerpt : 'Standard order management covers the described scenario via configuration.',
      score   : 0.91,
    },
  ],
  recommendations: [
    {
      type        : 'CONFIGURATION',
      description : 'Enable the relevant Customizing activity in SPRO under Sales and Distribution → Basic Functions.',
      effort      : 'LOW',
      priority    : 'HIGH',
      rationale   : 'This is a standard configuration option available in all S/4HANA editions.',
    },
  ],
};

export class MockAIProvider implements AIProvider {
  readonly providerName = 'mock';
  readonly modelName    = 'mock-gpt-4o';

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Simulate minimal latency in tests
    await delay(10);

    const isJsonMode = request.responseFormat === 'json';
    const content = isJsonMode
      ? JSON.stringify(MOCK_ASSESSMENT_RESPONSE)
      : '[MOCK] This is a mock AI completion response.';

    return {
      content,
      model : this.modelName,
      usage : {
        promptTokens     : estimateTokens(request.messages.map(m => m.content).join(' ')),
        completionTokens : estimateTokens(content),
        totalTokens      : 0, // filled below
      },
    };
  }

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    await delay(5);
    return {
      embeddings : request.texts.map(() => randomUnitVector(1536)),
      model      : 'mock-text-embedding-3-small',
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function randomUnitVector(dim: number): number[] {
  const vec = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}
