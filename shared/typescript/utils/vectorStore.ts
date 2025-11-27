import fs from "node:fs";
import path from "node:path";
import { EmbeddingClient } from "./llm";
import { Chunk, RetrievedChunk } from "./types";
import { logger } from "./logging";

/**
 * Internal representation of a stored item in the vector store.
 * Combines a text chunk with its embedding vector for efficient storage and retrieval.
 */
export interface VectorStoreItem {
  id: string;
  chunk: Chunk;
  embedding: number[];
}

/**
 * Interface for vector storage and retrieval operations.
 * Implementations should support adding chunks with embeddings,
 * searching by similarity, and persisting to disk.
 */
export interface VectorStore {
  /**
   * Add multiple chunks with their corresponding embeddings to the store.
   * @param chunks - Array of text chunks to store
   * @param embeddings - Array of embedding vectors, one per chunk
   */
  addMany(chunks: Chunk[], embeddings: number[][]): void;
  
  /**
   * Search for the most similar chunks to a query embedding.
   * @param queryEmbedding - The embedding vector of the search query
   * @param topK - Number of top results to return
   * @returns Array of retrieved chunks sorted by similarity (highest first)
   */
  search(queryEmbedding: number[], topK: number): RetrievedChunk[];
  
  /**
   * Persist the vector store to disk for later loading.
   * @param filePath - Path where the index should be saved
   */
  persist(filePath: string): void;
}

/**
 * In-memory implementation of a vector store using cosine similarity for search.
 *
 * This is a simple, educational implementation that stores all vectors in memory
 * and performs linear search. For production use with large datasets, consider
 * using specialized vector databases (e.g., Pinecone, Weaviate, Qdrant).
 *
 * The store maintains an array of items, each containing a chunk and its embedding.
 * Search is performed by computing cosine similarity between the query embedding
 * and all stored embeddings, then returning the top-K most similar chunks.
 */
export class InMemoryVectorStore implements VectorStore {
  private items: VectorStoreItem[] = [];

  /**
   * Adds multiple chunks and their embeddings to the store.
   *
   * This method validates that the number of chunks matches the number of
   * embeddings, then stores them together as VectorStoreItem objects.
   *
   * @param chunks - Array of text chunks to store
   * @param embeddings - Array of embedding vectors (must match chunks length)
   * @throws Error if chunks and embeddings arrays have different lengths
   */
  addMany(chunks: Chunk[], embeddings: number[][]): void {
    if (chunks.length !== embeddings.length) {
      throw new Error("chunks and embeddings length mismatch");
    }
    for (let i = 0; i < chunks.length; i += 1) {
      this.items.push({
        id: chunks[i].id,
        chunk: chunks[i],
        embedding: embeddings[i]
      });
    }
  }

  /**
   * Searches for the top-K most similar chunks to a query embedding.
   *
   * This method:
   * 1. Computes cosine similarity between the query and each stored embedding
   * 2. Sorts results by similarity score (descending)
   * 3. Returns the top-K chunks with their similarity scores
   *
   * Cosine similarity ranges from -1 (opposite) to 1 (identical), with 0
   * indicating orthogonality. Higher scores indicate more semantically
   * similar content.
   *
   * @param queryEmbedding - The embedding vector of the search query
   * @param topK - Number of top results to return
   * @returns Array of RetrievedChunk objects, sorted by similarity (highest first)
   */
  search(queryEmbedding: number[], topK: number): RetrievedChunk[] {
    // Compute similarity score for each stored item
    const scored = this.items.map((item) => {
      const score = cosineSimilarity(queryEmbedding, item.embedding);
      return { ...item.chunk, score };
    });
    // Sort by score (descending) and return top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Persists the vector store to a JSON file on disk.
   *
   * The file format is a JSON array containing objects with `chunk` and
   * `embedding` properties. This allows the index to be saved and loaded
   * later without regenerating embeddings.
   *
   * @param filePath - Path where the index should be saved (relative or absolute)
   * @throws Error if the directory cannot be created or the file cannot be written
   */
  persist(filePath: string): void {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    // Create directory if it doesn't exist
    fs.mkdirSync(dir, { recursive: true });
    // Write JSON file with pretty formatting
    fs.writeFileSync(
      resolved,
      JSON.stringify(
        this.items.map((i) => ({
          chunk: i.chunk,
          embedding: i.embedding
        })),
        null,
        2
      ),
      "utf-8"
    );
    logger.info(`Persisted vector store to ${resolved}`);
  }
}

/**
 * Loads a previously persisted vector store from disk.
 *
 * This function reads a JSON file created by `persist()` and reconstructs
 * an InMemoryVectorStore with all the stored chunks and embeddings.
 *
 * @param filePath - Path to the JSON index file (relative or absolute)
 * @returns A new InMemoryVectorStore instance populated with the loaded data
 * @throws Error if the file doesn't exist or cannot be parsed
 *
 * @example
 * ```typescript
 * const store = loadInMemoryVectorStore("./index/basic-rag.index.json");
 * const results = store.search(queryEmbedding, 5);
 * ```
 */
export function loadInMemoryVectorStore(filePath: string): InMemoryVectorStore {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Vector index file not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  const data = JSON.parse(raw) as { chunk: Chunk; embedding: number[] }[];
  const store = new InMemoryVectorStore();
  // Reconstruct the store by adding each item
  for (const item of data) {
    store.addMany([item.chunk], [item.embedding]);
  }
  return store;
}

/**
 * Generates embeddings for an array of text chunks using an embedding client.
 *
 * This is a convenience function that extracts the text content from chunks
 * and passes them to the embedding client. It's used during ingestion to
 * convert all document chunks into vector representations.
 *
 * @param chunks - Array of text chunks to embed
 * @param client - Embedding client that implements the EmbeddingClient interface
 * @returns Promise resolving to an array of embedding vectors (one per chunk)
 *
 * @example
 * ```typescript
 * const embeddings = await embedChunks(chunks, new OpenAIEmbeddingClient("text-embedding-3-small"));
 * ```
 */
export async function embedChunks(
  chunks: Chunk[],
  client: EmbeddingClient
): Promise<number[][]> {
  const inputs = chunks.map((c) => c.content);
  return client.embed(inputs);
}

/**
 * Computes the cosine similarity between two vectors.
 *
 * Cosine similarity measures the cosine of the angle between two vectors,
 * providing a measure of their directional similarity regardless of magnitude.
 * It's commonly used in information retrieval and NLP because it captures
 * semantic similarity well for normalized embeddings.
 *
 * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * Where:
 * - A · B is the dot product
 * - ||A|| and ||B|| are the L2 norms (magnitudes)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score between -1 and 1 (higher = more similar)
 *          Returns 0 if either vector has zero magnitude
 *
 * @example
 * ```typescript
 * const similarity = cosineSimilarity([1, 2, 3], [1, 2, 3]); // Returns 1.0 (identical)
 * const similarity = cosineSimilarity([1, 0], [0, 1]); // Returns 0.0 (orthogonal)
 * ```
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const minLen = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  // Compute dot product and L2 norms simultaneously
  for (let i = 0; i < minLen; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  // Handle edge case: zero vectors
  if (normA === 0 || normB === 0) return 0;
  // Return cosine similarity
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}


