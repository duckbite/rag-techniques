import { describe, expect, it } from "vitest";
import {
  answerQuestion,
  buildPrompt,
  formatRetrievedChunks
} from "../query";
import {
  RagConfig,
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

const baseConfig: RagConfig = {
  chunkSize: 200,
  chunkOverlap: 20,
  topK: 2,
  embeddingModel: "embed-model",
  chatModel: "chat-model",
  dataPath: "./data",
  indexPath: ".tmp/index.json"
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

describe("answerQuestion", () => {
  it("runs retrieval-augmented flow with injected dependencies", async () => {
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

    const result = await answerQuestion("  What is alpha?  ", baseConfig, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    expect(embeddingClient.inputs[0]).toEqual(["What is alpha?"]);
    expect(store.lastQuery?.topK).toBe(baseConfig.topK);
    expect(chatClient.calls).toHaveLength(1);
    expect(chatClient.calls[0].model).toBe(baseConfig.chatModel);
    expect(chatClient.calls[0].messages[0].content).toContain("alpha content");
    expect(result.answer).toBe("stubbed-answer");
    expect(result.retrieved).toEqual(retrievedChunks);
  });

  it("throws when question is empty", async () => {
    await expect(() => answerQuestion("   ", baseConfig)).rejects.toThrow(
      "Question cannot be empty."
    );
  });
});

