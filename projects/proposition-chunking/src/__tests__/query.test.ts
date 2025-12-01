import { describe, expect, it } from "vitest";
import { PropositionConfig } from "../ingest";
import { answerPropositionQuestion, buildPropositionPrompt, formatPropositionChunk } from "../query";
import { RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient, ChatClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1]);
  }
}

class FakeChatClient implements ChatClient {
  public prompts: string[] = [];
  async chat(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
    const prompt = messages.at(-1)?.content ?? "";
    this.prompts.push(prompt);
    return "Answer based on propositions.";
  }
}

class FakeVectorStore implements Pick<VectorStore, "search"> {
  constructor(private readonly chunks: RetrievedChunk[]) {}
  search(): RetrievedChunk[] {
    return this.chunks;
  }
}

const cfg: PropositionConfig = {
  chunkSize: 800,
  chunkOverlap: 200,
  topK: 3,
  embeddingModel: "embed",
  chatModel: "chat",
  dataPath: "data",
  indexPath: ".tmp/index.json",
  propositionModel: "gen",
  gradingModel: "grade",
  maxPropositions: 5,
  gradingThreshold: 0.5
};

describe("proposition query helpers", () => {
  const chunk: RetrievedChunk = {
    id: "doc-0-chunk-0-prop-0",
    documentId: "doc-0",
    content: "The charter enforces weekly scans.",
    index: 0,
    score: 0.78,
    metadata: {
      sourceChunkId: "doc-0-chunk-0",
      excerpt: "Weekly scans are mandatory.",
      score: 0.9
    }
  };

  it("formats proposition chunks", () => {
    const formatted = formatPropositionChunk(chunk);
    expect(formatted).toContain("Proposition");
    expect(formatted).toContain("Score");
    expect(formatted).toContain("Weekly");
  });

  it("builds prompts with fallback messaging", () => {
    const prompt = buildPropositionPrompt("Question?", []);
    expect(prompt).toContain("don't know");
  });
});

describe("answerPropositionQuestion", () => {
  it("queries embedding, vector store, and chat client", async () => {
    const retrieved: RetrievedChunk[] = [
      {
        id: "p-0",
        documentId: "doc-0",
        content: "Logging is mandatory.",
        index: 0,
        score: 0.8,
        metadata: { sourceChunkId: "chunk-0" }
      }
    ];
    const chatClient = new FakeChatClient();
    const result = await answerPropositionQuestion("What is mandatory?", cfg, {
      embeddingClient: new FakeEmbeddingClient(),
      chatClient,
      vectorStore: new FakeVectorStore(retrieved)
    });
    expect(result.retrieved).toEqual(retrieved);
    expect(chatClient.prompts).toHaveLength(1);
  });

  it("throws on empty question", async () => {
    await expect(() => answerPropositionQuestion("   ", cfg)).rejects.toThrow();
  });
});

