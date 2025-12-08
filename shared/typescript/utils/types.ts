export interface Document {
  id: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  metadata?: Record<string, unknown>;
}

export interface Embedding {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  embeddingModel: string;
  chatModel: string;
  dataPath: string;
  indexPath: string;
  /**
   * Optional whitelist of document titles to ingest from dataPath.
   * If provided, ingestion pipelines will filter loaded documents
   * to only those whose `title` matches one of these strings.
   */
  documentTitles?: string[];
  /**
   * Optional context window size (in characters) used by projects that
   * expand retrieved chunks into larger windows around relevant content.
   */
  contextWindowSize?: number;
  /**
   * Optional maximum size (in characters) for stitched segments used by
   * relevant segment extraction logic.
   */
  segmentMaxChars?: number;
  /**
   * When true, indicates that ingestion should prefer semantic chunking
   * (paragraph/sentence based) instead of fixed-size windows.
   */
  semanticChunking?: boolean;
  /**
   * Optional maximum size (in characters) for compressed context used by
   * contextual compression techniques.
   */
  compressionMaxChars?: number;
  /**
   * Optional number of synthetic questions to generate per chunk for
   * document-augmentation techniques.
   */
  questionsPerChunk?: number;
}

export type ChunkingConfig = Pick<RagConfig, "chunkSize" | "chunkOverlap">;


