import { Chunk, Document, RagConfig } from "./types";

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

