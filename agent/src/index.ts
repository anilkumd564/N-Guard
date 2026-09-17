/**
 * N-Guard Agent Engine — Public API
 *
 * This is the single entry point for all consumers of the @n-guard/agent package.
 * Only export what other packages need; keep internals private.
 */

// Engine
export { NGuardAgentEngine }    from './engine/AgentEngine.js';
export type { AgentEngine, AgentEngineDeps } from './engine/AgentEngine.js';

// AIProvider
export type {
  AIProvider,
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIUsage,
  MessageRole,
} from './providers/AIProvider.js';
export { MockAIProvider }       from './providers/MockAIProvider.js';

// VectorStore
export type {
  VectorStore,
  VectorDocument,
  VectorDocumentMetadata,
  VectorSearchFilter,
  VectorSearchOptions,
  VectorSearchResult,
} from './vector/VectorStore.js';
export { MockVectorStore }      from './vector/MockVectorStore.js';

// Provider Interfaces (architectural boundaries — Phase 0)
export type {
  KnowledgeProvider,
  KnowledgeMetadata,
  KnowledgeArtifact,
  KnowledgeQuery,
  KnowledgeRetrievalResult,
} from './providers/KnowledgeProvider.js';

export type {
  FileStorageProvider,
  StoredFileRef,
  FileUploadOptions,
} from './providers/FileStorageProvider.js';

export type {
  AuthProvider,
  NGuardPrincipal,
  TokenVerificationOptions,
} from './providers/AuthProvider.js';

export type {
  IntegrationProvider,
  IntegrationRequest,
  IntegrationResponse,
  IntegrationTarget,
  HttpMethod,
} from './providers/IntegrationProvider.js';

// Shared Domain Types
export type {
  S4Edition,
  Verdict,
  Effort,
  Priority,
  RecommendationType,
  EvidenceSource,
  AssessmentRecommendation,
  AssessmentInput,
  AssessmentResult,
  EmbedDocumentInput,
} from './types/index.js';
export { S4_EDITIONS }          from './types/index.js';
