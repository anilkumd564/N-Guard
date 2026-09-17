/**
 * N-Guard — Phase 4 Knowledge Ingestion Tests
 *
 * Tests cover:
 *  1. PlainTextExtractor — TXT / MD content extraction
 *  2. CsvTextExtractor — CSV to text conversion
 *  3. JsonTextExtractor — JSON to text conversion
 *  4. PdfExtractorStub — returns 'unsupported' without error
 *  5. DocxExtractorStub — returns 'unsupported' without error
 *  6. DocumentExtractorRegistry — MIME-type dispatch, fallback, unknown types
 *  7. TextChunker — chunk count, overlap, minimum chunk merge
 *  8. IngestionService — completed / empty / unsupported / error paths
 *  9. Metadata retention — every chunk carries correct metadata fields
 * 10. LocalFileStorageProvider — upload / download / delete / list (in-memory temp dir)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs   from 'node:fs';
import path from 'node:path';
import os   from 'node:os';

import {
  PlainTextExtractor,
  CsvTextExtractor,
  JsonTextExtractor,
  PdfExtractorStub,
  DocxExtractorStub,
  DocumentExtractorRegistry,
} from '../ingestion/DocumentTextExtractor.js';

import { chunkText } from '../ingestion/TextChunker.js';

import { IngestionService } from '../ingestion/IngestionService.js';

import { LocalFileStorageProvider } from '../storage/LocalFileStorageProvider.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const enc = (s: string) => Buffer.from(s, 'utf-8');

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ');
}

// ── PlainTextExtractor ────────────────────────────────────────────────────────

describe('PlainTextExtractor', () => {
  const ext = new PlainTextExtractor();

  it('extracts plain text content', async () => {
    const result = await ext.extract(enc('Hello world\nSecond line.'), 'text/plain');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('Hello world');
    expect(result.characterCount).toBeGreaterThan(0);
  });

  it('returns empty for blank file', async () => {
    const result = await ext.extract(enc('   \n  '), 'text/plain');
    expect(result.status).toBe('empty');
    expect(result.text).toBe('');
  });

  it('handles markdown content', async () => {
    const md = '# SAP S/4HANA Best Practice\n\nUse standard processes first.';
    const result = await ext.extract(enc(md), 'text/markdown');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('SAP S/4HANA');
  });

  it('supports text/plain, text/markdown, text/x-markdown', () => {
    expect(ext.supportedMimeTypes).toContain('text/plain');
    expect(ext.supportedMimeTypes).toContain('text/markdown');
    expect(ext.supportedMimeTypes).toContain('text/x-markdown');
  });
});

// ── CsvTextExtractor ──────────────────────────────────────────────────────────

describe('CsvTextExtractor', () => {
  const ext = new CsvTextExtractor();

  it('converts CSV rows to key: value text', async () => {
    const csv = 'Title,Process,Module\n"Custom pricing",Order-to-Cash,SD\nInventory check,MM,MM';
    const result = await ext.extract(enc(csv), 'text/csv');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('Title: Custom pricing');
    expect(result.text).toContain('Process: Order-to-Cash');
    expect(result.text).toContain('Module: SD');
  });

  it('returns empty for header-only CSV', async () => {
    const result = await ext.extract(enc('Title,Process,Module\n'), 'text/csv');
    expect(result.status).toBe('empty');
  });

  it('handles quoted fields with commas', async () => {
    const csv = 'Name,Value\n"One, Two, Three","A, B"';
    const result = await ext.extract(enc(csv), 'text/csv');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('Name: One, Two, Three');
  });

  it('skips cells where both key and value are empty', async () => {
    const csv = 'A,B,C\n,,value';
    const result = await ext.extract(enc(csv), 'text/csv');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('C: value');
    expect(result.text).not.toContain('A:');
  });
});

// ── JsonTextExtractor ─────────────────────────────────────────────────────────

describe('JsonTextExtractor', () => {
  const ext = new JsonTextExtractor();

  it('converts JSON object to text', async () => {
    const json = JSON.stringify({ title: 'Best Practice', description: 'Use standard.' });
    const result = await ext.extract(enc(json), 'application/json');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('title: Best Practice');
    expect(result.text).toContain('description: Use standard.');
  });

  it('converts JSON array to text', async () => {
    const json = JSON.stringify(['Item one', 'Item two']);
    const result = await ext.extract(enc(json), 'application/json');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('Item one');
    expect(result.text).toContain('Item two');
  });

  it('returns error for invalid JSON', async () => {
    const result = await ext.extract(enc('{ invalid }'), 'application/json');
    expect(result.status).toBe('error');
  });

  it('returns empty for empty file', async () => {
    const result = await ext.extract(enc(''), 'application/json');
    expect(result.status).toBe('empty');
  });
});

// ── PdfExtractorStub ──────────────────────────────────────────────────────────

describe('PdfExtractorStub', () => {
  it('returns unsupported without throwing', async () => {
    const stub = new PdfExtractorStub();
    const result = await stub.extract(enc('%PDF-1.4 fake'), 'application/pdf');
    expect(result.status).toBe('unsupported');
    expect(result.text).toBe('');
    expect(result.note).toContain('pdf-parse');
  });

  it('includes install instructions in the note', async () => {
    const stub = new PdfExtractorStub();
    const result = await stub.extract(Buffer.alloc(10), 'application/pdf');
    expect(result.note).toContain('pdf-parse');
    // The note explicitly references OCR to remind implementers not to use it
    expect(result.note).toContain('OCR');
  });
});

// ── DocxExtractorStub ─────────────────────────────────────────────────────────

describe('DocxExtractorStub', () => {
  it('returns unsupported without throwing', async () => {
    const stub = new DocxExtractorStub();
    const result = await stub.extract(Buffer.alloc(10),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.status).toBe('unsupported');
    expect(result.note).toContain('mammoth');
  });
});

// ── DocumentExtractorRegistry ─────────────────────────────────────────────────

describe('DocumentExtractorRegistry', () => {
  const registry = new DocumentExtractorRegistry();

  it('dispatches text/plain to PlainTextExtractor', () => {
    const ext = registry.findExtractor('text/plain');
    expect(ext).toBeInstanceOf(PlainTextExtractor);
  });

  it('dispatches text/csv to CsvTextExtractor', () => {
    const ext = registry.findExtractor('text/csv');
    expect(ext).toBeInstanceOf(CsvTextExtractor);
  });

  it('dispatches application/json to JsonTextExtractor', () => {
    const ext = registry.findExtractor('application/json');
    expect(ext).toBeInstanceOf(JsonTextExtractor);
  });

  it('dispatches application/pdf to PdfExtractorStub', () => {
    const ext = registry.findExtractor('application/pdf');
    expect(ext).toBeInstanceOf(PdfExtractorStub);
  });

  it('falls back to PlainTextExtractor for unknown text/* types', () => {
    const ext = registry.findExtractor('text/x-custom');
    expect(ext).toBeInstanceOf(PlainTextExtractor);
  });

  it('returns null for unknown binary types', () => {
    const ext = registry.findExtractor('application/x-binary-unknown');
    expect(ext).toBeNull();
  });

  it('normalises MIME type — strips charset parameter', () => {
    const ext = registry.findExtractor('text/plain; charset=utf-8');
    expect(ext).toBeInstanceOf(PlainTextExtractor);
  });

  it('extract() returns unsupported for unknown binary', async () => {
    const result = await registry.extract(Buffer.alloc(5), 'application/x-unknown');
    expect(result.status).toBe('unsupported');
  });

  it('extract() succeeds end-to-end for text/plain', async () => {
    const result = await registry.extract(enc('Hello SAP'), 'text/plain', 'test.txt');
    expect(result.status).toBe('ok');
    expect(result.text).toBe('Hello SAP');
  });
});

// ── TextChunker ───────────────────────────────────────────────────────────────

describe('chunkText', () => {
  it('returns empty array for empty text', () => {
    expect(chunkText('')).toHaveLength(0);
    expect(chunkText('  \n  ')).toHaveLength(0);
  });

  it('returns single chunk for short text (fewer words than targetWords)', () => {
    const chunks = chunkText('Hello world.', { targetWords: 400 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sequence).toBe(1);
    expect(chunks[0].text).toContain('Hello');
  });

  it('produces multiple chunks for long text', () => {
    const text = words(1000);
    const chunks = chunkText(text, { targetWords: 200, overlapWords: 20, minChunkWords: 10 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('each chunk has a positive word count', () => {
    const chunks = chunkText(words(500), { targetWords: 100, overlapWords: 10 });
    chunks.forEach(c => expect(c.wordCount).toBeGreaterThan(0));
  });

  it('chunk sequences are consecutive 1-based integers', () => {
    const chunks = chunkText(words(500), { targetWords: 100, overlapWords: 10 });
    chunks.forEach((c, i) => expect(c.sequence).toBe(i + 1));
  });

  it('chunk text matches original text slice (charStart/charEnd)', () => {
    const text = words(500);
    const chunks = chunkText(text, { targetWords: 100, overlapWords: 10 });
    for (const c of chunks) {
      const sliced = text.slice(c.charStart, c.charEnd).trim();
      expect(sliced).toBe(c.text);
    }
  });

  it('merges trailing micro-chunk when shorter than minChunkWords', () => {
    // Build exactly 410 words → 400-word first chunk + 10-word trailing
    // with minChunkWords = 30, the 10-word remainder is merged.
    const text = words(410);
    const chunks = chunkText(text, { targetWords: 400, overlapWords: 0, minChunkWords: 30 });
    // Should be 1 chunk (the 10 trailing words merged into the first)
    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBe(410);
  });

  it('does not merge trailing chunk when it meets minChunkWords', () => {
    const text = words(450);
    const chunks = chunkText(text, { targetWords: 400, overlapWords: 0, minChunkWords: 30 });
    // 400 + 50 remaining (≥ 30) → 2 chunks
    expect(chunks).toHaveLength(2);
  });
});

// ── IngestionService ──────────────────────────────────────────────────────────

describe('IngestionService', () => {
  let tmpDir: string;
  let storage: LocalFileStorageProvider;
  let svc: IngestionService;

  const metadata = {
    tenantId          : 'tenant-001',
    projectId         : 'proj-001',
    knowledgeSourceId : 'ks-001',
    title             : 'Test Document',
    authorityLevel    : 'INTERNAL',
    edition           : 'CLOUD_PUBLIC',
  };

  beforeEach(() => {
    tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'nguard-test-'));
    storage = new LocalFileStorageProvider(tmpDir);
    svc     = new IngestionService({ storage });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ingests a plain text file and returns completed status', async () => {
    const content = 'This is a test document about SAP S/4HANA Order-to-Cash process.';
    const result = await svc.ingest({
      content : enc(content),
      fileName: 'test.txt',
      mimeType: 'text/plain',
      metadata,
    });

    expect(result.status).toBe('completed');
    expect(result.extractedText).toContain('SAP S/4HANA');
    expect(result.extractedLength).toBeGreaterThan(0);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.storageUri).toBeDefined();
  });

  it('stores the raw file via FileStorageProvider', async () => {
    const content = enc('SAP best practice content.');
    await svc.ingest({
      content, fileName: 'doc.md', mimeType: 'text/markdown', metadata,
    });

    const files = await storage.list('tenant-001', 'proj-001');
    expect(files.length).toBe(1);
    expect(files[0].filename).toBe('doc.md');
  });

  it('returns empty status for blank file', async () => {
    const result = await svc.ingest({
      content : enc(''),
      fileName: 'empty.txt',
      mimeType: 'text/plain',
      metadata,
    });
    expect(result.status).toBe('empty');
    expect(result.chunks).toHaveLength(0);
  });

  it('returns unsupported status for PDF', async () => {
    const result = await svc.ingest({
      content : Buffer.from('%PDF-1.4 fake content'),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      metadata,
    });
    expect(result.status).toBe('unsupported');
    expect(result.chunks).toHaveLength(0);
    expect(result.note).toContain('pdf-parse');
  });

  it('returns unsupported status for DOCX', async () => {
    const result = await svc.ingest({
      content : Buffer.alloc(100),
      fileName: 'test.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata,
    });
    expect(result.status).toBe('unsupported');
  });

  it('produces multiple chunks for long document', async () => {
    const longText = Array.from({ length: 1000 }, (_, i) =>
      `SAP standard process word${i + 1}`
    ).join(' ');
    const result = await svc.ingest({
      content : enc(longText),
      fileName: 'long.txt',
      mimeType: 'text/plain',
      metadata,
      chunkOptions: { targetWords: 100, overlapWords: 10, minChunkWords: 10 },
    });
    expect(result.status).toBe('completed');
    expect(result.chunks.length).toBeGreaterThan(1);
  });

  it('chunk sequences start at 1 and are consecutive', async () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const result = await svc.ingest({
      content : enc(text),
      fileName: 'seq.txt',
      mimeType: 'text/plain',
      metadata,
      chunkOptions: { targetWords: 100, overlapWords: 0, minChunkWords: 10 },
    });
    result.chunks.forEach((c, i) => expect(c.sequence).toBe(i + 1));
  });

  it('metadata is echoed back in the result', async () => {
    const result = await svc.ingest({
      content : enc('Some content about SAP S/4HANA.'),
      fileName: 'meta.txt',
      mimeType: 'text/plain',
      metadata,
    });
    expect(result.metadata.edition).toBe('CLOUD_PUBLIC');
    expect(result.metadata.tenantId).toBe('tenant-001');
    expect(result.metadata.knowledgeSourceId).toBe('ks-001');
  });
});

// ── LocalFileStorageProvider ──────────────────────────────────────────────────

describe('LocalFileStorageProvider', () => {
  let tmpDir: string;
  let provider: LocalFileStorageProvider;

  beforeEach(() => {
    tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'nguard-storage-'));
    provider = new LocalFileStorageProvider(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uploads a file and returns a StoredFileRef', async () => {
    const ref = await provider.upload({
      filename  : 'test.txt',
      mimeType  : 'text/plain',
      content   : Buffer.from('hello SAP'),
      tenantId  : 'tenant-001',
      projectId : 'proj-001',
    });

    expect(ref.id).toBeDefined();
    expect(ref.filename).toBe('test.txt');
    expect(ref.tenantId).toBe('tenant-001');
    expect(ref.sizeBytes).toBeGreaterThan(0);
    expect(ref.storageUri).toBeDefined();
    expect(fs.existsSync(ref.storageUri)).toBe(true);
  });

  it('downloads the uploaded file and returns correct content', async () => {
    const content = Buffer.from('SAP best practice content');
    const ref = await provider.upload({
      filename: 'bp.txt', mimeType: 'text/plain',
      content, tenantId: 'tenant-001',
    });

    const downloaded = await provider.download(ref.storageUri);
    expect(downloaded.toString('utf-8')).toBe('SAP best practice content');
  });

  it('deletes a file', async () => {
    const ref = await provider.upload({
      filename: 'del.txt', mimeType: 'text/plain',
      content: Buffer.from('to delete'), tenantId: 'tenant-001',
    });
    expect(fs.existsSync(ref.storageUri)).toBe(true);
    await provider.delete(ref.storageUri);
    expect(fs.existsSync(ref.storageUri)).toBe(false);
  });

  it('lists uploaded files for a tenant', async () => {
    await provider.upload({ filename: 'a.txt', mimeType: 'text/plain', content: Buffer.from('a'), tenantId: 't1' });
    await provider.upload({ filename: 'b.txt', mimeType: 'text/plain', content: Buffer.from('b'), tenantId: 't1' });
    const files = await provider.list('t1');
    expect(files.length).toBe(2);
  });

  it('returns empty list for unknown tenant', async () => {
    const files = await provider.list('unknown-tenant');
    expect(files).toHaveLength(0);
  });

  it('scopes files by project', async () => {
    await provider.upload({ filename: 'p1.txt', mimeType: 'text/plain', content: Buffer.from('p1'), tenantId: 't1', projectId: 'proj-A' });
    await provider.upload({ filename: 'p2.txt', mimeType: 'text/plain', content: Buffer.from('p2'), tenantId: 't1', projectId: 'proj-B' });
    const projA = await provider.list('t1', 'proj-A');
    const projB = await provider.list('t1', 'proj-B');
    expect(projA).toHaveLength(1);
    expect(projB).toHaveLength(1);
    expect(projA[0].filename).toBe('p1.txt');
  });

  it('download throws for missing file', async () => {
    await expect(provider.download('/nonexistent/path/file.txt')).rejects.toThrow();
  });
});
