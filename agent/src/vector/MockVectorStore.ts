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

      if (filter.tenantId  && m.tenantId  && m.tenantId  !== filter.tenantId)  return false;
      if (filter.projectId && m.projectId && m.projectId !== filter.projectId) return false;

      // Edition filter: include docs that match OR docs with no edition set
      if (filter.edition && m.edition && m.edition !== filter.edition) return false;

      // Release filter: include docs that match OR docs with no release set
      if (filter.release && m.release && m.release !== filter.release) return false;

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
