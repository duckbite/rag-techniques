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
    return texts.map((_, idx) => [idx, idx + 0.5]);
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

describe("chunk-headers ingestion", () => {
  it("prepends document headers to chunks before embedding", async () => {
    const cfg: RagConfig = {
      chunkSize: 100,
      chunkOverlap: 0,
      topK: 3,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json"
    };

    const docs: Document[] = [
      {
        id: "doc-0",
        title: "My Doc",
        content: "Body content",
        metadata: { section: "Intro", category: "Test" }
      }
    ];

    const fakeReader = vi.fn(() => docs);
    const fakeChunker = vi.fn((doc: Document): Chunk[] => [
      {
        id: `${doc.id}-chunk-0`,
        documentId: doc.id,
        content: "Body content",
        index: 0
      }
    ]);
    const store = new FakeVectorStore();

    const result = await runIngestion(cfg, {
      readDocuments: fakeReader,
      chunkDocument: fakeChunker,
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });

    expect(result.chunks).toHaveLength(1);
    const enriched = result.chunks[0].content;
    expect(enriched).toContain("Title: My Doc");
    expect(enriched).toContain("Section: Intro / Test");
    expect(enriched.endsWith("Body content")).toBe(true);
  });
});

