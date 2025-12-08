import { describe, expect, it, vi } from "vitest";
import { runIngestion } from "../ingest";
import { Document, Chunk, RagConfig } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  public calls: string[][] = [];
  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeVectorStore implements VectorStore {
  public addedBatches: { chunks: Chunk[]; embeddings: number[][] }[] = [];
  addMany(chunks: Chunk[], embeddings: number[][]): void {
    this.addedBatches.push({ chunks, embeddings });
  }
  search(): never[] {
    return [];
  }
  persist(): void {}
}

describe("context-window ingestion", () => {
  it("uses standard ingestion pipeline", async () => {
    const cfg: RagConfig = {
      chunkSize: 10,
      chunkOverlap: 2,
      topK: 3,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json"
    };

    const docs: Document[] = [
      {
        id: "doc-0",
        content: "This is test content.",
        title: "Test Doc"
      }
    ];

    const embeddingClient = new FakeEmbeddingClient();
    const store = new FakeVectorStore();

    const result = await runIngestion(cfg, {
      readDocuments: () => docs,
      embeddingClient,
      vectorStore: store
    });

    expect(store.addedBatches.length).toBe(1);
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

