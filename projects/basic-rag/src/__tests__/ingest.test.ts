import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  readDocumentsFromDir,
  runIngestion,
  simpleChunkDocument
} from "../ingest";
import { RagConfig, Document, Chunk, RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  public calls: string[][] = [];

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map((_, idx) => [idx, idx + 0.5]);
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

describe("ingest utilities", () => {
  it("readDocumentsFromDir loads .txt and .md documents", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-read-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "a.txt"), "alpha");
      fs.writeFileSync(path.join(tmpDir, "b.md"), "beta");
      fs.writeFileSync(path.join(tmpDir, "ignore.pdf"), "noop");

      const docs = readDocumentsFromDir(tmpDir);
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.title).sort()).toEqual(["a.txt", "b.md"]);
      expect(docs[0].content.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("simpleChunkDocument respects chunk size and overlap", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abcdefghijabcdefghij",
      title: "sample"
    };
    const cfg: RagConfig = {
      chunkSize: 6,
      chunkOverlap: 2,
      topK: 2,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "",
      indexPath: ""
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(5);
    expect(chunks[0].content).toBe("abcdef");
    expect(chunks[1].content.startsWith("efgh")).toBe(true);
    expect(chunks.at(-1)?.id).toContain("chunk-4");
  });
});

describe("runIngestion", () => {
  it("reads, chunks, embeds, and persists via injected dependencies", async () => {
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
      { id: "doc-0", content: "alpha", title: "a" },
      { id: "doc-1", content: "beta", title: "b" }
    ];

    const fakeReader = vi.fn(() => docs);
    const chunker = vi.fn((doc: Document): Chunk[] => [
      {
        id: `${doc.id}-chunk-0`,
        documentId: doc.id,
        content: doc.content,
        index: 0
      }
    ]);
    const embeddingClient = new FakeEmbeddingClient();
    const store = new FakeVectorStore();

    const result = await runIngestion(cfg, {
      readDocuments: fakeReader,
      chunkDocument: chunker,
      embeddingClient,
      vectorStore: store
    });

    expect(fakeReader).toHaveBeenCalledWith(cfg.dataPath);
    expect(chunker).toHaveBeenCalledTimes(docs.length);
    expect(embeddingClient.calls).toHaveLength(1);
    expect(embeddingClient.calls[0]).toEqual(docs.map((d) => d.content));
    expect(store.addedBatches).toHaveLength(1);
    expect(store.addedBatches[0].chunks).toHaveLength(docs.length);
    expect(store.persistedPath).toBe(cfg.indexPath);
    expect(result.documents).toEqual(docs);
    expect(result.chunks).toHaveLength(docs.length);
  });

  it("persists empty store when no chunks are produced", async () => {
    const cfg: RagConfig = {
      chunkSize: 5,
      chunkOverlap: 1,
      topK: 1,
      embeddingModel: "ignored",
      chatModel: "ignored",
      dataPath: "./data",
      indexPath: ".tmp/index.json"
    };
    const store = new FakeVectorStore();
    const result = await runIngestion(cfg, {
      readDocuments: () => [],
      chunkDocument: () => [],
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });

    expect(store.addedBatches).toHaveLength(0);
    expect(store.persistedPath).toBe(cfg.indexPath);
    expect(result.chunks).toHaveLength(0);
  });
});

