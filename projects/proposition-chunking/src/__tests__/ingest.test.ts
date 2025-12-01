import { describe, expect, it } from "vitest";
import {
  PropositionConfig,
  parseGradingResponse,
  parsePropositionList,
  runPropositionIngestion
} from "../ingest";
import { Document, Chunk, RetrievedChunk } from "../../../../shared/typescript/utils/types";
import { ChatClient, EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

class FakeChatClient implements ChatClient {
  async chat(
    _messages: { role: "user" | "system" | "assistant"; content: string }[],
    model?: string
  ): Promise<string> {
    if (model === "grade-model") {
      return "0.9 - The charter enforces weekly scans\n0.2 - Proposition that fails";
    }
    return "- The charter enforces weekly scans\n- Proposition that fails";
  }
}

class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((_, idx) => [idx]);
  }
}

class FakeVectorStore implements VectorStore {
  public storedChunks: Chunk[] = [];
  addMany(chunks: Chunk[], _embeddings: number[][]): void {
    this.storedChunks.push(...chunks);
  }
  search(): RetrievedChunk[] {
    return [];
  }
  persist(): void {
    // noop for tests
  }
}

describe("proposition helpers", () => {
  it("parses proposition lists and grading responses", () => {
    const props = parsePropositionList("- Prop A\n1) Prop B");
    expect(props).toEqual(["Prop A", "Prop B"]);

    const graded = parseGradingResponse("0.8 - Prop A\n0.4 - Prop B");
    expect(graded).toEqual([
      { score: 0.8, text: "Prop A" },
      { score: 0.4, text: "Prop B" }
    ]);
  });
});

describe("runPropositionIngestion", () => {
  it("generates, grades, and stores propositions", async () => {
    const cfg: PropositionConfig = {
      chunkSize: 400,
      chunkOverlap: 100,
      topK: 3,
      embeddingModel: "embed-model",
      chatModel: "chat-model",
      dataPath: "data",
      indexPath: ".tmp/index.json",
      propositionModel: "gen-model",
      gradingModel: "grade-model",
      maxPropositions: 3,
      gradingThreshold: 0.5
    };
    const documents: Document[] = [
      { id: "doc-0", title: "charter.txt", content: "Weekly scans and logging are mandatory." }
    ];
    const chunker = (_doc: Document): Chunk[] => [
      {
        id: "doc-0-chunk-0",
        documentId: "doc-0",
        content: "Weekly scans are mandatory.",
        index: 0
      }
    ];
    const store = new FakeVectorStore();

    const chunks = await runPropositionIngestion(cfg, {
      readDocuments: () => documents,
      chunkDocument: chunker,
      chatClient: new FakeChatClient(),
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });

    expect(chunks).toHaveLength(1);
    expect(store.storedChunks).toHaveLength(1);
    expect(store.storedChunks[0].content).toContain("charter");
  });
});

