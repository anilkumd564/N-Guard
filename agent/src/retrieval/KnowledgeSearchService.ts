/**
 * N-Guard — KnowledgeSearchService (Phase 5)
 *
 * Implements strict metadata-filtered retrieval before semantic search.
 * This is the single gateway for all knowledge retrieval in N-Guard.
 *
 * Architecture rules:
 *  - Rule 2:  Edition is required in every search query — never inferred.
 *  - Rule 3:  Metadata filters (tenant, edition, release, country, industry)
 *             are applied BEFORE semantic similarity ranking.
 *  - Rule 6:  Independent of CAP / Express.
 *  - Rule 7:  Embedding generation goes through AIProvider.
 *  - Rule 8:  All vector access goes through VectorStore.
 *  - Rule 10: Tenant isolation is a hard boundary — always enforced.
 *
 * Phase 5 capabilities:
 *  - Single-edition assessment retrieval
 *  - Cross-edition comparison (independent retrieval per edition)
 *  - Returns typed EvidenceCandidate[] with full source metadata
 *  - No LLM calls — retrieval only
 *
 * GAP (future phases):
 *  - SAP HANA Cloud Vector Engine adapter replaces MockVectorStore in Phase 14
 *  - Relevance feedback / hybrid search can be added in Phase 7+
 */

import type { AIProvider }  from '../providers/AIProvider.js';
import type { VectorStore, VectorSearchFilter } from '../vector/VectorStore.js';
import type { S4Edition }   from '../types/index.js';

// ─── Query Types ──────────────────────────────────────────────────────────────

/**
 * A knowledge search query.
 * Edition is required — architecture rule 2.
 * Tenant is required — architecture rule 10.
 */
export interface KnowledgeSearchQuery {
  /** Natural-language query text. */
  text            : string;
  /** Tenant scope — mandatory for isolation (rule 10). */
  tenantId        : string;
  /** Project scope — undefined = search tenant-wide knowledge. */
  projectId?      : string;
  /** Target S/4HANA edition — mandatory (rule 2). */
  edition         : S4Edition;
  /** Release filter — undefined = all releases. */
  release?        : string;
  /** Country filter — undefined = global. */
  country?        : string;
  /** Industry filter — undefined = cross-industry. */
  industry?       : string;
  /** SAP process area filter. */
  processArea?    : string;
  /** SAP Scope Item ID filter. */
  scopeItem?      : string;
  /** Authority level filter. */
  authorityLevel? : string;
  /** Maximum results to return.  Default: 6. */
  limit?          : number;
  /** Minimum similarity threshold.  Default: -1.0 (mock) / 0.5 (production). */
  threshold?      : number;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * A single retrieved evidence candidate.
 * Carries full metadata for evidence attribution (architecture rule 4).
 */
export interface EvidenceCandidate {
  /** Unique chunk ID in the vector store. */
  id                : string;
  /** Parent KnowledgeDocument ID. */
  documentId?       : string;
  /** Parent KnowledgeSource ID. */
  knowledgeSourceId?: string;
  /** 1-based position of this chunk in the document. */
  chunkSequence?    : number;
  /** Chunk text excerpt. */
  text              : string;
  /** Document title. */
  title             : string;
  /** Original source URL or citation reference. */
  source?           : string;
  /** Applicable SAP edition (null = all editions). */
  edition?          : string;
  /** Applicable release (null = all releases). */
  release?          : string;
  /** Country scope (null = global). */
  country?          : string;
  /** Industry scope (null = cross-industry). */
  industry?         : string;
  /** SAP process area. */
  processArea?      : string;
  /** SAP Scope Item ID. */
  scopeItem?        : string;
  /** Authority level of the knowledge content. */
  authorityLevel?   : string;
  /** Document type classification. */
  docType?          : string;
  /** Cosine similarity score (0.0 – 1.0). */
  score             : number;
}

/**
 * Result of a cross-edition comparison search.
 * Each edition is searched INDEPENDENTLY — evidence from one edition
 * is never mixed into another edition's result set (architecture rule 2).
 */
export interface CrossEditionSearchResult {
  edition    : S4Edition;
  candidates : EvidenceCandidate[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class KnowledgeSearchService {
  private readonly store      : VectorStore;
  private readonly aiProvider : AIProvider;

  constructor(deps: { store: VectorStore; aiProvider: AIProvider }) {
    this.store      = deps.store;
    this.aiProvider = deps.aiProvider;
  }

  /**
   * Search for evidence candidates for a single edition.
   *
   * Metadata filters are applied BEFORE semantic similarity (rule 3).
   * Results are ranked by similarity score (descending).
   */
  async search(query: KnowledgeSearchQuery): Promise<EvidenceCandidate[]> {
    // Generate embedding for the query text
    const embeddingResponse = await this.aiProvider.embed({ texts: [query.text] });
    const queryEmbedding    = embeddingResponse.embeddings[0];

    const filter: VectorSearchFilter = {
      tenantId      : query.tenantId,
      projectId     : query.projectId,
      edition       : query.edition,
      release       : query.release,
      country       : query.country,
      industry      : query.industry,
      processArea   : query.processArea,
      scopeItem     : query.scopeItem,
      authorityLevel: query.authorityLevel,
    };

    const results = await this.store.search(queryEmbedding, {
      filter,
      limit     : query.limit     ?? 6,
      threshold : query.threshold ?? -1.0,  // -1.0 in dev; increase for production
    });

    return results.map(r => toEvidenceCandidate(r.document.id, r.document.content, r.document.metadata, r.score));
  }

  /**
   * Search across all three S/4HANA editions independently.
   *
   * Each edition is searched with its own filter.  Evidence from one edition
   * is never mixed into another edition's result set (architecture rule 2).
   *
   * Use this for cross-edition process comparison (Phase 8+).
   */
  async searchCrossEdition(
    query   : Omit<KnowledgeSearchQuery, 'edition'>,
    editions: readonly S4Edition[] = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'],
  ): Promise<CrossEditionSearchResult[]> {
    const results: CrossEditionSearchResult[] = [];

    for (const edition of editions) {
      const candidates = await this.search({ ...query, edition });
      results.push({ edition, candidates });
    }

    return results;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEvidenceCandidate(
  id       : string,
  text     : string,
  metadata : Record<string, unknown>,
  score    : number,
): EvidenceCandidate {
  return {
    id,
    documentId        : metadata['documentId']        as string | undefined,
    knowledgeSourceId : metadata['knowledgeSourceId'] as string | undefined,
    chunkSequence     : metadata['chunkSequence']     as number | undefined,
    text,
    title             : (metadata['title']            as string | undefined) ?? id,
    source            : metadata['source']            as string | undefined,
    edition           : metadata['edition']           as string | undefined,
    release           : metadata['release']           as string | undefined,
    country           : metadata['country']           as string | undefined,
    industry          : metadata['industry']          as string | undefined,
    processArea       : metadata['processArea']       as string | undefined,
    scopeItem         : metadata['scopeItem']         as string | undefined,
    authorityLevel    : metadata['authorityLevel']    as string | undefined,
    docType           : metadata['docType']           as string | undefined,
    score,
  };
}
