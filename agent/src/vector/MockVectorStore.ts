/**
 * N-Guard — MockVectorStore
 *
 * Development and test implementation of VectorStore.
 * Stores documents in memory using a Map.
 * Performs cosine similarity search in-process — no external services.
 *
 * Architecture rule 3 is enforced here:
 * Edition and release filters are applied BEFORE cosine similarity ranking.
 */

import type {
  VectorStore,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
} from './VectorStore.js';

export class MockVectorStore implements VectorStore {
  readonly storeName = 'mock';

  /** In-memory document store: id → VectorDocument */
  private readonly _store = new Map<string, VectorDocument>();

  async upsert(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      // Generate a random embedding if one is not provided
      const embedding = doc.embedding ?? randomUnitVector(1536);
      this._store.set(doc.id, { ...doc, embedding });
    }
  }

  async search(
    query: string | number[],
    options: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    // Default threshold of -1.0 in the mock ensures all metadata-passing docs
    // are returned regardless of random embedding similarity (mock has no real
    // semantics). Production stores (HANA) use a meaningful default (e.g. 0.6).
    const { filter, limit = 5, threshold = -1.0 } = options;

    // Convert text query to a random vector (mock — no real embedding call)
    const queryVec: number[] = Array.isArray(query)
      ? query
      : randomUnitVector(1536);

    // ── Step 1: Pre-filter by tenant / project / edition / release ────────────
    // Architecture rule 3: metadata filters applied BEFORE similarity ranking.
    const candidates = [...this._store.values()].filter(doc => {
      const m = doc.metadata;

      // Tenant isolation — hard boundary (rule 10)
      if (filter.tenantId && m.tenantId && m.tenantId !== filter.tenantId) return false;

      // Project scope — docs with no project are tenant-wide (global within tenant)
      if (filter.projectId && m.projectId && m.projectId !== filter.projectId) return false;

      // Edition filter (rule 2): include docs that match edition OR docs with no edition (global)
      if (filter.edition && m.edition && m.edition !== filter.edition) return false;

      // Release filter: include docs where:
      //  a) doc has no release AND no range (global) — always include
      //  b) doc has exact release match
      //  c) doc has a release range: filter.release is within [releaseFrom, releaseTo]
      //  d) doc has releaseFrom/releaseTo but no exact release — filter by range only
      if (filter.release) {
        const docRelease  = m.release    as string | undefined;
        const rangeFrom   = m.releaseFrom as string | undefined;
        const rangeTo     = m.releaseTo   as string | undefined;
        const hasRange    = !!(rangeFrom || rangeTo);

        if (docRelease) {
          // Exact release doc: match or check range override
          if (docRelease !== filter.release) {
            if (hasRange) {
              const inRange = (!rangeFrom || filter.release >= rangeFrom) &&
                              (!rangeTo   || filter.release <= rangeTo);
              if (!inRange) return false;
            } else {
              return false;
            }
          }
        } else if (hasRange) {
          // Range-only doc (no exact release): filter by range
          const inRange = (!rangeFrom || filter.release >= rangeFrom) &&
                          (!rangeTo   || filter.release <= rangeTo);
          if (!inRange) return false;
        }
        // else: global doc (no release, no range) — always include
      }

      // Country filter: include docs with matching country OR no country (global)
      if (filter.country && m.country && m.country !== 'GLOBAL' && m.country !== filter.country) return false;

      // Industry filter: include docs with matching industry OR no industry
      if (filter.industry && m.industry && m.industry !== filter.industry) return false;

      // Process area filter: include docs with matching processArea OR no processArea
      if (filter.processArea && m.processArea && m.processArea !== filter.processArea) return false;

      // Scope item filter: include docs with matching scopeItem OR no scopeItem
      if (filter.scopeItem && m.scopeItem && m.scopeItem !== filter.scopeItem) return false;

      // Authority level filter: exact match when specified
      if (filter.authorityLevel && m.authorityLevel && m.authorityLevel !== filter.authorityLevel) return false;

      return true;
    });

    // ── Step 2: Cosine similarity ranking ─────────────────────────────────────
    const scored: VectorSearchResult[] = candidates
      .map(doc => ({
        document : doc,
        score    : doc.embedding
          ? cosineSimilarity(queryVec, doc.embedding)
          : 0,
      }))
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this._store.delete(id);
    }
  }

  /** Expose store size for testing. */
  get size(): number {
    return this._store.size;
  }

  /** Clear all documents — useful in test teardown. */
  clear(): void {
    this._store.clear();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomUnitVector(dim: number): number[] {
  const vec = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map(v => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
