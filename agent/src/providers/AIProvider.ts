/**
 * N-Guard — AIProvider Abstraction
 *
 * Architecture rule 7: ALL LLM access must go through AIProvider.
 * No component outside this interface may call an LLM API directly.
 *
 * Concrete implementations:
 *  - MockAIProvider     (development / testing — no external calls)
 *  - AICoreAIProvider   (SAP AI Core / Generative AI Hub — production BTP)
 *
 * Future implementations can be added without touching the Agent Engine
 * or any CAP handler.
 */

// ─── Message Types ────────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role    : MessageRole;
  content : string;
}

// ─── Completion ───────────────────────────────────────────────────────────────

export interface AICompletionRequest {
  messages       : AIMessage[];
  temperature?   : number;          // Default: 0.2 (deterministic for governance)
  maxTokens?     : number;
  responseFormat?: 'text' | 'json'; // Use 'json' for structured agent output (rule 12)
}

export interface AIUsage {
  promptTokens     : number;
  completionTokens : number;
  totalTokens      : number;
}

export interface AICompletionResponse {
  content : string;
  model   : string;
  usage   : AIUsage;
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

export interface AIEmbeddingRequest {
  texts  : string[];
  model? : string;   // Optional override; defaults to provider's embedding model
}

export interface AIEmbeddingResponse {
  embeddings : number[][];
  model      : string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * AIProvider is the single gateway to all language model capabilities.
 * Inject this interface into any component that needs LLM access.
 */
export interface AIProvider {
  /** The human-readable name of this provider (e.g. 'mock', 'aicore'). */
  readonly providerName : string;

  /** The model identifier used for completions. */
  readonly modelName : string;

  /**
   * Send a chat completion request.
   * When responseFormat = 'json', the response content is a valid JSON string.
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Generate embedding vectors for the given texts.
   * Used by the VectorStore to convert document chunks and queries
   * into comparable vector representations.
   */
  embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;
}
