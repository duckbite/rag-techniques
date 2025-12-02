import { describe, expect, it } from "vitest";
import {
  answerQuestionWithHyPE,
  buildPrompt,
  formatRetrievedChunks
} from "../query";
import { loadHyPEConfig } from "../ingest";
import { RetrievedChunk } from "../../../../shared/typescript/utils/types";
import {
  ChatClient,
  ChatMessage,
  EmbeddingClient
} from "../../../../shared/typescript/utils/llm";
import { HyPEVectorStore } from "../vectorStore";

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

const baseConfig = {
  chunkSize: 200,
  chunkOverlap: 20,
  topK: 2,
  embeddingModel: "embed-model",
  chatModel: "chat-model",
  dataPath: "./data",
  indexPath: ".tmp/index.json",
  questionGenModel: "question-model",
  questionsPerChunk: 4
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

describe("answerQuestionWithHyPE", () => {
  it("embeds query and searches against question embeddings", async () => {
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
    const store = new HyPEVectorStore();
    // Add a chunk with question embeddings
    store.addChunkWithQuestions(
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "alpha content",
        index: 0
      },
      [[0.1, 0.2, 0.3]], // Question embedding
      ["What is alpha?"]
    );
    // Mock search to return our test chunks
    const originalSearch = store.search.bind(store);
    store.search = () => retrievedChunks;

    const result = await answerQuestionWithHyPE("What is alpha?", baseConfig as any, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Should embed the user query
    expect(embeddingClient.inputs.length).toBe(1);
    expect(embeddingClient.inputs[0][0]).toBe("What is alpha?");
    // Should call chat client for answer generation
    expect(chatClient.calls.length).toBe(1);
    expect(chatClient.calls[0].model).toBe(baseConfig.chatModel);
    expect(result.answer).toBe("stubbed-answer");
    expect(result.retrieved).toEqual(retrievedChunks);
  });

  it("throws when question is empty", async () => {
    await expect(() => answerQuestionWithHyPE("   ", baseConfig as any)).rejects.toThrow(
      "Question cannot be empty."
    );
  });
});


