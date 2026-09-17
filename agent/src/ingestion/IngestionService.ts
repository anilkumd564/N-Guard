/**
 * N-Guard — Ingestion Service (Phase 4)
 *
 * Orchestrates the document ingestion pipeline:
 *  1. Receive file content (bytes) + metadata
 *  2. Store the raw file via FileStorageProvider (dev: local filesystem)
 *  3. Extract text via DocumentExtractorRegistry
 *  4. Chunk the extracted text via TextChunker
 *  5. Return a structured IngestionResult — the CAP handler persists it
 *
 * Architecture rules:
 *  - Rule 6:  Entirely independent of CAP/Express.
 *  - Rule 7:  No LLM calls.  Embeddings are Phase 5.
 *  - Rule 8:  All file I/O via the injected FileStorageProvider.
 *  - Rule 9:  LocalFileStorageProvider is the dev adapter; production uses BTP.
 *  - Rule 10: Every result carries tenantId and projectId for scoping.
 *  - Rule 12: Structured typed result — no silent swallowing of errors.
 */

import type { FileStorageProvider } from '../providers/FileStorageProvider.js';
import { DocumentExtractorRegistry } from './DocumentTextExtractor.js';
import { chunkText } from './TextChunker.js';
import type { ChunkOptions, TextChunk } from './TextChunker.js';
import type { ExtractionStatus } from './DocumentTextExtractor.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
  /** Tenant that owns this document.  Required. */
  tenantId           : string;
  /** Project that owns this document.  Optional (null = tenant-wide). */
  projectId?         : string;
  /** ID of the KnowledgeSource this document belongs to.  Required. */
  knowledgeSourceId  : string;
  /** SAP S/4HANA edition applicability.  null = applies to all editions. */
  edition?           : string;
  /** Release applicability.  null = applies to all releases. */
  release?           : string;
  /** Earliest applicable release (range start). */
  releaseFrom?       : string;
  /** Latest applicable release (range end).  null = current. */
  releaseTo?         : string;
  /** ISO country code or 'GLOBAL'. */
  country?           : string;
  /** Industry vertical. */
  industry?          : string;
  /** SAP process area, e.g. 'Order-to-Cash'. */
  processArea?       : string;
  /** SAP Scope Item ID, e.g. 'BH1'. */
  scopeItem?         : string;
  /** Authority level of the content. */
  authorityLevel?    : string;
  /** Document type classification. */
  docType?           : string;
  /** Language code, e.g. 'EN'. */
  language?          : string;
  /** Original source URL or citation. */
  sourceUrl?         : string;
  /** Human-provided document title. */
  title              : string;
}

export interface IngestionInput {
  /** Raw file bytes. */
  content   : Buffer | Uint8Array;
  /** Original filename for hints. */
  fileName  : string;
  /** MIME type of the file. */
  mimeType  : string;
  /** Document metadata. */
  metadata  : DocumentMetadata;
  /** Optional chunking configuration overrides. */
  chunkOptions?: ChunkOptions;
}

export interface IngestionChunkResult {
  sequence   : number;
  text       : string;
  wordCount  : number;
  charStart  : number;
  charEnd    : number;
}

export type IngestionResultStatus = 'completed' | 'failed' | 'unsupported' | 'empty';

export interface IngestionResult {
  /** Overall status of the ingestion operation. */
  status           : IngestionResultStatus;
  /** Extracted full text (may be empty on failure). */
  extractedText    : string;
  /** Character count of extracted text. */
  extractedLength  : number;
  /** Extraction status from the extractor. */
  extractionStatus : ExtractionStatus;
  /** Human-readable note or error message. */
  note?            : string;
  /** Produced text chunks (empty on failure). */
  chunks           : IngestionChunkResult[];
  /** Storage URI of the raw file (for audit/retrieval). */
  storageUri?      : string;
  /** File size in bytes. */
  fileSizeBytes?   : number;
  /** Metadata echoed back for persistence. */
  metadata         : DocumentMetadata;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class IngestionService {
  private readonly storage   : FileStorageProvider;
  private readonly extractors: DocumentExtractorRegistry;

  constructor(deps: {
    storage    : FileStorageProvider;
    extractors?: DocumentExtractorRegistry;
  }) {
    this.storage    = deps.storage;
    this.extractors = deps.extractors ?? new DocumentExtractorRegistry();
  }

  /**
   * Ingest a document:
   *  1. Store the raw file.
   *  2. Extract text.
   *  3. Chunk.
   *  4. Return structured result for the CAP handler to persist.
   *
   * This method NEVER throws — all errors are captured in the result.
   */
  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const { content, fileName, mimeType, metadata, chunkOptions } = input;

    // Step 1: Store the raw file
    let storageUri: string | undefined;
    let fileSizeBytes: number | undefined;
    try {
      const ref = await this.storage.upload({
        filename  : fileName,
        mimeType,
        content   : Buffer.from(content),
        tenantId  : metadata.tenantId,
        projectId : metadata.projectId,
      });
      storageUri    = ref.storageUri;
      fileSizeBytes = ref.sizeBytes;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.failureResult(metadata, `File storage failed: ${msg}`);
    }

    // Step 2: Extract text
    let extractedText    = '';
    let extractedLength  = 0;
    let extractionStatus : ExtractionStatus = 'error';
    let extractionNote   : string | undefined;

    try {
      const result      = await this.extractors.extract(content, mimeType, fileName);
      extractedText     = result.text;
      extractedLength   = result.characterCount;
      extractionStatus  = result.status;
      extractionNote    = result.note;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: 'failed', extractedText: '', extractedLength: 0,
        extractionStatus: 'error', note: `Text extraction threw an error: ${msg}`,
        chunks: [], storageUri, fileSizeBytes, metadata,
      };
    }

    if (extractionStatus === 'unsupported') {
      return {
        status: 'unsupported', extractedText: '', extractedLength: 0,
        extractionStatus, note: extractionNote,
        chunks: [], storageUri, fileSizeBytes, metadata,
      };
    }

    if (extractionStatus === 'empty' || !extractedText.trim()) {
      return {
        status: 'empty', extractedText: '', extractedLength: 0,
        extractionStatus: 'empty', note: extractionNote ?? 'Document has no extractable text.',
        chunks: [], storageUri, fileSizeBytes, metadata,
      };
    }

    if (extractionStatus === 'error') {
      return this.failureResult(metadata, extractionNote ?? 'Extraction error', storageUri, fileSizeBytes);
    }

    // Step 3: Chunk
    const rawChunks = chunkText(extractedText, chunkOptions ?? {
      targetWords  : 400,
      overlapWords : 50,
      minChunkWords: 30,
    });

    const chunks: IngestionChunkResult[] = rawChunks.map((c: TextChunk) => ({
      sequence  : c.sequence,
      text      : c.text,
      wordCount : c.wordCount,
      charStart : c.charStart,
      charEnd   : c.charEnd,
    }));

    return {
      status           : 'completed',
      extractedText,
      extractedLength,
      extractionStatus : 'ok',
      note             : extractionNote,
      chunks,
      storageUri,
      fileSizeBytes,
      metadata,
    };
  }

  private failureResult(
    metadata       : DocumentMetadata,
    note           : string,
    storageUri?    : string,
    fileSizeBytes? : number,
  ): IngestionResult {
    return {
      status: 'failed', extractedText: '', extractedLength: 0,
      extractionStatus: 'error', note,
      chunks: [], storageUri, fileSizeBytes, metadata,
    };
  }
}
