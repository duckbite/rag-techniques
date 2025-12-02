import { describe, expect, it } from "vitest";
import {
  answerQuestionWithHyDE,
  buildPrompt,
  formatRetrievedChunks,
  loadHyDEConfig
} from "../query";
import { HyDEConfig, HyDEDependencies } from "../query";
import { RetrievedChunk } from "../../../../shared/typescript/utils/types";
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
    // First call is for hypothetical document, second is for answer
    if (this.calls.length === 1) {
      return "This is a hypothetical document that answers the question in detail.";
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

const baseConfig: HyDEConfig = {
  chunkSize: 200,
  chunkOverlap: 20,
  topK: 2,
  embeddingModel: "embed-model",
  chatModel: "chat-model",
  dataPath: "./data",
  indexPath: ".tmp/index.json",
  hydeModel: "hyde-model",
  targetDocumentLength: 200
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
});

describe("answerQuestionWithHyDE", () => {
  it("generates hypothetical document and uses it for retrieval", async () => {
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

    const result = await answerQuestionWithHyDE("What is alpha?", baseConfig, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Should call chat client twice: once for hypothetical doc, once for answer
    expect(chatClient.calls.length).toBe(2);
    // First call should be for hypothetical document generation
    expect(chatClient.calls[0].model).toBe(baseConfig.hydeModel);
    expect(chatClient.calls[0].messages[0].content).toContain("What is alpha?");
    // Second call should be for answer generation
    expect(chatClient.calls[1].model).toBe(baseConfig.chatModel);

    // Should embed the hypothetical document, not the original query
    expect(embeddingClient.inputs.length).toBe(1);
    expect(embeddingClient.inputs[0][0]).toContain("hypothetical document");

    expect(result.hypotheticalDocument).toBeDefined();
    expect(result.hypotheticalDocument.length).toBeGreaterThan(0);
    expect(result.answer).toBe("stubbed-answer");
    expect(result.retrieved).toEqual(retrievedChunks);
  });

  it("throws when question is empty", async () => {
    await expect(() => answerQuestionWithHyDE("   ", baseConfig)).rejects.toThrow(
      "Question cannot be empty."
    );
  });

  it("uses hypothetical document embedding for search", async () => {
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore([]);

    await answerQuestionWithHyDE("test", baseConfig, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Should have embedded the hypothetical document
    expect(embeddingClient.inputs.length).toBe(1);
    // Should have searched with that embedding
    expect(store.lastQuery).toBeDefined();
    expect(store.lastQuery?.topK).toBe(baseConfig.topK);
  });
});

describe("loadHyDEConfig", () => {
  it("validates required configuration keys", () => {
    const config = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 3,
      embeddingModel: "test-embed",
      chatModel: "test-chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json",
      hydeModel: "test-hyde",
      targetDocumentLength: 100
    };

    expect(config.hydeModel).toBe("test-hyde");
    expect(config.targetDocumentLength).toBe(100);
  });
});


