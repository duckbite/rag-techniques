import fs from "node:fs";
import path from "node:path";
import { EmbeddingClient } from "./llm";
import { Chunk, RetrievedChunk } from "./types";
import { logger } from "./logging";

export interface VectorStoreItem {
  id: string;
  chunk: Chunk;
  embedding: number[];
}

export interface VectorStore {
  addMany(chunks: Chunk[], embeddings: number[][]): void;
  search(queryEmbedding: number[], topK: number): RetrievedChunk[];
  persist(filePath: string): void;
}

export class InMemoryVectorStore implements VectorStore {
  private items: VectorStoreItem[] = [];

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

  search(queryEmbedding: number[], topK: number): RetrievedChunk[] {
    const scored = this.items.map((item) => {
      const score = cosineSimilarity(queryEmbedding, item.embedding);
      return { ...item.chunk, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  persist(filePath: string): void {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
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

export function loadInMemoryVectorStore(filePath: string): InMemoryVectorStore {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Vector index file not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  const data = JSON.parse(raw) as { chunk: Chunk; embedding: number[] }[];
  const store = new InMemoryVectorStore();
  for (const item of data) {
    store.addMany([item.chunk], [item.embedding]);
  }
  return store;
}

export async function embedChunks(
  chunks: Chunk[],
  client: EmbeddingClient
): Promise<number[][]> {
  const inputs = chunks.map((c) => c.content);
  return client.embed(inputs);
}

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


