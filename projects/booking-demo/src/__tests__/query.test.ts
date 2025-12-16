import { describe, expect, it, vi } from "vitest";
import { RagConfig, RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { RankedChunk, buildPrompt, recommendHotels, rerankResults } from "../query";

const cfg: RagConfig = {
  chunkSize: 1600,
  chunkOverlap: 0,
  topK: 5,
  embeddingModel: "test-embed",
  chatModel: "test-chat",
  dataPath: "",
  indexPath: ""
};

describe("rerankResults", () => {
  const retrieved: RetrievedChunk[] = [
    {
      id: "a",
      documentId: "a",
      content: "Sauna suite",
      index: 0,
      metadata: { price: 120, rating: 9.2, amenities: ["sauna", "wifi"], roomName: "Suite" },
      score: 0.6
    },
    {
      id: "b",
      documentId: "b",
      content: "Budget room",
      index: 0,
      metadata: { price: 90, rating: 7.0, amenities: ["wifi"] },
      score: 0.7
    }
  ];

  it("prioritizes matches that fit preferences", () => {
    const ranked = rerankResults(retrieved, {
      query: "quiet stay",
      maxBudget: 130,
      minRating: 8,
      requiredAmenities: ["sauna"]
    });

    expect(ranked[0].documentId).toBe("a");
    expect(ranked[0].preferenceScore).toBeGreaterThan(ranked[1].preferenceScore);
  });
});

describe("buildPrompt", () => {
  it("includes preferences and candidates", () => {
    const ranked: RankedChunk[] = [
      {
        id: "a",
        documentId: "a",
        content: "Nice room",
        index: 0,
        score: 0.5,
        preferenceScore: 0.5,
        reasons: ["Fits budget"],
        metadata: { hotelName: "Stay A", price: 100, rating: 9 }
      }
    ];

    const prompt = buildPrompt(
      { query: "city center", maxBudget: 120, minRating: 8 },
      ranked
    );

    expect(prompt).toContain("city center");
    expect(prompt).toContain("Stay A");
    expect(prompt).toContain("Den Bosch");
  });
});

describe("recommendHotels", () => {
  it("returns top 5 ranked items and uses injected clients", async () => {
    const retrieved: RetrievedChunk[] = Array.from({ length: 6 }).map((_, idx) => ({
      id: `id-${idx}`,
      documentId: `doc-${idx}`,
      content: `Room ${idx}`,
      index: 0,
      metadata: { price: 100 + idx, rating: 8 + idx * 0.1, hotelName: `Hotel ${idx}` },
      score: 0.5 - idx * 0.01
    }));

    const embeddingClient = { embed: vi.fn(async () => [[0.1, 0.2]]) };
    const vectorStore = { search: vi.fn().mockReturnValue(retrieved) };
    const chatClient = { chat: vi.fn(async () => "Top picks") };

    const result = await recommendHotels(
      { query: "near station", maxBudget: 150 },
      cfg,
      { embeddingClient, vectorStore, chatClient }
    );

    expect(embeddingClient.embed).toHaveBeenCalled();
    expect(vectorStore.search).toHaveBeenCalledWith(expect.any(Array), cfg.topK);
    expect(chatClient.chat).toHaveBeenCalled();
    expect(result.retrieved).toHaveLength(5);
    expect(result.answer).toBe("Top picks");
  });
});
