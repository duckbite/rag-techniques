import { describe, expect, it } from "vitest";
import { answerQuestion } from "../query";
import { RagConfig, RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient, ChatClient, ChatMessage } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeChatClient implements ChatClient {
  public calls: ChatMessage[][] = [];
  async chat(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    return "Test answer";
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  constructor(private readonly chunks: RetrievedChunk[]) {}
  search(): RetrievedChunk[] {
    return this.chunks;
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

describe("semantic-chunking query", () => {
  it("retrieves and uses semantic chunks", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0",
        documentId: "doc-0",
        content: "Semantic chunk content",
        index: 0,
        score: 0.9
      }
    ];

    const chatClient = new FakeChatClient();
    const result = await answerQuestion("What is this?", baseConfig, {
      embeddingClient: new FakeEmbeddingClient(),
      chatClient,
      vectorStore: new FakeVectorStore(chunks)
    });

    expect(chatClient.calls.length).toBe(1);
    const prompt = chatClient.calls[0][0].content;
    expect(prompt).toContain("Semantic chunk content");
    expect(result.answer).toBe("Test answer");
  });
});

