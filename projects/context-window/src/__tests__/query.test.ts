import { describe, expect, it } from "vitest";
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

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2]);
  }
}

class FakeChatClient implements ChatClient {
  public lastMessages?: ChatMessage[];

  async chat(messages: ChatMessage[]): Promise<string> {
    this.lastMessages = messages;
    return "stubbed-answer";
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
  topK: 4,
  embeddingModel: "embed",
  chatModel: "chat",
  dataPath: "./data",
  indexPath: ".tmp/index.json",
  contextWindowSize: 1000
};

describe("context-window query", () => {
  it("expands retrieved context into a larger window", async () => {
    const baseChunks: RetrievedChunk[] = [
      {
        id: "c1",
        documentId: "doc-0",
        content: "Window A",
        index: 0,
        score: 0.9
      },
      {
        id: "c2",
        documentId: "doc-0",
        content: "Window B",
        index: 1,
        score: 0.8
      }
    ];

    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const store = new FakeVectorStore(baseChunks);

    const result = await answerQuestion("Question?", cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    expect(result.retrieved).toHaveLength(1);
    expect(result.retrieved[0].content).toContain("Window A");
    expect(result.retrieved[0].content).toContain("Window B");
    expect(chatClient.lastMessages?.[0].content).toContain("Window A");
    expect(chatClient.lastMessages?.[0].content).toContain("Window B");
  });
});

