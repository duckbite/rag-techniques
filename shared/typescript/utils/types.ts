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
}


