import { describe, expect, it } from "vitest";
import { HyPEVectorStore, loadHyPEVectorStore } from "../vectorStore";
import { Chunk } from "../../../../shared/typescript/utils/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("HyPEVectorStore", () => {
  describe("addChunkWithQuestions", () => {
    it("stores chunk with multiple question embeddings", () => {
      const store = new HyPEVectorStore();
      const chunk: Chunk = {
        id: "chunk-0",
        documentId: "doc-0",
        content: "test content",
        index: 0
      };
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6]
      ];
      const questions = ["Question 1?", "Question 2?"];

      store.addChunkWithQuestions(chunk, embeddings, questions);

      expect(store.getChunkCount()).toBe(1);
      expect(store.getQuestionEmbeddingCount()).toBe(2);
    });

    it("throws if embeddings and questions length mismatch", () => {
      const store = new HyPEVectorStore();
      const chunk: Chunk = {
        id: "chunk-0",
        documentId: "doc-0",
        content: "test",
        index: 0
      };
      expect(() => {
        store.addChunkWithQuestions(chunk, [[0.1]], ["q1", "q2"]);
      }).toThrow("length mismatch");
    });

    it("throws if no embeddings provided", () => {
      const store = new HyPEVectorStore();
      const chunk: Chunk = {
        id: "chunk-0",
        documentId: "doc-0",
        content: "test",
        index: 0
      };
      expect(() => {
        store.addChunkWithQuestions(chunk, [], []);
      }).toThrow("At least one question embedding is required");
    });
  });

  describe("search", () => {
    it("finds chunks by matching query against question embeddings", () => {
      const store = new HyPEVectorStore();
      const chunk1: Chunk = {
        id: "chunk-1",
        documentId: "doc-1",
        content: "content one",
        index: 0
      };
      const chunk2: Chunk = {
        id: "chunk-2",
        documentId: "doc-2",
        content: "content two",
        index: 1
      };

      // Add chunks with question embeddings
      // chunk1: question embedding similar to query
      store.addChunkWithQuestions(
        chunk1,
        [[1.0, 0.0, 0.0]], // Similar to query [1.0, 0.0, 0.0]
        ["Question 1?"]
      );
      // chunk2: question embedding different from query
      store.addChunkWithQuestions(
        chunk2,
        [[0.0, 1.0, 0.0]], // Different from query
        ["Question 2?"]
      );

      const queryEmbedding = [1.0, 0.0, 0.0];
      const results = store.search(queryEmbedding, 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("chunk-1"); // Should match chunk1 better
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("deduplicates chunks when multiple questions match", () => {
      const store = new HyPEVectorStore();
      const chunk: Chunk = {
        id: "chunk-0",
        documentId: "doc-0",
        content: "content",
        index: 0
      };

      // Same chunk with multiple question embeddings
      store.addChunkWithQuestions(
        chunk,
        [
          [1.0, 0.0, 0.0], // First question
          [0.9, 0.1, 0.0] // Second question (also similar)
        ],
        ["Question 1?", "Question 2?"]
      );

      const queryEmbedding = [1.0, 0.0, 0.0];
      const results = store.search(queryEmbedding, 5);

      // Should only return chunk once (deduplicated)
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("chunk-0");
    });

    it("returns top-K results sorted by score", () => {
      const store = new HyPEVectorStore();
      for (let i = 0; i < 5; i += 1) {
        const chunk: Chunk = {
          id: `chunk-${i}`,
          documentId: "doc",
          content: `content ${i}`,
          index: i
        };
        // Embeddings with decreasing similarity
        const similarity = 1.0 - i * 0.1;
        store.addChunkWithQuestions(
          chunk,
          [[similarity, 0.0, 0.0]],
          [`Question ${i}?`]
        );
      }

      const queryEmbedding = [1.0, 0.0, 0.0];
      const results = store.search(queryEmbedding, 3);

      expect(results.length).toBe(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });
  });

  describe("persist and load", () => {
    it("persists and loads HyPE store correctly", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hype-test-"));
      const indexPath = path.join(tmpDir, "test.index.json");

      try {
        const store = new HyPEVectorStore();
        const chunk: Chunk = {
          id: "chunk-0",
          documentId: "doc-0",
          content: "test content",
          index: 0
        };
        store.addChunkWithQuestions(
          chunk,
          [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
          ["Question 1?", "Question 2?"]
        );

        store.persist(indexPath);
        expect(fs.existsSync(indexPath)).toBe(true);

        const loaded = loadHyPEVectorStore(indexPath);
        expect(loaded.getChunkCount()).toBe(1);
        expect(loaded.getQuestionEmbeddingCount()).toBe(2);

        // Test that loaded store can search
        const results = loaded.search([0.1, 0.2, 0.3], 1);
        expect(results.length).toBe(1);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});

