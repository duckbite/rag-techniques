import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentsFromRows,
  inferMetadataColumns,
  inferTextColumns,
  rowToDocument,
  runCsvIngestion,
  CsvRagConfig
} from "../ingest";
import { CsvRow } from "../../../../shared/typescript/utils/csv";
import { Chunk, Document, RagConfig } from "../../../../shared/typescript/utils/types";
import { EmbeddingClient } from "../../../../shared/typescript/utils/llm";
import { VectorStore } from "../../../../shared/typescript/utils/vectorStore";

const sampleRows: CsvRow[] = [
  { Year: "2023", Metric: "Revenue", Value: "$50B", Notes: "Strong retail rebound" },
  { Year: "2024", Metric: "R&D", Value: "$4B", Notes: "Investing in materials" }
];

class FakeEmbeddingClient implements EmbeddingClient {
  public calls: string[][] = [];

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map((_, idx) => [idx, idx + 0.1]);
  }
}

class FakeVectorStore implements VectorStore {
  public added: { chunks: Chunk[]; embeddings: number[][] }[] = [];
  public persisted?: string;

  addMany(chunks: Chunk[], embeddings: number[][]): void {
    this.added.push({ chunks, embeddings });
  }

  search() {
    return [];
  }

  persist(filePath: string): void {
    this.persisted = filePath;
  }
}

describe("csv ingestion helpers", () => {
  it("infers text columns when none are provided", () => {
    const columns = inferTextColumns(sampleRows);
    expect(columns).toEqual(["Metric", "Value", "Notes"]);
  });

  it("infers metadata columns from remaining headers", () => {
    const textColumns = ["Notes"];
    const metadataColumns = inferMetadataColumns(sampleRows, textColumns);
    expect(metadataColumns).toEqual(["Year", "Metric", "Value"]);
  });

  it("converts rows into documents with metadata", () => {
    const doc = rowToDocument(sampleRows[0], 0, ["Notes"], ["Year", "Metric"]);
    expect(doc.content).toContain("Notes");
    expect(doc.metadata).toMatchObject({ Year: "2023", Metric: "Revenue", rowIndex: 0 });
  });

  it("buildDocumentsFromRows skips empty entries", () => {
    const rows: CsvRow[] = [
      { Year: "2023", Comment: "" },
      { Year: "2024", Comment: "has content" }
    ];
    const docs = buildDocumentsFromRows(rows, ["Comment"], ["Year"]);
    expect(docs).toHaveLength(1);
    expect(docs[0].metadata?.Year).toBe("2024");
  });
});

describe("runCsvIngestion", () => {
  it("loads rows, chunks, embeds, and persists", async () => {
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
    const chunker = vi.fn((doc: Document) => [
      { id: `${doc.id}-chunk-0`, documentId: doc.id, content: doc.content, index: 0 }
    ]);
    const embeddingClient = new FakeEmbeddingClient();
    const vectorStore = new FakeVectorStore();

    const result = await runCsvIngestion(cfg, {
      loadRows: () => sampleRows,
      chunkDocument: chunker,
      embeddingClient,
      vectorStore
    });

    expect(result.documents).toHaveLength(sampleRows.length);
    expect(chunker).toHaveBeenCalledTimes(sampleRows.length);
    expect(embeddingClient.calls).toHaveLength(1);
    expect(vectorStore.added[0].chunks).toHaveLength(sampleRows.length);
    expect(vectorStore.persisted).toBe(cfg.indexPath);
  });

  it("persists empty store when no chunks generated", async () => {
    const cfg: CsvRagConfig = {
      chunkSize: 200,
      chunkOverlap: 20,
      topK: 2,
      embeddingModel: "embed",
      chatModel: "chat",
      dataPath: "data",
      indexPath: ".tmp/index.json",
      csvPath: "data/company.csv"
    };
    const store = new FakeVectorStore();
    const result = await runCsvIngestion(cfg, {
      loadRows: () => [],
      chunkDocument: () => [],
      embeddingClient: new FakeEmbeddingClient(),
      vectorStore: store
    });
    expect(result.documents).toHaveLength(0);
    expect(store.added).toHaveLength(0);
    expect(store.persisted).toBe(cfg.indexPath);
  });
});

