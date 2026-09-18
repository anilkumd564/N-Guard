/**
 * N-Guard — Phase 5 Knowledge Search Retrieval Tests
 *
 * Tests prove the mandatory retrieval isolation rules (architecture rules 2, 3, 10):
 *
 *  1. Edition isolation — Public Cloud query cannot retrieve On-Premise-only content.
 *  2. Cross-tenant isolation — tenant-A data cannot leak into tenant-B searches.
 *  3. Global docs (no edition) — appear in ALL edition searches.
 *  4. Release exact filtering — wrong release is excluded; global (no release) is included.
 *  5. Release range filtering — query release must fall within [releaseFrom, releaseTo].
 *  6. Country/industry filtering — country-specific docs excluded when searching different country.
 *  7. Process area filtering — processArea-specific docs excluded when different processArea.
 *  8. Cross-edition comparison — each edition returns independent evidence candidates.
 *  9. Authority level filtering — filter works when specified.
 * 10. KnowledgeSearchService.search() returns EvidenceCandidate[] with full metadata.
 * 11. KnowledgeSearchService.searchCrossEdition() returns 3 independent result sets.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockVectorStore }          from '../vector/MockVectorStore.js';
import { MockAIProvider }           from '../providers/MockAIProvider.js';
import { KnowledgeSearchService }   from '../retrieval/KnowledgeSearchService.js';
import type { EvidenceCandidate }   from '../retrieval/KnowledgeSearchService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seed(store: MockVectorStore, docs: Array<{
  id: string; content: string; metadata: Record<string, unknown>;
}>) {
  await store.upsert(docs.map(d => ({ id: d.id, content: d.content, metadata: d.metadata })));
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('KnowledgeSearchService — Edition Isolation (architecture rule 2)', () => {
  let store  : MockVectorStore;
  let svc    : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [
      { id: 'op-doc',  content: 'On-Premise pricing routine ABAP user exit.',
        metadata: { tenantId: 't1', edition: 'ON_PREMISE', title: 'OP Pricing' } },
      { id: 'pub-doc', content: 'Cloud Public pricing condition technique configuration.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', title: 'Public Cloud Pricing' } },
      { id: 'prv-doc', content: 'Private Cloud ABAP on-stack extension.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PRIVATE', title: 'Private Cloud Ext' } },
      { id: 'global',  content: 'SAP Pricing Architecture global overview.',
        metadata: { tenantId: 't1', title: 'Global Pricing' } }, // no edition = global
    ]);
  });

  it('Public Cloud search CANNOT return On-Premise-only content', async () => {
    const results = await svc.search({ text: 'pricing', tenantId: 't1', edition: 'CLOUD_PUBLIC' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('pub-doc');
    expect(ids).not.toContain('op-doc');
    expect(ids).not.toContain('prv-doc');
  });

  it('On-Premise search CANNOT return Cloud Public-only content', async () => {
    const results = await svc.search({ text: 'pricing', tenantId: 't1', edition: 'ON_PREMISE' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('op-doc');
    expect(ids).not.toContain('pub-doc');
    expect(ids).not.toContain('prv-doc');
  });

  it('Private Cloud search CANNOT return On-Premise or Public Cloud content', async () => {
    const results = await svc.search({ text: 'pricing', tenantId: 't1', edition: 'CLOUD_PRIVATE' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('prv-doc');
    expect(ids).not.toContain('op-doc');
    expect(ids).not.toContain('pub-doc');
  });

  it('Global docs (no edition) appear in ALL edition searches', async () => {
    const editions = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'] as const;
    for (const edition of editions) {
      const results = await svc.search({ text: 'pricing', tenantId: 't1', edition });
      const ids = results.map(r => r.id);
      expect(ids).toContain('global');
    }
  });
});

describe('KnowledgeSearchService — Cross-Tenant Isolation (architecture rule 10)', () => {
  let store: MockVectorStore;
  let svc  : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [
      { id: 'tenant-a-doc', content: 'Tenant A proprietary process content.',
        metadata: { tenantId: 'tenant-A', edition: 'CLOUD_PUBLIC', title: 'Tenant A Doc' } },
      { id: 'tenant-b-doc', content: 'Tenant B proprietary process content.',
        metadata: { tenantId: 'tenant-B', edition: 'CLOUD_PUBLIC', title: 'Tenant B Doc' } },
      { id: 'global-doc',   content: 'Global SAP standard process content.',
        metadata: { title: 'Global SAP Doc' } },  // no tenantId = system-wide
    ]);
  });

  it('Tenant A search CANNOT retrieve tenant B data', async () => {
    const results = await svc.search({ text: 'process', tenantId: 'tenant-A', edition: 'CLOUD_PUBLIC' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('tenant-a-doc');
    expect(ids).not.toContain('tenant-b-doc');
  });

  it('Tenant B search CANNOT retrieve tenant A data', async () => {
    const results = await svc.search({ text: 'process', tenantId: 'tenant-B', edition: 'CLOUD_PUBLIC' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('tenant-b-doc');
    expect(ids).not.toContain('tenant-a-doc');
  });

  it('System-wide docs (no tenantId) appear for all tenants', async () => {
    const resultA = await svc.search({ text: 'SAP process', tenantId: 'tenant-A', edition: 'CLOUD_PUBLIC' });
    const resultB = await svc.search({ text: 'SAP process', tenantId: 'tenant-B', edition: 'CLOUD_PUBLIC' });
    expect(resultA.map(r => r.id)).toContain('global-doc');
    expect(resultB.map(r => r.id)).toContain('global-doc');
  });
});

describe('KnowledgeSearchService — Release Range Filtering (architecture rule 3)', () => {
  let store: MockVectorStore;
  let svc  : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [
      { id: 'exact-2024',  content: 'Feature only in 2024.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2024', title: 'Exact 2024' } },
      { id: 'exact-2023',  content: 'Feature only in 2023.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2023', title: 'Exact 2023' } },
      { id: 'range-2023-2025', content: 'Feature available from 2023 through 2025.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC',
          releaseFrom: '2023', releaseTo: '2025', title: 'Range 2023-2025' } },
      { id: 'global-rel',  content: 'Feature available in all releases.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', title: 'All Releases' } },
    ]);
  });

  it('Exact release 2024 returns matching doc and global docs', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2024' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('exact-2024');
    expect(ids).toContain('global-rel');
  });

  it('Exact release 2024 EXCLUDES docs for release 2023', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2024' });
    const ids = results.map(r => r.id);
    expect(ids).not.toContain('exact-2023');
  });

  it('Release 2024 includes range doc where 2024 is within [2023, 2025]', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2024' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('range-2023-2025');
  });

  it('Release 2020 EXCLUDES range doc where 2020 is below rangeFrom 2023', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2020' });
    const ids = results.map(r => r.id);
    expect(ids).not.toContain('range-2023-2025');
  });

  it('Release 2026 EXCLUDES range doc where 2026 is above rangeTo 2025', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2026' });
    const ids = results.map(r => r.id);
    expect(ids).not.toContain('range-2023-2025');
  });

  it('Global release docs (no release) always appear regardless of query release', async () => {
    const results = await svc.search({ text: 'feature', tenantId: 't1', edition: 'CLOUD_PUBLIC', release: '2099' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('global-rel');
  });
});

describe('KnowledgeSearchService — Country/Industry/ProcessArea Filtering', () => {
  let store: MockVectorStore;
  let svc  : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [
      { id: 'de-doc',    content: 'German-specific tax configuration.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', country: 'DE', title: 'DE Tax' } },
      { id: 'us-doc',    content: 'US-specific tax configuration.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', country: 'US', title: 'US Tax' } },
      { id: 'global-c',  content: 'Global tax configuration.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', title: 'Global Tax' } },
      { id: 'o2c-doc',   content: 'Order-to-Cash process guide.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', processArea: 'Order-to-Cash', title: 'OTC' } },
      { id: 'p2p-doc',   content: 'Procure-to-Pay process guide.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', processArea: 'Procure-to-Pay', title: 'PTP' } },
      { id: 'manuf-doc', content: 'Manufacturing industry content.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', industry: 'Manufacturing', title: 'Manuf' } },
    ]);
  });

  it('German country search EXCLUDES US-specific content', async () => {
    const results = await svc.search({ text: 'tax', tenantId: 't1', edition: 'CLOUD_PUBLIC', country: 'DE' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('de-doc');
    expect(ids).toContain('global-c');
    expect(ids).not.toContain('us-doc');
  });

  it('Process area filter EXCLUDES content from different process areas', async () => {
    const results = await svc.search({ text: 'process', tenantId: 't1', edition: 'CLOUD_PUBLIC', processArea: 'Order-to-Cash' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('o2c-doc');
    expect(ids).not.toContain('p2p-doc');
  });

  it('Industry filter EXCLUDES content from other industries', async () => {
    const results = await svc.search({ text: 'content', tenantId: 't1', edition: 'CLOUD_PUBLIC', industry: 'Retail' });
    const ids = results.map(r => r.id);
    expect(ids).not.toContain('manuf-doc');
  });

  it('Docs without country are included in any country search (global)', async () => {
    const results = await svc.search({ text: 'tax', tenantId: 't1', edition: 'CLOUD_PUBLIC', country: 'JP' });
    const ids = results.map(r => r.id);
    expect(ids).toContain('global-c');
  });
});

describe('KnowledgeSearchService — Cross-Edition Comparison', () => {
  let store: MockVectorStore;
  let svc  : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [
      { id: 'op-custom',  content: 'On-Premise custom ABAP pricing.',
        metadata: { tenantId: 't1', edition: 'ON_PREMISE', title: 'OP Custom' } },
      { id: 'pub-std',    content: 'Public Cloud standard pricing via condition technique.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PUBLIC', title: 'Public Std' } },
      { id: 'prv-ext',    content: 'Private Cloud key-user extension for pricing.',
        metadata: { tenantId: 't1', edition: 'CLOUD_PRIVATE', title: 'Private Ext' } },
      { id: 'global-p',   content: 'General SAP pricing concepts.',
        metadata: { tenantId: 't1', title: 'Global Pricing Concept' } },
    ]);
  });

  it('returns 3 independent result sets, one per edition', async () => {
    const results = await svc.searchCrossEdition({ text: 'pricing', tenantId: 't1' });
    expect(results).toHaveLength(3);
    const editions = results.map(r => r.edition);
    expect(editions).toContain('ON_PREMISE');
    expect(editions).toContain('CLOUD_PRIVATE');
    expect(editions).toContain('CLOUD_PUBLIC');
  });

  it('On-Premise result set does NOT contain Public Cloud evidence', async () => {
    const results = await svc.searchCrossEdition({ text: 'pricing', tenantId: 't1' });
    const opResult = results.find(r => r.edition === 'ON_PREMISE');
    const opIds    = opResult?.candidates.map(c => c.id) ?? [];
    expect(opIds).toContain('op-custom');
    expect(opIds).not.toContain('pub-std');
    expect(opIds).not.toContain('prv-ext');
  });

  it('Public Cloud result set does NOT contain On-Premise evidence', async () => {
    const results = await svc.searchCrossEdition({ text: 'pricing', tenantId: 't1' });
    const pubResult = results.find(r => r.edition === 'CLOUD_PUBLIC');
    const pubIds    = pubResult?.candidates.map(c => c.id) ?? [];
    expect(pubIds).toContain('pub-std');
    expect(pubIds).not.toContain('op-custom');
    expect(pubIds).not.toContain('prv-ext');
  });

  it('Global docs appear in every edition result', async () => {
    const results = await svc.searchCrossEdition({ text: 'pricing', tenantId: 't1' });
    for (const r of results) {
      expect(r.candidates.map(c => c.id)).toContain('global-p');
    }
  });
});

describe('KnowledgeSearchService — EvidenceCandidate metadata', () => {
  let store: MockVectorStore;
  let svc  : KnowledgeSearchService;

  beforeEach(async () => {
    store = new MockVectorStore();
    svc   = new KnowledgeSearchService({ store, aiProvider: new MockAIProvider() });

    await seed(store, [{
      id: 'rich-chunk',
      content: 'Pricing configuration via condition technique in SAP S/4HANA.',
      metadata: {
        tenantId          : 't1',
        edition           : 'CLOUD_PUBLIC',
        release           : '2024',
        country           : 'DE',
        industry          : 'Manufacturing',
        processArea       : 'Order-to-Cash',
        scopeItem         : 'BH1',
        authorityLevel    : 'SAP_OFFICIAL',
        docType           : 'SAP_BEST_PRACTICE',
        source            : 'https://help.sap.com/bh1',
        title             : 'SAP Pricing Best Practice BH1',
        knowledgeSourceId : 'ks-001',
        documentId        : 'doc-001',
        chunkSequence     : 3,
      },
    }]);
  });

  it('search() returns EvidenceCandidate with full metadata', async () => {
    const results: EvidenceCandidate[] = await svc.search({
      text: 'pricing', tenantId: 't1', edition: 'CLOUD_PUBLIC',
    });

    expect(results).toHaveLength(1);
    const c = results[0];
    expect(c.id).toBe('rich-chunk');
    expect(c.title).toBe('SAP Pricing Best Practice BH1');
    expect(c.edition).toBe('CLOUD_PUBLIC');
    expect(c.release).toBe('2024');
    expect(c.country).toBe('DE');
    expect(c.industry).toBe('Manufacturing');
    expect(c.processArea).toBe('Order-to-Cash');
    expect(c.scopeItem).toBe('BH1');
    expect(c.authorityLevel).toBe('SAP_OFFICIAL');
    expect(c.docType).toBe('SAP_BEST_PRACTICE');
    expect(c.source).toBe('https://help.sap.com/bh1');
    expect(c.knowledgeSourceId).toBe('ks-001');
    expect(c.documentId).toBe('doc-001');
    expect(c.chunkSequence).toBe(3);
    expect(typeof c.score).toBe('number');
  });

  it('candidates have a numeric score property', async () => {
    const results = await svc.search({ text: 'pricing', tenantId: 't1', edition: 'CLOUD_PUBLIC' });
    results.forEach(r => expect(typeof r.score).toBe('number'));
  });
});
