import { describe, expect, it } from "vitest";
import {
  ReliableRagConfig,
  answerReliableQuestion,
  buildReliablePrompt,
  validateRetrievedChunks
} from "../query";
import { RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient, ChatClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeChatClient implements ChatClient {
  public calls: string[] = [];
  async chat(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
    const prompt = messages.at(-1)?.content ?? "";
    this.calls.push(prompt);
    return `Validated: ${prompt.slice(0, 20)}`;
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  constructor(private readonly chunks: RetrievedChunk[]) {}
  search(): RetrievedChunk[] {
    return this.chunks;
  }
}

const cfg: ReliableRagConfig = {
  chunkSize: 800,
  chunkOverlap: 200,
  topK: 3,
  embeddingModel: "embed",
  chatModel: "chat",
  dataPath: "data",
  indexPath: ".tmp/index.json",
  relevanceThreshold: 0.4,
  highlightWindow: 120
};

describe("validateRetrievedChunks", () => {
  it("flags relevant chunks based on score or keyword overlap", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "Revenue grew 20% thanks to digital commerce momentum.",
        index: 0,
        score: 0.5
      },
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "This paragraph talks about footwear materials.",
        index: 0,
        score: 0.2
      }
    ];
    const validated = validateRetrievedChunks("How did revenue grow?", chunks, cfg);
    expect(validated[0].isRelevant).toBe(true);
    expect(validated[1].isRelevant).toBe(false);
    expect(validated[0].excerpt).toContain("Revenue");
  });
});

describe("answerReliableQuestion", () => {
  it("uses validated chunks in the prompt and calls chat client", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "Water stewardship remains the priority with an 18% drop in usage.",
        index: 0,
        score: 0.6
      }
    ];
    const chatClient = new FakeChatClient();
    const result = await answerReliableQuestion("What happened to water usage?", cfg, {
      embeddingClient: new FakeEmbeddingClient(),
      chatClient,
      vectorStore: new FakeVectorStore(chunks)
    });
    expect(result.validatedChunks).toHaveLength(1);
    expect(chatClient.calls).toHaveLength(1);
    expect(result.answer.startsWith("Validated")).toBe(true);
  });

  it("falls back to top chunk when nothing validates", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "Inventory turns improved and demand planning stabilized.",
        index: 0,
        score: 0.1
      }
    ];
    const result = await answerReliableQuestion("Tell me about finance approvals.", cfg, {
      embeddingClient: new FakeEmbeddingClient(),
      chatClient: new FakeChatClient(),
      vectorStore: new FakeVectorStore(chunks)
    });
    expect(result.validatedChunks).toHaveLength(1);
  });

  it("builds prompts even when context is empty", () => {
    const prompt = buildReliablePrompt("Question?", []);
    expect(prompt).toContain("do not know");
  });
});

