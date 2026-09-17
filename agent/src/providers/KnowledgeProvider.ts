/**
 * N-Guard — KnowledgeProvider Abstraction
 *
 * A KnowledgeProvider is responsible for retrieving structured SAP knowledge
 * artifacts (best practices, scope items, release notes, process guides) that
 * the Agent Engine uses as evidence when producing assessments.
 *
 * Architecture rules:
 *  - Retrieval MUST be filtered by edition and release before any semantic
 *    ranking (architecture rule 3).
 *  - Results carry structured metadata (SAP product, edition, release,
 *    country/localization, industry, process area, scope item, source,
 *    authority level, validity dates) as required by architecture rule 4.
 *  - All LLM access remains via AIProvider (rule 7).
 *  - No provider may be called directly from CAP handlers (rule 6).
 *
 * Concrete implementations (future phases):
 *  - MockKnowledgeProvider  (Phase 0 dev/test — returns hardcoded stubs)
 *  - HanaKnowledgeProvider  (Phase N — SAP HANA Cloud full-text + vector)
 *  - S4APIKnowledgeProvider (Phase N — SAP S/4HANA API catalogue integration)
 */

import type { S4Edition } from '../types/index.js';

// ─── Knowledge Artifact Metadata ─────────────────────────────────────────────

/**
 * Rich metadata carried by every knowledge artifact.
 * Maps directly to architecture requirement 4 fields.
 */
export interface KnowledgeMetadata {
  /** SAP product identifier, e.g. 'S4HANA', 'ECC'. */
  sapProduct      : string;

  /** Target deployment edition. */
  edition         : S4Edition;

  /** Target release label, e.g. '2024'. Undefined = all releases. */
  release?        : string;

  /** Country/region applicability. Undefined = global. */
  country?        : string;

  /** Industry vertical, e.g. 'Manufacturing', 'Retail'. Undefined = cross-industry. */
  industry?       : string;

  /** SAP process area / functional area, e.g. 'Order-to-Cash', 'Procure-to-Pay'. */
  processArea?    : string;

  /** SAP Scope Item ID, e.g. 'BH1', 'J45'. */
  scopeItem?      : string;

  /** Document source / citation URL or reference string. */
  source          : string;

  /**
   * Authority level of this knowledge artifact.
   * 'SAP_OFFICIAL' = SAP documentation/help portal.
   * 'PARTNER'      = certified partner content.
   * 'INTERNAL'     = customer/project-internal decision.
   */
  authorityLevel  : 'SAP_OFFICIAL' | 'PARTNER' | 'INTERNAL';

  /** ISO 8601 date from which this artifact is valid. */
  validFrom?      : string;

  /** ISO 8601 date until which this artifact is valid. Undefined = indefinite. */
  validTo?        : string;

  /** Tenant that owns this artifact. Undefined = global/system knowledge. */
  tenantId?       : string;

  /** Project that owns this artifact. Undefined = tenant-wide knowledge. */
  projectId?      : string;
}

// ─── Knowledge Artifact ───────────────────────────────────────────────────────

export interface KnowledgeArtifact {
  id       : string;
  title    : string;
  content  : string;
  metadata : KnowledgeMetadata;
}

// ─── Retrieval Query ──────────────────────────────────────────────────────────

/**
 * Query used to retrieve knowledge artifacts.
 * Mandatory filter fields are applied BEFORE semantic ranking (rule 3).
 */
export interface KnowledgeQuery {
  /** Natural-language query or requirement description. */
  query           : string;

  /** Target edition — REQUIRED (rules 1, 2). */
  edition         : S4Edition;

  /** Optional release filter. */
  release?        : string;

  /** Optional tenant scoping. */
  tenantId?       : string;

  /** Optional project scoping. */
  projectId?      : string;

  /** Optional process area filter. */
  processArea?    : string;

  /** Optional scope item filter. */
  scopeItem?      : string;

  /** Maximum number of results. Default: 5. */
  limit?          : number;

  /** Minimum relevance score (0.0 – 1.0). Default: 0.6. */
  threshold?      : number;
}

// ─── Retrieval Result ─────────────────────────────────────────────────────────

export interface KnowledgeRetrievalResult {
  artifact        : KnowledgeArtifact;
  /** Relevance score 0.0 – 1.0. */
  score           : number;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * KnowledgeProvider is the single gateway to SAP knowledge retrieval.
 * Inject this interface into the Agent Engine; never call storage directly.
 */
export interface KnowledgeProvider {
  /** Human-readable provider name. */
  readonly providerName : string;

  /**
   * Retrieve knowledge artifacts relevant to the query.
   * Edition and release filters are applied BEFORE semantic ranking (rule 3).
   */
  retrieve(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult[]>;

  /**
   * Ingest a knowledge artifact into the provider's backing store.
   * Implementations handle chunking, embedding, and indexing.
   */
  ingest(artifact: KnowledgeArtifact): Promise<void>;

  /**
   * Remove an artifact by ID.
   */
  remove(id: string): Promise<void>;
}
