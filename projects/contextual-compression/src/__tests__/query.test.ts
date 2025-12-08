import { describe, expect, it, vi } from "vitest";
import { answerQuestion } from "../query";
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

vi.mock("../../../../shared/typescript/utils/llm", async (orig) => {
  const mod = await orig() as Record<string, unknown>;
  return {
    ...mod,
    compressRetrievedContext: vi.fn(async () => "COMPRESSED_CONTEXT")
  };
});

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1]);
  }
}

class FakeChatClient implements ChatClient {
  public lastMessages?: ChatMessage[];

  async chat(messages: ChatMessage[]): Promise<string> {
    this.lastMessages = messages;
    return "final-answer";
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  constructor(private readonly results: RetrievedChunk[]) {}

  search(): RetrievedChunk[] {
    return this.results;
  }
}

const cfg: RagConfig = {
  chunkSize: 200,
  chunkOverlap: 20,
  topK: 2,
  embeddingModel: "embed",
  chatModel: "chat",
  dataPath: "./data",
  indexPath: ".tmp/index.json"
};

describe("contextual-compression query", () => {
  it("builds prompt from compressed context", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-0",
        content: "raw content",
        index: 0,
        score: 0.9
      }
    ];

    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore(chunks);

    const result = await answerQuestion("Question?", cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    expect(result.answer).toBe("final-answer");
    expect(chatClient.lastMessages?.[0].content).toContain("Compressed context:");
    expect(chatClient.lastMessages?.[0].content).toContain("COMPRESSED_CONTEXT");
  });
});

