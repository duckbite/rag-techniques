import { describe, expect, it, vi } from "vitest";
import { runReliableIngestion } from "../ingest";
import { RagConfig, Document, Chunk, RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  public calls: string[][] = [];
  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map((_, idx) => [idx, idx + 0.2]);
  }
}

class FakeVectorStore implements VectorStore {
  public addedBatches: { chunks: Chunk[]; embeddings: number[][] }[] = [];
  public persistedPath?: string;

  addMany(chunks: Chunk[], embeddings: number[][]): void {
    this.addedBatches.push({ chunks, embeddings });
  }

  search(): RetrievedChunk[] {
    return [];
  }

  persist(filePath: string): void {
    this.persistedPath = filePath;
  }
}

describe("runReliableIngestion", () => {
  const cfg: RagConfig = {
    chunkSize: 600,
    chunkOverlap: 150,
    topK: 4,
    embeddingModel: "embed",
    chatModel: "chat",
    dataPath: "data",
    indexPath: ".tmp/index.json"
  };

  it("reads, chunks, embeds, and stores documents", async () => {
    const docs: Document[] = [
      { id: "doc-0", title: "a.txt", content: "alpha" },
      { id: "doc-1", title: "b.txt", content: "beta" }
    ];
    const reader = vi.fn(() => docs);
    const chunker = vi.fn((doc: Document) => [
      { id: `${doc.id}-chunk-0`, documentId: doc.id, content: doc.content, index: 0 }
    ]);
    const embeddingClient = new FakeEmbeddingClient();
    const store = new FakeVectorStore();

    const result = await runReliableIngestion(cfg, {
      readDocuments: reader,
      chunkDocument: chunker,
      embeddingClient,
      vectorStore: store
    });

    expect(reader).toHaveBeenCalledWith(cfg.dataPath);
    expect(chunker).toHaveBeenCalledTimes(docs.length);
    expect(embeddingClient.calls).toHaveLength(1);
    expect(store.addedBatches[0].chunks).toHaveLength(docs.length);
    expect(store.persistedPath).toBe(cfg.indexPath);
    expect(result.chunks).toHaveLength(docs.length);
  });

  it("persists empty store when no chunks exist", async () => {
    const store = new FakeVectorStore();
    const result = await runReliableIngestion(cfg, {
      readDocuments: () => [],
      chunkDocument: () => [],
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });
    expect(result.chunks).toHaveLength(0);
    expect(store.addedBatches).toHaveLength(0);
    expect(store.persistedPath).toBe(cfg.indexPath);
  });
});

