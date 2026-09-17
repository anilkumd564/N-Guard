/**
 * N-Guard — Text Chunker (Phase 4)
 *
 * Splits extracted document text into overlapping chunks suitable for
 * storage in KnowledgeChunks and future vector indexing (Phase 5).
 *
 * Architecture rules:
 *  - No LLM calls here.  Chunking is pure string manipulation.
 *  - Chunk size is approximate (word-count based, not byte-count).
 *  - Overlap ensures adjacent chunks share context for retrieval coherence.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkOptions {
  /**
   * Target number of words per chunk.
   * Defaults to 400.
   */
  targetWords?: number;

  /**
   * Number of words to overlap between consecutive chunks.
   * Defaults to 50.  Must be less than targetWords.
   */
  overlapWords?: number;

  /**
   * Minimum number of words for a trailing chunk to be emitted.
   * Chunks shorter than this are merged into the previous chunk.
   * Defaults to 30.
   */
  minChunkWords?: number;
}

export interface TextChunk {
  /** 1-based sequence number. */
  sequence   : number;
  /** The chunk text. */
  text       : string;
  /** Approximate word count. */
  wordCount  : number;
  /** Character offset of the first character in the original text. */
  charStart  : number;
  /** Character offset past the last character in the original text. */
  charEnd    : number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Split text into overlapping word-count-bounded chunks.
 *
 * Algorithm:
 *  1. Tokenise into words (whitespace-split).
 *  2. Walk the word list using a sliding window of `targetWords` words.
 *  3. Each window advances by `targetWords - overlapWords` words.
 *  4. Trailing chunks shorter than `minChunkWords` are merged into the last chunk.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const targetWords  = Math.max(1,   options.targetWords  ?? 400);
  const overlapWords = Math.max(0,   options.overlapWords ?? 50);
  const minChunk     = Math.max(1,   options.minChunkWords ?? 30);
  const step         = Math.max(1,   targetWords - overlapWords);

  if (!text || text.trim().length === 0) return [];

  // Build word-with-offset list
  const wordTokens = tokeniseWithOffsets(text);
  if (wordTokens.length === 0) return [];

  const chunks: TextChunk[] = [];
  let windowStart = 0;
  let seq = 1;

  while (windowStart < wordTokens.length) {
    const windowEnd = Math.min(windowStart + targetWords, wordTokens.length);
    const slice     = wordTokens.slice(windowStart, windowEnd);

    const charStart = slice[0].start;
    const charEnd   = slice[slice.length - 1].end;
    const chunkText = text.slice(charStart, charEnd);
    const wordCount = slice.length;

    chunks.push({ sequence: seq++, text: chunkText.trim(), wordCount, charStart, charEnd });

    if (windowEnd >= wordTokens.length) break;
    windowStart += step;
  }

  // Merge trailing micro-chunk into the previous one
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (last.wordCount < minChunk) {
      const prev = chunks[chunks.length - 2];
      const merged: TextChunk = {
        sequence  : prev.sequence,
        text      : (prev.text + '\n' + last.text).trim(),
        wordCount : prev.wordCount + last.wordCount,
        charStart : prev.charStart,
        charEnd   : last.charEnd,
      };
      chunks.splice(chunks.length - 2, 2, merged);
    }
  }

  return chunks;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface WordToken {
  word  : string;
  start : number;
  end   : number;
}

/**
 * Tokenise a string into words with their character offsets.
 * Words are delimited by whitespace (including newlines and tabs).
 */
function tokeniseWithOffsets(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({
      word  : match[0],
      start : match.index,
      end   : match.index + match[0].length,
    });
  }
  return tokens;
}
