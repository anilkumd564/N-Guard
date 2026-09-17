/**
 * N-Guard — Document Text Extractor
 *
 * Interface and implementations for extracting plain text from various
 * document formats.  Used by the ingestion pipeline (Phase 4).
 *
 * Architecture rules:
 *  - Rule 8 / Rule 9: No filesystem access outside the LocalFileStorage adapter.
 *                     Extractors receive content as a Buffer — no file path access.
 *  - Do NOT install or call OCR libraries.  If a format cannot be extracted
 *    without OCR the extractor must return an ExtractionUnsupported result.
 *  - Do NOT call LLMs here.  Phase 5 adds embeddings; Phase 4 is pure text.
 *
 * Supported formats (built-in, no extra npm packages required):
 *  - text/plain  (.txt)
 *  - text/markdown (.md)
 *  - text/csv (.csv)
 *  - application/json (.json)
 *
 * Documented stubs (require opt-in package installation):
 *  - application/pdf (.pdf)   → install pdf-parse; replace PdfExtractorStub
 *  - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *    (.docx)                  → install mammoth; replace DocxExtractorStub
 *
 * GAP: PDF and DOCX extraction stubs are documented adapter boundaries.
 *      They return an ExtractionUnsupported result until the appropriate
 *      library is installed and the stub is replaced.
 */

// ─── Result Types ─────────────────────────────────────────────────────────────

export type ExtractionStatus =
  | 'ok'           // Text extracted successfully
  | 'unsupported'  // Format not supported; text extraction not possible
  | 'empty'        // File had no extractable text content
  | 'error';       // Extraction attempted but failed with an error

export interface ExtractionResult {
  status       : ExtractionStatus;
  text         : string;        // Extracted plain text; empty string on failure
  characterCount : number;
  /** Human-readable note about what happened (especially for non-ok statuses) */
  note?        : string;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface DocumentTextExtractor {
  /** MIME types this extractor supports. */
  readonly supportedMimeTypes : readonly string[];

  /**
   * Extract plain text from the document content.
   * @param content  Raw file bytes (Buffer/Uint8Array).
   * @param mimeType The MIME type of the content.
   * @param filename Optional original filename (used for format hints).
   */
  extract(
    content  : Buffer | Uint8Array,
    mimeType : string,
    filename?: string,
  ): Promise<ExtractionResult>;
}

// ─── Plain Text / Markdown Extractor ─────────────────────────────────────────

/**
 * Handles: text/plain, text/markdown, text/x-markdown
 * No transformation needed — return UTF-8 decoded string.
 */
export class PlainTextExtractor implements DocumentTextExtractor {
  readonly supportedMimeTypes = [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/markdown',
  ] as const;

  async extract(content: Buffer | Uint8Array, _mt?: string, _fn?: string): Promise<ExtractionResult> {
    try {
      const text = Buffer.from(content).toString('utf-8');
      const trimmed = text.trim();
      if (!trimmed) {
        return { status: 'empty', text: '', characterCount: 0, note: 'File is empty.' };
      }
      return { status: 'ok', text: trimmed, characterCount: trimmed.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', text: '', characterCount: 0, note: `Text decode failed: ${msg}` };
    }
  }
}

// ─── CSV Extractor ────────────────────────────────────────────────────────────

/**
 * Handles: text/csv, application/csv, text/comma-separated-values
 *
 * Converts each CSV row into a plain-text line of the form:
 *   "Column1: value1 | Column2: value2 | ..."
 * This preserves column semantics for semantic search without requiring
 * a CSV parsing library.
 */
export class CsvTextExtractor implements DocumentTextExtractor {
  readonly supportedMimeTypes = [
    'text/csv',
    'application/csv',
    'text/comma-separated-values',
  ] as const;

  async extract(content: Buffer | Uint8Array, _mt?: string, _fn?: string): Promise<ExtractionResult> {
    try {
      const raw = Buffer.from(content).toString('utf-8');
      const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        .filter(l => l.trim().length > 0);

      if (lines.length === 0) {
        return { status: 'empty', text: '', characterCount: 0, note: 'CSV has no rows.' };
      }

      const headers = splitCsvLine(lines[0]).map(h => h.trim());
      const textLines: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        const parts = headers.map((h, idx) => {
          const val = (cells[idx] ?? '').trim();
          return val ? `${h}: ${val}` : null;
        }).filter(Boolean);
        if (parts.length > 0) {
          textLines.push(parts.join(' | '));
        }
      }

      const text = textLines.join('\n');
      if (!text.trim()) {
        return { status: 'empty', text: '', characterCount: 0, note: 'CSV has no data rows.' };
      }
      return { status: 'ok', text, characterCount: text.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', text: '', characterCount: 0, note: `CSV extraction failed: ${msg}` };
    }
  }
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────

/**
 * Handles: application/json
 * Converts JSON to a readable text representation suitable for chunking.
 */
export class JsonTextExtractor implements DocumentTextExtractor {
  readonly supportedMimeTypes = ['application/json', 'text/json'] as const;

