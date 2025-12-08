import { describe, expect, it, vi } from "vitest";
import { runIngestion } from "../ingest";
import {
  Chunk,
  Document,
  RagConfig
} from "../../../../shared/typescript/utils/types";
import { EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((_, idx) => [idx]);
  }
}

class FakeVectorStore implements VectorStore {
  public addedBatches: { chunks: Chunk[]; embeddings: number[][] }[] = [];
  public persistedPath?: string;

  addMany(chunks: Chunk[], embeddings: number[][]): void {
    this.addedBatches.push({ chunks, embeddings });
  }

  search(): never {
    throw new Error("not used in ingest tests");
  }

  persist(filePath: string): void {
    this.persistedPath = filePath;
  }
}

describe("semantic-chunking ingestion", () => {
  it("uses semantic paragraph-based chunks when semanticChunking is true", async () => {
    const cfg: RagConfig = {
      chunkSize: 100,
      chunkOverlap: 0,
      topK: 3,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json",
      semanticChunking: true
    };

    const doc: Document = {
      id: "doc-0",
      title: "test",
      content: "Para 1\n\nPara 2\n\n\nPara 3"
    };

    const fakeReader = vi.fn(() => [doc]);
    const store = new FakeVectorStore();

    const result = await runIngestion(cfg, {
      readDocuments: fakeReader,
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].content).toContain("Para 1");
    expect(result.chunks[1].content).toBe("Para 2");
  });
});

