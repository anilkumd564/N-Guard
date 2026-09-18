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

// Phase 9: Clean Core and Extensibility Governance
export { CleanCoreAnalyzer }       from './cleancore/CleanCoreAnalyzer.js';
export { DEFAULT_CATALOG, getRulesForEdition, getRuleForTechnique } from './cleancore/catalog.js';
export type {
  CleanCoreTier,
  CleanCoreRisk,
  ExtensibilityTechnique,
  CleanCoreRule,
  CleanCoreCatalog,
  CleanCoreAnalysisInput,
  CleanCoreAnalysisResult,
  TechniqueApplicability,
} from './cleancore/types.js';
export {
  CLEAN_CORE_TIER_LABELS,
  CLEAN_CORE_TIER_COLORS,
  EXTENSIBILITY_TECHNIQUE_LABELS,
  TECHNIQUE_TIER,
  CLEAN_CORE_RISK_COLORS,
} from './cleancore/types.js';

// Phase 8: Cross-Edition Comparison
export { CrossEditionComparisonEngine } from './comparison/CrossEditionComparisonEngine.js';
export type {
  CrossEditionComparisonResult,
  CrossEditionSummary,
  EditionComparisonResult,
} from './comparison/types.js';

// Phase 7: Fit-to-Standard Assessment
export { FitAssessmentEngine }  from './assessment/FitAssessmentEngine.js';
export { MockFitAIProvider }    from './assessment/MockFitAIProvider.js';
export type {
  FitClassification,
  DeploymentCompatibilityCode,
  EvidenceConfidence,
  FitAssessmentResult,
} from './assessment/types.js';
export {
  ALL_FIT_CLASSIFICATIONS,
  ALL_DEPLOYMENT_CODES,
  ALL_CONFIDENCE_LEVELS,
  FIT_CLASSIFICATION_LABELS,
  FIT_CLASSIFICATION_DESCRIPTIONS,
  DEPLOYMENT_CODE_LABELS,
  CONFIDENCE_LABELS,
} from './assessment/types.js';

// Phase 6: Orchestration
export { AgentOrchestrator }  from './orchestration/AgentOrchestrator.js';
export type {
  AgentContext,
  AgentTool,
  AgentRun,
  AgentRunStatus,
  EvidenceReference,
  StructuredAgentResult,
  OrchestratorOptions,
} from './orchestration/types.js';

// Phase 5: Retrieval
export { KnowledgeSearchService } from './retrieval/KnowledgeSearchService.js';
export type {
  KnowledgeSearchQuery,
  EvidenceCandidate,
  CrossEditionSearchResult,
} from './retrieval/KnowledgeSearchService.js';

// Phase 4: Ingestion
export {
  PlainTextExtractor,
  CsvTextExtractor,
  JsonTextExtractor,
  PdfExtractorStub,
  DocxExtractorStub,
  DocumentExtractorRegistry,
} from './ingestion/DocumentTextExtractor.js';
export type {
  DocumentTextExtractor,
  ExtractionResult,
  ExtractionStatus,
} from './ingestion/DocumentTextExtractor.js';

export { chunkText }          from './ingestion/TextChunker.js';
export type { ChunkOptions, TextChunk } from './ingestion/TextChunker.js';

export { IngestionService }   from './ingestion/IngestionService.js';
export type {
  IngestionInput,
  IngestionResult,
  IngestionResultStatus,
  IngestionChunkResult,
  DocumentMetadata as IngestionDocumentMetadata,
} from './ingestion/IngestionService.js';

export { LocalFileStorageProvider } from './storage/LocalFileStorageProvider.js';

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
