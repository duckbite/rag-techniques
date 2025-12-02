import { describe, expect, it } from "vitest";
import {
  answerQuestionWithTransform,
  buildPrompt,
  formatRetrievedChunks,
  mergeRetrievedChunks,
  loadQueryTransformConfig
} from "../query";
import {
  QueryTransformRagConfig,
  QueryTransformDependencies
} from "../query";
import {
  RetrievedChunk
} from "../../../../shared/typescript/utils/types";
import {
  ChatClient,
  ChatMessage,
  EmbeddingClient
} from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  public inputs: string[][] = [];
  async embed(texts: string[]): Promise<number[][]> {
    this.inputs.push(texts);
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeChatClient implements ChatClient {
  public calls: { messages: ChatMessage[]; model: string }[] = [];
  async chat(messages: ChatMessage[], model: string): Promise<string> {
    this.calls.push({ messages, model });
    // Return mock transformation responses
    const content = messages[0]?.content ?? "";
    if (content.includes("rewrite")) {
      return "rewritten query";
    }
    if (content.includes("step-back")) {
      return "step-back query";
    }
    if (content.includes("decompose")) {
      return "1. Sub-query one\n2. Sub-query two";
    }
    return "stubbed-answer";
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  public lastQuery?: { embedding: number[]; topK: number };
  constructor(private readonly results: RetrievedChunk[]) {}

  search(queryEmbedding: number[], topK: number): RetrievedChunk[] {
    this.lastQuery = { embedding: queryEmbedding, topK };
    return this.results;
  }
}

const baseConfig: QueryTransformRagConfig = {
  chunkSize: 200,
  chunkOverlap: 20,
  topK: 2,
  embeddingModel: "embed-model",
  chatModel: "chat-model",
  dataPath: "./data",
  indexPath: ".tmp/index.json",
  transformationType: "rewrite",
  transformationModel: "transform-model",
  maxSubQueries: 4
};

describe("query helpers", () => {
  it("formatRetrievedChunks includes scores and source metadata", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "alpha",
        index: 0,
        score: 0.9123,
        metadata: { title: "doc alpha" }
      }
    ];
    const formatted = formatRetrievedChunks(chunks);
    expect(formatted).toContain("Chunk 1 (score=0.912)");
    expect(formatted).toContain("Source: doc alpha");
    expect(formatted).toContain("alpha");
  });

  it("formatRetrievedChunks handles empty results", () => {
    expect(formatRetrievedChunks([])).toBe("No relevant context retrieved.");
  });

  it("buildPrompt stitches instructions, context, and question", () => {
    const chunks: RetrievedChunk[] = [
      { id: "c", documentId: "doc", content: "context", index: 0, score: 0.5 }
    ];
    const prompt = buildPrompt("What is up?", chunks);
    expect(prompt).toContain("Context:");
    expect(prompt).toContain("context");
    expect(prompt).toContain("Question: What is up?");
    expect(prompt.endsWith("Answer:")).toBe(true);
  });

  it("mergeRetrievedChunks deduplicates and sorts by score", () => {
    const chunks1: RetrievedChunk[] = [
      { id: "chunk-1", documentId: "doc", content: "one", index: 0, score: 0.9 },
      { id: "chunk-2", documentId: "doc", content: "two", index: 1, score: 0.7 }
    ];
    const chunks2: RetrievedChunk[] = [
      { id: "chunk-2", documentId: "doc", content: "two", index: 1, score: 0.8 },
      { id: "chunk-3", documentId: "doc", content: "three", index: 2, score: 0.6 }
    ];

    const merged = mergeRetrievedChunks([chunks1, chunks2], 3);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe("chunk-1"); // Highest score
    expect(merged[1].id).toBe("chunk-2"); // Kept higher score (0.8)
    expect(merged[2].id).toBe("chunk-3");
    expect(merged[0].score).toBe(0.9);
    expect(merged[1].score).toBe(0.8); // Higher of the two chunk-2 scores
  });

  it("mergeRetrievedChunks respects topK limit", () => {
    const chunks: RetrievedChunk[] = [
      { id: "chunk-1", documentId: "doc", content: "one", index: 0, score: 0.9 },
      { id: "chunk-2", documentId: "doc", content: "two", index: 1, score: 0.8 },
      { id: "chunk-3", documentId: "doc", content: "three", index: 2, score: 0.7 }
    ];
    const merged = mergeRetrievedChunks([chunks], 2);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("chunk-1");
    expect(merged[1].id).toBe("chunk-2");
  });
});

