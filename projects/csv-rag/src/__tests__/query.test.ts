import { describe, expect, it } from "vitest";
import { CsvRagConfig } from "../ingest";
import { answerCsvQuestion, buildCsvPrompt, formatCsvChunk } from "../query";
import { RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient, ChatClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
}

class FakeChatClient implements ChatClient {
  public prompts: string[] = [];
  async chat(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
    const last = messages.at(-1)?.content ?? "";
    this.prompts.push(last);
    return `Echo: ${last.slice(0, 20)}`;
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  constructor(private readonly chunks: RetrievedChunk[]) {}
  search(): RetrievedChunk[] {
    return this.chunks;
  }
}

const cfg: CsvRagConfig = {
  chunkSize: 400,
  chunkOverlap: 100,
  topK: 3,
  embeddingModel: "embed",
  chatModel: "chat",
  dataPath: "data",
  indexPath: ".tmp/index.json",
  csvPath: "data/company.csv"
};

describe("csv query helpers", () => {
  it("formats chunks with metadata", () => {
    const chunk: RetrievedChunk = {
      id: "row-0",
      documentId: "row-0",
      content: "Notes: Strong revenue",
      index: 0,
      score: 0.82,
      metadata: { Year: "2024" }
    };
    const formatted = formatCsvChunk(chunk);
    expect(formatted).toContain("Score: 0.820");
    expect(formatted).toContain("Year: 2024");
  });

  it("builds prompts even when no chunks are available", () => {
    const prompt = buildCsvPrompt("What changed?", []);
    expect(prompt).toContain("No relevant rows");
  });
});

describe("answerCsvQuestion", () => {
  it("queries embedding, vector store, and chat client", async () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "row-0",
        documentId: "row-0",
        content: "Notes: Revenue grew",
        index: 0,
        score: 0.91,
        metadata: { Year: "2024" }
      }
    ];
    const embeddingClient = new FakeEmbeddingClient();
    const chatClient = new FakeChatClient();
    const vectorStore = new FakeVectorStore(retrieved);

    const result = await answerCsvQuestion("How did revenue change?", cfg, {
      embeddingClient,
      chatClient,
      vectorStore
    });

    expect(result.retrieved).toEqual(retrieved);
    expect(chatClient.prompts).toHaveLength(1);
    expect(result.answer.startsWith("Echo")).toBe(true);
  });

  it("throws on empty questions", async () => {
    await expect(() => answerCsvQuestion("   ", cfg)).rejects.toThrow();
  });
});

