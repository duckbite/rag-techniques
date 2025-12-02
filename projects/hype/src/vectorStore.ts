import fs from "node:fs";
import path from "node:path";
import { Chunk, RetrievedChunk } from "../../../shared/typescript/utils/types";
import { logger } from "../../../shared/typescript/utils/logging";

/**
 * Internal representation of a chunk with multiple question embeddings.
 *
 * In HyPE, each chunk is associated with multiple hypothetical questions.
 * Each question is embedded, creating multiple embeddings per chunk. This
 * allows retrieval to match user queries against question embeddings rather
 * than chunk embeddings.
 */
export interface HyPEStoreItem {
  id: string;
  chunk: Chunk;
  questionEmbeddings: number[][]; // Multiple embeddings, one per question
  questions: string[]; // The questions that were embedded
}

/**
 * Computes the cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score between -1 and 1
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const minLen = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < minLen; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * HyPE-specific vector store that supports multiple embeddings per chunk.
 *
 * Unlike standard vector stores that store one embedding per chunk, HyPE
 * stores multiple question embeddings per chunk. When searching, the store:
 * 1. Compares the query embedding against all question embeddings
 * 2. Finds chunks whose questions match the query
 * 3. Deduplicates chunks if multiple questions from the same chunk match
 * 4. Returns chunks sorted by their best matching question's score
 *
 * **Storage format**: Each chunk is stored with:
 * - The chunk content and metadata
 * - Multiple question embeddings (one per hypothetical question)
 * - The questions themselves (for debugging and transparency)
 */
export class HyPEVectorStore {
  private items: HyPEStoreItem[] = [];

  /**
   * Adds a chunk with multiple question embeddings to the store.
   *
   * @param chunk - The text chunk to store
   * @param questionEmbeddings - Array of embeddings, one per hypothetical question
   * @param questions - Array of questions that were embedded (for debugging)
   * @throws Error if questionEmbeddings and questions arrays have different lengths
   */
  addChunkWithQuestions(
    chunk: Chunk,
    questionEmbeddings: number[][],
    questions: string[]
  ): void {
    if (questionEmbeddings.length !== questions.length) {
      throw new Error("questionEmbeddings and questions length mismatch");
    }
    if (questionEmbeddings.length === 0) {
      throw new Error("At least one question embedding is required");
    }
    this.items.push({
      id: chunk.id,
      chunk,
      questionEmbeddings,
      questions
    });
  }

  /**
   * Searches for chunks by matching query embedding against question embeddings.
   *
   * This method:
   * 1. Compares the query embedding against all question embeddings for all chunks
   * 2. For each chunk, finds the best matching question (highest similarity)
   * 3. Deduplicates chunks (if multiple questions from the same chunk match)
   * 4. Sorts by best match score and returns top-K chunks
   *
   * **Deduplication**: If a chunk has multiple questions that match the query,
   * only the best match is kept. This ensures each chunk appears at most once
   * in the results.
   *
   * @param queryEmbedding - The embedding vector of the user's query
   * @param topK - Number of top results to return
   * @returns Array of RetrievedChunk objects, sorted by similarity (highest first)
   */
  search(queryEmbedding: number[], topK: number): RetrievedChunk[] {
    // For each chunk, find the best matching question
    const scored: Array<{ chunk: Chunk; score: number }> = [];

    for (const item of this.items) {
      let bestScore = -1;
      // Compare query against all question embeddings for this chunk
      for (const questionEmbedding of item.questionEmbeddings) {
        const score = cosineSimilarity(queryEmbedding, questionEmbedding);
        if (score > bestScore) {
          bestScore = score;
        }
      }
      // Only include chunks with positive similarity
      if (bestScore > -1) {
        scored.push({ chunk: item.chunk, score: bestScore });
      }
    }

    // Sort by score (descending) and return top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((item) => ({ ...item.chunk, score: item.score }));
  }

  /**
   * Persists the HyPE vector store to a JSON file on disk.
   *
   * The file format includes chunks with their multiple question embeddings
   * and the questions themselves for debugging and transparency.
   *
   * @param filePath - Path where the index should be saved
   * @throws Error if the directory cannot be created or the file cannot be written
   */
  persist(filePath: string): void {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      resolved,
      JSON.stringify(
        this.items.map((i) => ({
          chunk: i.chunk,
          questionEmbeddings: i.questionEmbeddings,
          questions: i.questions
        })),
        null,
        2
      ),
      "utf-8"
    );
    logger.info(`Persisted HyPE vector store to ${resolved}`);
  }

  /**
   * Gets the number of chunks stored in the store.
   *
   * @returns Total number of chunks
   */
  getChunkCount(): number {
    return this.items.length;
  }

  /**
   * Gets the total number of question embeddings stored.
   *
   * @returns Total number of question embeddings (sum across all chunks)
   */
  getQuestionEmbeddingCount(): number {
    return this.items.reduce((sum, item) => sum + item.questionEmbeddings.length, 0);
  }
}

/**
 * Loads a previously persisted HyPE vector store from disk.
 *
 * @param filePath - Path to the JSON index file
 * @returns A new HyPEVectorStore instance populated with the loaded data
 * @throws Error if the file doesn't exist or cannot be parsed
 */
export function loadHyPEVectorStore(filePath: string): HyPEVectorStore {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`HyPE vector index file not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  const data = JSON.parse(raw) as Array<{
    chunk: Chunk;
    questionEmbeddings: number[][];
    questions: string[];
  }>;
  const store = new HyPEVectorStore();
  for (const item of data) {
    store.addChunkWithQuestions(item.chunk, item.questionEmbeddings, item.questions);
  }
  return store;
}


