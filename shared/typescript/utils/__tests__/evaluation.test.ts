import { describe, expect, it } from "vitest";
import { compareAnswers, scoreRetrieval } from "../evaluation";
import { RetrievedChunk } from "../types";

describe("compareAnswers", () => {
  it("should return 1.0 for identical answers", () => {
    const score = compareAnswers("Hello world", "Hello world");
    expect(score).toBe(1.0);
  });

  it("should return high score for similar answers with different word order", () => {
    const score = compareAnswers(
      "Climate change is caused by greenhouse gases",
      "Greenhouse gases cause climate change"
    );
    // Jaccard similarity: 4 common words / 8 unique words = 0.5
    expect(score).toBeGreaterThan(0.4);
  });

  it("should return 0.0 for completely different answers", () => {
    const score = compareAnswers("Hello world", "Goodbye universe");
    expect(score).toBeLessThan(0.5);
  });

  it("should handle case differences", () => {
    const score = compareAnswers("Hello World", "hello world");
    expect(score).toBe(1.0);
  });

  it("should ignore punctuation", () => {
    const score = compareAnswers("Hello, world!", "Hello world");
    expect(score).toBe(1.0);
  });

  it("should return 1.0 for both empty strings", () => {
    const score = compareAnswers("", "");
    expect(score).toBe(1.0);
  });

  it("should return 0.0 if one answer is empty", () => {
    const score1 = compareAnswers("Hello", "");
    const score2 = compareAnswers("", "Hello");
    expect(score1).toBe(0.0);
    expect(score2).toBe(0.0);
  });

  it("should handle partial word overlap", () => {
    const score = compareAnswers("The cat sat on the mat", "The dog sat on the mat");
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1.0);
  });

  it("should filter out empty words", () => {
    const score = compareAnswers("Hello   world", "Hello world");
    expect(score).toBe(1.0);
  });
});

describe("scoreRetrieval", () => {
  it("should return 1.0 when all keywords are found", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Revenue increased by 20%",
        index: 0,
        score: 0.9
      },
      {
        id: "c2",
        documentId: "doc-1",
        content: "Profit margins improved significantly",
        index: 1,
        score: 0.8
      }
    ];
    const keywords = ["revenue", "profit", "margin"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBe(1.0);
  });

  it("should return 0.0 when no keywords are found", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Unrelated content here",
        index: 0,
        score: 0.5
      }
    ];
    const keywords = ["revenue", "profit"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBe(0.0);
  });

  it("should return partial score when some keywords are found", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Revenue increased",
        index: 0,
        score: 0.9
      }
    ];
    const keywords = ["revenue", "profit", "margin"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBeCloseTo(1 / 3, 2);
  });

  it("should return 1.0 when no keywords provided", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Some content",
        index: 0,
        score: 0.5
      }
    ];

    const score = scoreRetrieval(retrieved, []);
    expect(score).toBe(1.0);
  });

  it("should return 0.0 when no chunks retrieved", () => {
    const keywords = ["revenue", "profit"];

    const score = scoreRetrieval([], keywords);
    expect(score).toBe(0.0);
  });

  it("should handle case-insensitive keyword matching", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "REVENUE increased",
        index: 0,
        score: 0.9
      }
    ];
    const keywords = ["revenue"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBe(1.0);
  });

  it("should find keywords across multiple chunks", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Revenue increased",
        index: 0,
        score: 0.9
      },
      {
        id: "c2",
        documentId: "doc-1",
        content: "Profit margins",
        index: 1,
        score: 0.8
      }
    ];
    const keywords = ["revenue", "profit"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBe(1.0);
  });

  it("should handle keywords that appear multiple times", () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-1",
        content: "Revenue revenue revenue",
        index: 0,
        score: 0.9
      }
    ];
    const keywords = ["revenue", "profit"];

    const score = scoreRetrieval(retrieved, keywords);
    expect(score).toBe(0.5); // Only "revenue" found, not "profit"
  });
});