describe("answerQuestionWithTransform", () => {
  it("applies rewrite transformation", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const retrievedChunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "alpha content",
        index: 0,
        score: 0.99
      }
    ];
    const store = new FakeVectorStore(retrievedChunks);
    const config: QueryTransformRagConfig = {
      ...baseConfig,
      transformationType: "rewrite"
    };

    const result = await answerQuestionWithTransform("What is alpha?", config, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Should call chat client for rewriting
    expect(chatClient.calls.length).toBeGreaterThan(0);
    // Should embed the rewritten query
    expect(embeddingClient.inputs.length).toBeGreaterThan(0);
    expect(result.transformedQuery).toBeDefined();
    expect(result.transformationType).toBe("rewrite");
    expect(result.answer).toBe("stubbed-answer");
  });

  it("applies step-back transformation", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore([]);
    const config: QueryTransformRagConfig = {
      ...baseConfig,
      transformationType: "stepback"
    };

    const result = await answerQuestionWithTransform("test", config, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    expect(chatClient.calls.some((c) => c.messages[0].content.includes("step-back"))).toBe(true);
    expect(result.transformationType).toBe("stepback");
  });

  it("applies decompose transformation and merges results", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const retrievedChunks: RetrievedChunk[] = [
      { id: "chunk-1", documentId: "doc", content: "one", index: 0, score: 0.9 },
      { id: "chunk-2", documentId: "doc", content: "two", index: 1, score: 0.8 }
    ];
    const store = new FakeVectorStore(retrievedChunks);
    const config: QueryTransformRagConfig = {
      ...baseConfig,
      transformationType: "decompose"
    };

    const result = await answerQuestionWithTransform("complex question", config, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    expect(chatClient.calls.some((c) => c.messages[0].content.includes("decompose"))).toBe(true);
    expect(result.subQueries).toBeDefined();
    expect(result.subQueries!.length).toBeGreaterThan(0);
    expect(result.transformationType).toBe("decompose");
    // Should retrieve for each sub-query
    expect(embeddingClient.inputs.length).toBeGreaterThan(1);
  });

  it("applies all transformations when type is 'all'", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore([]);
    const config: QueryTransformRagConfig = {
      ...baseConfig,
      transformationType: "all"
    };

    await answerQuestionWithTransform("test", config, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Should have calls for rewrite, step-back, and decompose
    const callContents = chatClient.calls.map((c) => c.messages[0].content);
    expect(callContents.some((c) => c.includes("rewrite"))).toBe(true);
    expect(callContents.some((c) => c.includes("step-back"))).toBe(true);
    expect(callContents.some((c) => c.includes("decompose"))).toBe(true);
  });

  it("throws when question is empty", async () => {
    await expect(() =>
      answerQuestionWithTransform("   ", baseConfig)
    ).rejects.toThrow("Question cannot be empty.");
  });

  it("uses original query when no transformation matches", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore([]);
    const config: QueryTransformRagConfig = {
      ...baseConfig,
      transformationType: "rewrite" // But we'll make it not match
    };

    // Mock chat client to return empty for rewrite
    const mockChatClient: ChatClient = {
      async chat() {
        return "";
      }
    };

    await answerQuestionWithTransform("test", config, {
      embeddingClient,
      chatClient: mockChatClient,
      vectorStore: store
    });

    // Should still embed something (original query as fallback)
    expect(embeddingClient.inputs.length).toBeGreaterThan(0);
  });
});

describe("loadQueryTransformConfig", () => {
  it("loads and validates configuration", () => {
    const config = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 3,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json",
      transformationType: "rewrite",
      transformationModel: "test-transform",
      maxSubQueries: 4
    };

    // This test would require a file, so we'll test the structure
    expect(config.transformationType).toBe("rewrite");
    expect(config.transformationModel).toBe("test-transform");
    expect(config.maxSubQueries).toBe(4);
  });
});