  async extract(content: Buffer | Uint8Array, _mt?: string, _fn?: string): Promise<ExtractionResult> {
    try {
      const raw = Buffer.from(content).toString('utf-8').trim();
      if (!raw) {
        return { status: 'empty', text: '', characterCount: 0, note: 'JSON file is empty.' };
      }

      const parsed: unknown = JSON.parse(raw);
      const text = jsonToText(parsed, 0);
      if (!text.trim()) {
        return { status: 'empty', text: '', characterCount: 0, note: 'JSON has no textual content.' };
      }
      return { status: 'ok', text: text.trim(), characterCount: text.trim().length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', text: '', characterCount: 0, note: `JSON extraction failed: ${msg}` };
    }
  }
}

// ─── PDF Extractor Stub ───────────────────────────────────────────────────────

/**
 * GAP — PDF Extraction Stub
 *
 * Full PDF text extraction requires the `pdf-parse` npm package:
 *   npm install pdf-parse
 *   npm install --save-dev @types/pdf-parse
 *
 * To enable: replace this stub with a real implementation that calls:
 *   import pdfParse from 'pdf-parse';
 *   const data = await pdfParse(Buffer.from(content));
 *   return { status: 'ok', text: data.text, characterCount: data.text.length };
 *
 * This stub returns ExtractionUnsupported so ingestion completes without error
 * but records the gap in the IngestionJob.
 */
export class PdfExtractorStub implements DocumentTextExtractor {
  readonly supportedMimeTypes = ['application/pdf'] as const;

  async extract(_c?: Buffer | Uint8Array, _mt?: string, _fn?: string): Promise<ExtractionResult> {
    return {
      status       : 'unsupported',
      text         : '',
      characterCount: 0,
      note         : 'PDF extraction is not yet enabled. ' +
                     'Install pdf-parse and replace PdfExtractorStub to activate. ' +
                     'Do not use OCR without an explicit phase requirement.',
    };
  }
}

// ─── DOCX Extractor Stub ──────────────────────────────────────────────────────

/**
 * GAP — DOCX Extraction Stub
 *
 * Full DOCX extraction requires the `mammoth` npm package:
 *   npm install mammoth
 *
 * To enable: replace this stub with:
 *   import mammoth from 'mammoth';
 *   const result = await mammoth.extractRawText({ buffer: Buffer.from(content) });
 *   return { status: 'ok', text: result.value, characterCount: result.value.length };
 */
export class DocxExtractorStub implements DocumentTextExtractor {
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ] as const;

  async extract(_c?: Buffer | Uint8Array, _mt?: string, _fn?: string): Promise<ExtractionResult> {
    return {
      status         : 'unsupported',
      text           : '',
      characterCount : 0,
      note           : 'DOCX extraction is not yet enabled. Install mammoth and replace DocxExtractorStub.',
    };
  }
}

// ─── Extractor Registry ───────────────────────────────────────────────────────

/**
 * DocumentExtractorRegistry selects the appropriate extractor for a given
 * MIME type and delegates the extraction call.
 *
 * Architecture rule: all text extraction goes through this registry.
 * Add new extractors by registering them — do not call extractors directly.
 */
export class DocumentExtractorRegistry {
  private readonly extractors: DocumentTextExtractor[];

  constructor(extractors?: DocumentTextExtractor[]) {
    this.extractors = extractors ?? [
      new PlainTextExtractor(),
      new CsvTextExtractor(),
      new JsonTextExtractor(),
      new PdfExtractorStub(),
      new DocxExtractorStub(),
    ];
  }

  /**
   * Find the extractor for the given MIME type.
   * Falls back to PlainTextExtractor for unknown text/* types.
   * Returns null for completely unsupported binary formats.
   */
  findExtractor(mimeType: string): DocumentTextExtractor | null {
    const normalised = mimeType.toLowerCase().split(';')[0].trim();

    // Exact match
    for (const ext of this.extractors) {
      if ((ext.supportedMimeTypes as readonly string[]).includes(normalised)) {
        return ext;
      }
    }

    // Fallback: unknown text/* → try plain text
    if (normalised.startsWith('text/')) {
      return new PlainTextExtractor();
    }

    return null;
  }

  async extract(
    content  : Buffer | Uint8Array,
    mimeType : string,
    filename?: string,
  ): Promise<ExtractionResult> {
    const extractor = this.findExtractor(mimeType);
    if (!extractor) {
      return {
        status         : 'unsupported',
        text           : '',
        characterCount : 0,
        note           : `No extractor registered for MIME type "${mimeType}". ` +
                         `Implement a DocumentTextExtractor and register it in DocumentExtractorRegistry.`,
      };
    }
    return extractor.extract(content, mimeType, filename);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** RFC 4180 CSV line splitter (reused from domain.ts pattern). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }
    if (ch === ',' && !inQuotes) { fields.push(current); current = ''; i++; continue; }
    current += ch; i++;
  }
  fields.push(current);
  return fields;
}

/** Convert a parsed JSON value to human-readable text. */
function jsonToText(value: unknown, depth: number): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v, i) => `[${i + 1}] ${jsonToText(v, depth + 1)}`).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${jsonToText(v, depth + 1)}`)
      .join('\n');
  }
  return String(value);
}
