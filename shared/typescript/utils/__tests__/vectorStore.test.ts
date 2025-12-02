import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  InMemoryVectorStore,
  loadInMemoryVectorStore,
  embedChunks,
  VectorStore
} from "../vectorStore";
import { Chunk, RetrievedChunk } from "../types";
import { EmbeddingClient } from "../llm";

describe("InMemoryVectorStore", () => {
  describe("addMany", () => {
    it("should add chunks with embeddings", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Hello",
          index: 0
        },
        {
          id: "chunk-2",
          documentId: "doc-1",
          content: "World",
          index: 1
        }
      ];
      const embeddings = [[1, 2, 3], [4, 5, 6]];

      store.addMany(chunks, embeddings);

      const results = store.search([1, 2, 3], 2);
      expect(results).toHaveLength(2);
    });

    it("should throw error if chunks and embeddings length mismatch", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Hello",
          index: 0
        }
      ];
      const embeddings = [[1, 2, 3], [4, 5, 6]];

      expect(() => store.addMany(chunks, embeddings)).toThrow(
        "chunks and embeddings length mismatch"
      );
    });

    it("should handle empty arrays", () => {
      const store = new InMemoryVectorStore();
      store.addMany([], []);
      const results = store.search([1, 2, 3], 5);
      expect(results).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("should return top-K most similar chunks", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Similar content",
          index: 0
        },
        {
          id: "chunk-2",
          documentId: "doc-1",
          content: "Different content",
          index: 1
        }
      ];
      // Embeddings: first is [1,0,0], second is [0,1,0]
      // Query is [1,0,0] which should match first chunk best
      const embeddings = [[1, 0, 0], [0, 1, 0]];
      store.addMany(chunks, embeddings);

      const results = store.search([1, 0, 0], 1);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("chunk-1");
      expect(results[0].score).toBe(1.0); // Perfect match
    });

    it("should return results sorted by similarity (highest first)", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Content 1",
          index: 0
        },
        {
          id: "chunk-2",
          documentId: "doc-1",
          content: "Content 2",
          index: 1
        },
        {
          id: "chunk-3",
          documentId: "doc-1",
          content: "Content 3",
          index: 2
        }
      ];
      // Embeddings that will have different similarities to query [1,0,0]
      const embeddings = [[1, 0, 0], [0.5, 0.5, 0], [0, 1, 0]];
      store.addMany(chunks, embeddings);

      const results = store.search([1, 0, 0], 3);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it("should return fewer results if fewer chunks exist than topK", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Content",
          index: 0
        }
      ];
      store.addMany(chunks, [[1, 2, 3]]);

      const results = store.search([1, 2, 3], 10);

      expect(results).toHaveLength(1);
    });

    it("should return empty array if store is empty", () => {
      const store = new InMemoryVectorStore();
      const results = store.search([1, 2, 3], 5);
      expect(results).toEqual([]);
    });

    it("should include score in returned chunks", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Content",
          index: 0
        }
      ];
      store.addMany(chunks, [[1, 0, 0]]);

      const results = store.search([1, 0, 0], 1);

      expect(results[0].score).toBeDefined();
      expect(typeof results[0].score).toBe("number");
    });
  });

  describe("persist", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vectorstore-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should persist store to JSON file", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Hello",
          index: 0,
          metadata: { author: "test" }
        }
      ];
      store.addMany(chunks, [[1, 2, 3]]);

      const filePath = path.join(tmpDir, "index.json");
      store.persist(filePath);

      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].chunk).toEqual(chunks[0]);
      expect(data[0].embedding).toEqual([1, 2, 3]);
    });

    it("should create directory if it does not exist", () => {
      const store = new InMemoryVectorStore();
      const filePath = path.join(tmpDir, "nested", "deep", "index.json");

      store.persist(filePath);

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should persist multiple chunks", () => {
      const store = new InMemoryVectorStore();
      const chunks: Chunk[] = [
        {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Hello",
          index: 0
        },
        {
          id: "chunk-2",
          documentId: "doc-1",
          content: "World",
          index: 1
        }
      ];
      store.addMany(chunks, [[1, 2, 3], [4, 5, 6]]);

      const filePath = path.join(tmpDir, "index.json");
      store.persist(filePath);

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data).toHaveLength(2);
    });
  });
});

describe("loadInMemoryVectorStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "load-vectorstore-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load store from JSON file", () => {
    const chunks: Chunk[] = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "Hello",
        index: 0
      }
    ];
    const data = [{ chunk: chunks[0], embedding: [1, 2, 3] }];
    const filePath = path.join(tmpDir, "index.json");
    fs.writeFileSync(filePath, JSON.stringify(data));

    const store = loadInMemoryVectorStore(filePath);

    const results = store.search([1, 2, 3], 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("chunk-1");
  });

  it("should throw error if file does not exist", () => {
    const filePath = path.join(tmpDir, "nonexistent.json");
    expect(() => loadInMemoryVectorStore(filePath)).toThrow(
      "Vector index file not found"
    );
  });

  it("should load multiple chunks", () => {
    const data = [
      {
        chunk: {
          id: "chunk-1",
          documentId: "doc-1",
          content: "Hello",
          index: 0
        },
        embedding: [1, 2, 3]
      },
      {
        chunk: {
          id: "chunk-2",
          documentId: "doc-1",
          content: "World",
          index: 1
        },
        embedding: [4, 5, 6]
      }
    ];
    const filePath = path.join(tmpDir, "index.json");
    fs.writeFileSync(filePath, JSON.stringify(data));

    const store = loadInMemoryVectorStore(filePath);

    const results = store.search([1, 2, 3], 2);
    expect(results).toHaveLength(2);
  });
});

describe("embedChunks", () => {
  it("should extract content from chunks and call embed client", async () => {
    const chunks: Chunk[] = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "Hello",
        index: 0
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
        content: "World",
        index: 1
      }
    ];

    const mockClient: EmbeddingClient = {
      embed: async (texts: string[]) => {
        return texts.map((text) => [text.length]);
      }
    };

    const result = await embedChunks(chunks, mockClient);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([5]); // "Hello".length
    expect(result[1]).toEqual([5]); // "World".length
  });

  it("should handle empty chunks array", async () => {
    const mockClient: EmbeddingClient = {
      embed: async () => []
    };

    const result = await embedChunks([], mockClient);

    expect(result).toEqual([]);
  });
});
