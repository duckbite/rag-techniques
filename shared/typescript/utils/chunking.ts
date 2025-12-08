import { Chunk, Document, RagConfig, RetrievedChunk } from "./types";

/**
 * Configuration for document chunking.
 *
 * Contains the two essential parameters for fixed-size chunking:
 * - `chunkSize`: Number of characters per chunk
 * - `chunkOverlap`: Number of characters of overlap between adjacent chunks
 */
export type ChunkingConfig = Pick<RagConfig, "chunkSize" | "chunkOverlap">;

/**
 * Splits a document into overlapping fixed-size chunks.
 *
 * This is the standard chunking strategy used across all RAG projects in this
 * monorepo. It divides text into fixed-size segments with configurable overlap
 * to ensure important information spanning chunk boundaries is preserved.
 *
 * **How it works**:
 * 1. Starts at the beginning of the document
 * 2. Creates a chunk of `chunkSize` characters
 * 3. Moves forward by `chunkSize - chunkOverlap` characters (creating overlap)
 * 4. Repeats until the entire document is processed
 *
 * **Why overlap?** Without overlap, information that spans chunk boundaries
 * (like a sentence split between chunks) can be lost. Overlap ensures that
 * important context appears in multiple chunks, improving retrieval reliability.
 *
 * **Chunk metadata**: Each chunk preserves the document's metadata and includes
 * a unique ID and index for traceability.
 *
 * @param doc - The document to chunk (must have `id` and `content` fields)
 * @param cfg - Chunking configuration with `chunkSize` and `chunkOverlap`
 * @returns Array of Chunk objects, each containing a portion of the document
 * @throws Error if `chunkSize` <= 0 or `chunkOverlap` >= `chunkSize`
 *
 * @example
 * ```typescript
 * const doc = { id: "doc-0", content: "This is a long document...", title: "test.txt" };
 * const chunks = simpleChunkDocument(doc, { chunkSize: 100, chunkOverlap: 20 });
 * // Returns chunks of ~100 characters with 20-character overlaps
 * ```
 */
export function simpleChunkDocument(doc: Document, cfg: ChunkingConfig): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, chunkOverlap } = cfg;
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than zero");
  }
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be smaller than chunkSize");
  }

  let index = 0;
  let chunkIndex = 0;
  while (index < doc.content.length) {
    const end = Math.min(index + chunkSize, doc.content.length);
    chunks.push({
      id: `${doc.id}-chunk-${chunkIndex}`,
      documentId: doc.id,
      content: doc.content.slice(index, end),
      index: chunkIndex,
      metadata: doc.metadata
    });

    if (end === doc.content.length) break;
    index += chunkSize - chunkOverlap;
    chunkIndex += 1;
  }

  return chunks;
}

/**
 * Builds a simple contextual header string for a document.
 *
 * The header is meant to be prepended to every chunk created from the
 * document so that retrieval has access to high-level metadata such as
 * title and section/category labels.
 *
 * Format:
 * - Always includes a `Title: ...` line
 * - Optionally includes a `Section: ...` line when `metadata.section`
 *   or `metadata.category` are present
 *
 * @param doc - Source document
 * @returns Multi-line header string
 */
export function createDocumentHeader(doc: Document): string {
  const title = doc.title ?? "Untitled document";
  const meta = doc.metadata ?? {};
  const sections: string[] = [];

  const sectionMeta = meta.section ?? meta.sectionTitle ?? meta.heading;
  if (typeof sectionMeta === "string" && sectionMeta.trim().length > 0) {
    sections.push(sectionMeta.trim());
  }
  const categoryMeta = meta.category ?? meta.topic;
  if (typeof categoryMeta === "string" && categoryMeta.trim().length > 0) {
    sections.push(categoryMeta.trim());
  }

  const lines = [`Title: ${title}`];
  if (sections.length > 0) {
    lines.push(`Section: ${sections.join(" / ")}`);
  }
  return lines.join("\n");
}

/**
 * Prepends a contextual header string to each chunk's content.
 *
 * This is used by projects like `chunk-headers` to enrich chunk text
 * with document-level metadata before embedding. The original chunk
 * structure (id, documentId, index, metadata) is preserved.
 *
 * @param chunks - Base chunks created from a document
 * @param header - Header string produced by {@link createDocumentHeader}
 * @returns New chunks with header + two newlines + original content
 */
export function prependHeaderToChunks(chunks: Chunk[], header: string): Chunk[] {
  if (!header.trim() || chunks.length === 0) {
    return chunks;
  }
  const prefix = `${header}\n\n`;
  return chunks.map((chunk) => ({
    ...chunk,
    content: `${prefix}${chunk.content}`
  }));
}

/**
 * Splits a document into semantically-coherent chunks based on paragraph
 * boundaries instead of fixed-size windows.
 *
 * This implementation uses a simple heuristic:
 * - Split on blank lines (two or more consecutive newlines)
 * - Trim whitespace
 * - Discard empty paragraphs
 *
 * The resulting chunks are typically longer than fixed-size windows but
 * preserve sentence and paragraph structure, which often aligns better
 * with how humans write and read.
 *
 * @param doc - Document to split into semantic paragraphs
 * @param _cfg - Chunking configuration (currently unused but kept for parity)
 * @returns Array of semantically-oriented chunks
 */
export function semanticChunkDocument(doc: Document, cfg: ChunkingConfig): Chunk[] {
  const paragraphs = doc.content
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Chunk[] = [];
  const maxLen = cfg.chunkSize;
  const overlap = Math.max(0, Math.min(cfg.chunkOverlap, Math.max(0, maxLen - 1)));

  let idx = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLen) {
      chunks.push({
        id: `${doc.id}-para-${idx}`,
        documentId: doc.id,
        content: paragraph,
        index: idx,
        metadata: doc.metadata
      });
      idx += 1;
      continue;
    }

    // For very long paragraphs, fall back to windowed splitting to stay within model limits.
    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + maxLen, paragraph.length);
      const content = paragraph.slice(start, end);
      chunks.push({
        id: `${doc.id}-para-${idx}`,
        documentId: doc.id,
        content,
        index: idx,
        metadata: doc.metadata
      });
      idx += 1;
      if (end === paragraph.length) break;
      start += maxLen - overlap;
    }
  }

  return chunks;
}

