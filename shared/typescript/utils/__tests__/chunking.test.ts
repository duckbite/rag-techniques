import { describe, expect, it } from "vitest";
import { simpleChunkDocument } from "../chunking";
import { Document, ChunkingConfig } from "../types";

describe("simpleChunkDocument", () => {
  it("should split document into chunks of specified size", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abcdefghijklmnopqrstuvwxyz",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 5,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(6);
    expect(chunks[0].content).toBe("abcde");
    expect(chunks[1].content).toBe("fghij");
    expect(chunks[5].content).toBe("z");
  });

  it("should create overlapping chunks", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abcdefghijklmnop",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 5,
      chunkOverlap: 2
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(5);
    expect(chunks[0].content).toBe("abcde");
    expect(chunks[1].content).toBe("defgh"); // starts at index 3 (5-2)
    expect(chunks[1].content.startsWith("d")).toBe(true);
  });

  it("should preserve document metadata in chunks", () => {
    const doc: Document = {
      id: "doc-0",
      content: "test content",
      title: "test.txt",
      metadata: { author: "test-author", year: 2024 }
    };
    const cfg: ChunkingConfig = {
      chunkSize: 10,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata).toEqual(doc.metadata);
    expect(chunks[1].metadata).toEqual(doc.metadata);
  });

  it("should generate unique chunk IDs", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abcdefghijklmnop",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 5,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks[0].id).toBe("doc-0-chunk-0");
    expect(chunks[1].id).toBe("doc-0-chunk-1");
    expect(chunks[0].documentId).toBe("doc-0");
  });

  it("should assign correct chunk indices", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abcdefghij",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 3,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
    expect(chunks[2].index).toBe(2);
  });

  it("should handle empty document", () => {
    const doc: Document = {
      id: "doc-0",
      content: "",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 10,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(0);
  });

  it("should handle document smaller than chunk size", () => {
    const doc: Document = {
      id: "doc-0",
      content: "abc",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 10,
      chunkOverlap: 0
    };

    const chunks = simpleChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("abc");
  });

  it("should throw error if chunkSize <= 0", () => {
    const doc: Document = {
      id: "doc-0",
      content: "test",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 0,
      chunkOverlap: 0
    };

    expect(() => simpleChunkDocument(doc, cfg)).toThrow("chunkSize must be greater than zero");
  });

  it("should throw error if chunkOverlap >= chunkSize", () => {
    const doc: Document = {
      id: "doc-0",
      content: "test",
      title: "test"
    };
    const cfg: ChunkingConfig = {
      chunkSize: 5,
      chunkOverlap: 5
    };

    expect(() => simpleChunkDocument(doc, cfg)).toThrow("chunkOverlap must be smaller than chunkSize");
  });
});
