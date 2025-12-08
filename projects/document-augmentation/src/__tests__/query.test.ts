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

describe("document-augmentation query", () => {
  it("can retrieve Q/A augmented chunks", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-0-qa-0",
        documentId: "doc-0",
        content: "Q: What is this about?\nA: This is about testing.",
        index: 0,
        score: 0.9,
        metadata: { augmentation: "qa", sourceChunkId: "chunk-0" }
      }
    ];

    const chatClient = new FakeChatClient();
    const result = await answerQuestion("What is this about?", baseConfig, {
      embeddingClient: new FakeEmbeddingClient(),
      chatClient,
      vectorStore: new FakeVectorStore(chunks)
    });

    const prompt = chatClient.calls[0][0].content;
    expect(prompt).toContain("Q: What is this about?");
    expect(prompt).toContain("A: This is about testing.");
    expect(result.answer).toBe("Test answer");
  });
});

