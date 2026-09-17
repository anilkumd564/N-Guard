/**
 * N-Guard — VectorStore Abstraction
 *
 * Architecture rule 8: ALL vector/RAG access must go through VectorStore.
 * No component may query a vector database directly.
 *
 * Concrete implementations:
 *  - MockVectorStore   (development — cosine similarity on in-memory vectors)
 *  - HanaVectorStore   (production — SAP HANA Cloud Vector Engine)
 *
 * Retrieval MUST filter by tenantId, projectId, edition, and release
 * BEFORE performing semantic search (architecture rule 3).
 */

// ─── Document Model ───────────────────────────────────────────────────────────

export interface VectorDocumentMetadata {
  tenantId?  : string;
  projectId? : string;
  edition?   : string;   // S4Edition value or undefined = applies to all
  release?   : string;   // S4Release value or undefined = applies to all
  docType?   : string;
  source?    : string;
  title?     : string;
  [key: string]: unknown;
}

export interface VectorDocument {
  id        : string;
  content   : string;
  embedding?: number[];   // Optional on input; populated on retrieval
  metadata  : VectorDocumentMetadata;
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Filters applied BEFORE semantic search.
 * Rule 3: tenantId + edition + release filtering is mandatory for retrieval.
 */
export interface VectorSearchFilter {
  tenantId?  : string;
  projectId? : string;
  edition?   : string;   // When set, only docs with this edition OR null edition
  release?   : string;   // When set, only docs with this release OR null release
}

export interface VectorSearchOptions {
  filter    : VectorSearchFilter;
  limit?    : number;    // Default: 5
  threshold?: number;    // Minimum similarity score (0.0 – 1.0); default: 0.6
}

export interface VectorSearchResult {
  document : VectorDocument;
  score    : number;      // Cosine similarity 0.0 – 1.0
}

// ─── Store Interface ──────────────────────────────────────────────────────────

/**
 * VectorStore is the single gateway to all vector/RAG operations.
 * Inject this interface into any component that performs semantic retrieval.
 */
export interface VectorStore {
  /** Human-readable store name (e.g. 'mock', 'hana'). */
  readonly storeName : string;

  /**
   * Upsert documents into the store.
   * If `embedding` is omitted, the store implementation must generate it
   * (typically by calling AIProvider.embed internally).
   */
  upsert(documents: VectorDocument[]): Promise<void>;

  /**
   * Search for documents semantically similar to the query.
   * The filter is applied BEFORE similarity ranking (rule 3).
   *
   * @param query  Plain-text query string OR pre-computed embedding vector.
   * @param options Search options including mandatory filter.
   */
  search(
    query   : string | number[],
    options : VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;

  /**
   * Delete documents by ID.
   */
  delete(ids: string[]): Promise<void>;
}
