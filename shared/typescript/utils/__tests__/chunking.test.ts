import { describe, expect, it } from "vitest";
import {
  createDocumentHeader,
  prependHeaderToChunks,
  semanticChunkDocument,
  simpleChunkDocument
} from "../chunking";
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

    expect(() => simpleChunkDocument(doc, cfg)).toThrow(
      "chunkOverlap must be smaller than chunkSize"
    );
  });
});

describe("createDocumentHeader", () => {
  it("creates header with title only when no metadata", () => {
    const doc: Document = {
      id: "doc-0",
      content: "content",
      title: "My Doc"
    };
    const header = createDocumentHeader(doc);
    expect(header).toBe("Title: My Doc");
  });

  it("includes section and category when present", () => {
    const doc: Document = {
      id: "doc-0",
      content: "content",
      title: "My Doc",
      metadata: {
        section: "Chapter 1",
        category: "Finance"
      }
    };
    const header = createDocumentHeader(doc);
    expect(header).toContain("Title: My Doc");
    expect(header).toContain("Section: Chapter 1 / Finance");
  });
});

describe("prependHeaderToChunks", () => {
  it("prepends header to each chunk content", () => {
    const chunks = [
      { id: "c1", documentId: "doc-0", content: "A", index: 0 },
      { id: "c2", documentId: "doc-0", content: "B", index: 1 }
    ];
    const result = prependHeaderToChunks(chunks, "Title: Test");
    expect(result[0].content.startsWith("Title: Test\n\nA")).toBe(true);
    expect(result[1].content.startsWith("Title: Test\n\nB")).toBe(true);
  });

  it("returns original chunks when header is empty", () => {
    const chunks = [
      { id: "c1", documentId: "doc-0", content: "A", index: 0 }
    ];
    const result = prependHeaderToChunks(chunks, "   ");
    expect(result).toEqual(chunks);
  });
});

describe("semanticChunkDocument", () => {
  it("splits document on blank lines", () => {
    const doc: Document = {
      id: "doc-0",
      title: "test",
      content: "Para 1 line\nstill para 1\n\nPara 2\n\n\nPara 3"
    };
    const cfg: ChunkingConfig = { chunkSize: 100, chunkOverlap: 0 };
    const chunks = semanticChunkDocument(doc, cfg);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toContain("Para 1 line");
    expect(chunks[1].content).toBe("Para 2");
  });
});

