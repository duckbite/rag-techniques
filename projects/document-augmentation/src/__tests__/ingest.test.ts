import { describe, expect, it } from "vitest";
import { runIngestion } from "../ingest";
import {
  Chunk,
  Document,
  RagConfig
} from "../../../../shared/typescript/utils/types";
import {
  ChatClient,
  ChatMessage,
  EmbeddingClient
} from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((_, idx) => [idx]);
  }
}

class FakeChatClient implements ChatClient {
  async chat(): Promise<string> {
    return JSON.stringify([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" }
    ]);
  }
}

class FakeVectorStore implements VectorStore {
  public addedBatches: { chunks: Chunk[]; embeddings: number[][] }[] = [];
  public persistedPath?: string;

  addMany(chunks: Chunk[], embeddings: number[][]): void {
    this.addedBatches.push({ chunks, embeddings });
  }

  search(): never {
    throw new Error("not used");
  }

  persist(filePath: string): void {
    this.persistedPath = filePath;
  }
}

describe("document-augmentation ingestion", () => {
  it("adds synthetic Q/A chunks with augmentation metadata", async () => {
    const cfg: RagConfig = {
      chunkSize: 100,
      chunkOverlap: 0,
      topK: 3,
      embeddingModel: "embed",
      chatModel: "chat",
      dataPath: "./data",
      indexPath: ".tmp/index.json",
      questionsPerChunk: 2
    };

    const doc: Document = {
      id: "doc-0",
      title: "Test",
      content: "Base passage"
    };

    const store = new FakeVectorStore();

    const result = await runIngestion(cfg, {
      readDocuments: () => [doc],
      chunkDocument: () => [
        {
          id: "doc-0-chunk-0",
          documentId: "doc-0",
          content: "Base passage",
          index: 0
        }
      ],
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store,
      chatClient: new FakeChatClient()
    });

    expect(result.chunks.length).toBeGreaterThan(1);
    const qaChunks = result.chunks.filter(
      (c) => c.metadata && c.metadata.augmentation === "qa"
    );
    expect(qaChunks.length).toBeGreaterThanOrEqual(2);
  });
});

