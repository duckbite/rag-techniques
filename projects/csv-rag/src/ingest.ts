import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadJsonConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { EmbeddingClient, OpenAIEmbeddingClient } from "../../../shared/typescript/utils/llm";
import { Chunk, Document, RagConfig } from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
import { CsvRow, loadCsv } from "../../../shared/typescript/utils/csv";

/**
 * Configuration for CSV-based RAG ingestion.
 *
 * Extends the base RAG configuration with CSV-specific settings:
 * - `csvPath`: Path to the CSV file to ingest
 * - `textColumns`: Optional list of column names to use for text content (auto-inferred if omitted)
 * - `metadataColumns`: Optional list of column names to store as metadata (auto-inferred if omitted)
 * - `delimiter`: CSV delimiter character (defaults to comma)
 *
 * When `textColumns` is not specified, the system automatically detects columns containing
 * alphabetic characters. All other columns become metadata. This makes it easy to work with
 * structured data where you want to search over text fields while preserving numeric/metric
 * information for filtering or display.
 */
export interface CsvRagConfig extends RagConfig {
  csvPath: string;
  textColumns?: string[];
  metadataColumns?: string[];
  delimiter?: string;
}

/**
 * Loads and validates a CSV RAG configuration file.
 *
 * This function reads a JSON configuration file and ensures it contains all required
 * fields for CSV-based RAG ingestion. It validates both the base RAG config fields
 * (chunkSize, embeddingModel, etc.) and CSV-specific fields (csvPath).
 *
 * @param configPath - Path to the JSON configuration file (relative or absolute)
 * @returns A validated CsvRagConfig object with all required fields
 * @throws Error if the config file is missing, invalid JSON, or missing required keys
 *
 * @example
 * ```typescript
 * const config = loadCsvRagConfig("./config/csv-rag.config.json");
 * // config.csvPath, config.textColumns, etc. are now available and typed
 * ```
 */
export function loadCsvRagConfig(configPath: string): CsvRagConfig {
  const data = loadJsonConfig(configPath) as Partial<CsvRagConfig>;
  const requiredKeys: (keyof RagConfig | "csvPath")[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "csvPath"
  ];
  for (const key of requiredKeys) {
    if (data[key as keyof CsvRagConfig] === undefined || data[key as keyof CsvRagConfig] === null) {
      throw new Error(`Missing required CSV RAG config key: ${key.toString()}`);
    }
  }
  return data as CsvRagConfig;
}

/**
 * Automatically identifies which CSV columns contain text suitable for embedding.
 *
 * This function analyzes CSV rows to determine which columns should be used as
 * text content for RAG. It uses a simple heuristic: a column is considered textual
 * if at least one row contains alphabetic characters (a-z, A-Z).
 *
 * **Why this matters**: In structured data like CSVs, some columns contain text
 * (company names, descriptions, notes) while others are purely numeric (revenue,
 * employee count). Text columns are embedded and searched, while numeric columns
 * are stored as metadata for filtering or display.
 *
 * The algorithm:
 * 1. If `preferred` columns are provided, use those (allows manual override)
 * 2. Otherwise, examine all column headers
 * 3. For each column, check if any row value contains letters
 * 4. Return all columns that pass the text detection test
 *
 * @param rows - Array of CSV row objects (key-value pairs)
 * @param preferred - Optional list of column names to use (bypasses auto-detection)
 * @returns Array of column names that contain text content
 *
 * @example
 * ```typescript
 * const rows = [
 *   { Company: "Acme Corp", Revenue: "1000000", Notes: "Growing fast" },
 *   { Company: "Beta Inc", Revenue: "500000", Notes: "Stable" }
 * ];
 * const textCols = inferTextColumns(rows);
 * // Returns: ["Company", "Notes"] (Revenue is numeric-only, excluded)
 * ```
 */
export function inferTextColumns(rows: CsvRow[], preferred?: string[]): string[] {
  if (preferred && preferred.length > 0) {
    return preferred;
  }
  if (rows.length === 0) {
    return [];
  }
  const headers = Object.keys(rows[0]);
  return headers.filter((header) => {
    const values = rows.map((row) => row[header] ?? "");
    // Consider a column textual when at least one row contains alphabetic characters
    return values.some((value) => /[a-zA-Z]/.test(value));
  });
}

/**
 * Identifies CSV columns that should be stored as metadata rather than embedded text.
 *
 * Metadata columns are preserved alongside chunks but are not included in the
 * embedding process. They're useful for:
 * - Filtering results (e.g., "show only 2023 data")
 * - Displaying context (e.g., showing revenue alongside answers)
 * - Structured queries (e.g., "companies with >1000 employees")
 *
 * This function simply returns all columns that are NOT in the text columns list.
 * If preferred metadata columns are specified, those are used instead.
 *
 * @param rows - Array of CSV row objects
 * @param textColumns - Columns already identified as text content
 * @param preferred - Optional list of column names to use as metadata (bypasses auto-detection)
 * @returns Array of column names to store as metadata
 *
 * @example
 * ```typescript
 * const textCols = ["Company", "Notes"];
 * const metadataCols = inferMetadataColumns(rows, textCols);
 * // Returns all columns except "Company" and "Notes"
 * ```
 */
export function inferMetadataColumns(
  rows: CsvRow[],
  textColumns: string[],
  preferred?: string[]
): string[] {
  if (preferred && preferred.length > 0) {
    return preferred;
  }
  if (rows.length === 0) {
    return [];
  }
  const headers = Object.keys(rows[0]);
  return headers.filter((header) => !textColumns.includes(header));
}

/**
 * Converts a CSV row into a Document object suitable for RAG ingestion.
 *
 * This function transforms structured CSV data into the Document format used by
 * the RAG pipeline. It combines text columns into a searchable content string
 * and stores metadata columns separately for later filtering or display.
 *
 * **Content construction**: Text columns are formatted as "ColumnName: value"
 * and joined with newlines. This preserves the structure while creating
 * searchable text. For example, a row with Company="Acme" and Notes="Growing"
 * becomes "Company: Acme\nNotes: Growing".
 *
 * **Metadata preservation**: All metadata columns are stored in the document's
 * metadata object, along with the row index for traceability.
 *
 * @param row - A single CSV row as a key-value object
 * @param index - Zero-based row index (used for document ID and metadata)
 * @param textColumns - Column names to include in the document content
 * @param metadataColumns - Column names to store as metadata only
 * @returns A Document object with content from text columns and metadata from other columns
 *
 * @example
 * ```typescript
 * const row = { Company: "Acme", Revenue: "1000000", Notes: "Growing" };
 * const doc = rowToDocument(row, 0, ["Company", "Notes"], ["Revenue"]);
 * // doc.content = "Company: Acme\nNotes: Growing"
 * // doc.metadata = { rowIndex: 0, Revenue: "1000000" }
 * ```
 */
export function rowToDocument(
  row: CsvRow,
  index: number,
  textColumns: string[],
  metadataColumns: string[]
): Document {
  const textParts = textColumns
    .map((column) => {
      const value = row[column];
      if (!value) return null;
      return `${column}: ${value}`;
    })
    .filter((part): part is string => Boolean(part));
  const content = textParts.join("\n").trim();

  const metadata: Record<string, unknown> = {
    rowIndex: index
  };
  for (const column of metadataColumns) {
    metadata[column] = row[column];
  }

  return {
    id: `row-${index}`,
    title: row[textColumns[0]] ?? `Row ${index + 1}`,
    content,
    metadata
  };
}

/**
 * Dependency injection interface for CSV ingestion pipeline.
 *
 * Allows external code to provide mock implementations for testing or
 * custom behavior. All fields are optional; defaults are used if not provided.
 *
 * - `loadRows`: Custom CSV loader (defaults to `loadCsv` from shared utils)
 * - `chunkDocument`: Custom chunking function (defaults to `simpleChunkDocument`)
 * - `embeddingClient`: Custom embedding client (defaults to OpenAI)
 * - `vectorStore`: Custom vector store (defaults to in-memory store)
 */
export interface CsvIngestDependencies {
  loadRows?: (filePath: string, options?: { delimiter?: string }) => CsvRow[];
  chunkDocument?: (doc: Document, cfg: Pick<RagConfig, "chunkSize" | "chunkOverlap">) => Chunk[];
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
}

export interface CsvIngestionResult {
  documents: Document[];
  chunks: Chunk[];
}

/**
 * Converts an array of CSV rows into Document objects, filtering out empty entries.
 *
 * This is a convenience function that maps rows to documents and removes any
 * documents that have no content (e.g., rows where all text columns are empty).
 * Empty documents would create empty chunks, which waste embedding API calls
 * and don't contribute to retrieval quality.
 *
 * @param rows - Array of CSV row objects
 * @param textColumns - Column names to use for document content
 * @param metadataColumns - Column names to store as metadata
 * @returns Array of Document objects with non-empty content
 *
 * @example
 * ```typescript
 * const docs = buildDocumentsFromRows(rows, ["Company", "Notes"], ["Revenue"]);
 * // Returns only documents where at least one text column has content
 * ```
 */
export function buildDocumentsFromRows(
  rows: CsvRow[],
  textColumns: string[],
  metadataColumns: string[]
): Document[] {
  return rows
    .map((row, idx) => rowToDocument(row, idx, textColumns, metadataColumns))
    .filter((doc) => doc.content.length > 0);
}

/**
 * Main CSV ingestion pipeline for RAG systems.
 *
 * This function orchestrates the complete process of ingesting structured CSV data
 * into a searchable vector index. It follows these steps:
 *
 * 1. **Load CSV**: Reads and parses the CSV file into row objects
 * 2. **Infer Columns**: Automatically determines which columns are text vs metadata
 *    (or uses config overrides if provided)
 * 3. **Build Documents**: Converts rows into Document objects with content and metadata
 * 4. **Chunk Documents**: Splits documents into overlapping chunks for embedding
 * 5. **Generate Embeddings**: Converts chunk text into dense vector representations
 * 6. **Store & Persist**: Saves chunks and embeddings to the vector store and persists to disk
 *
 * **Why CSV RAG?** Structured data like CSVs often contain a mix of searchable text
 * (company names, descriptions) and structured metadata (numbers, dates, categories).
 * This pipeline lets you search semantically over the text while preserving metadata
 * for filtering, aggregation, or display in your application.
 *
 * **Column Inference**: If `textColumns` isn't specified in config, the system
 * automatically detects columns containing alphabetic characters. This makes it
 * easy to get started, but you can override it for fine-grained control.
 *
 * @param cfg - CSV RAG configuration (paths, models, chunking parameters)
 * @param deps - Optional dependency overrides for testing or customization
 * @returns Object containing the created documents and chunks
 * @throws Error if CSV file is missing, has no text columns, or embedding fails
 *
 * @example
 * ```typescript
 * const config = loadCsvRagConfig("./config/csv-rag.config.json");
 * const result = await runCsvIngestion(config);
 * // result.documents: Array of Document objects
 * // result.chunks: Array of Chunk objects with embeddings
 * ```
 */
export async function runCsvIngestion(
  cfg: CsvRagConfig,
  deps: CsvIngestDependencies = {}
): Promise<CsvIngestionResult> {
  const loadRows = deps.loadRows ?? loadCsv;
  const chunker =
    deps.chunkDocument ??
    ((doc: Document) => simpleChunkDocument(doc, { chunkSize: cfg.chunkSize, chunkOverlap: cfg.chunkOverlap }));
  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const vectorStore = deps.vectorStore ?? new InMemoryVectorStore();

  const rows = loadRows(path.resolve(cfg.csvPath), { delimiter: cfg.delimiter });
  if (rows.length === 0) {
    logger.warn("CSV contained no rows; persisting empty index", { csvPath: cfg.csvPath });
    vectorStore.persist(cfg.indexPath);
    return { documents: [], chunks: [] };
  }
  const textColumns = inferTextColumns(rows, cfg.textColumns);
  const metadataColumns = inferMetadataColumns(rows, textColumns, cfg.metadataColumns);

  if (textColumns.length === 0) {
    throw new Error("Unable to determine text columns. Specify `textColumns` in config.");
  }

  logger.info("CSV stats", {
    csvPath: cfg.csvPath,
    rowCount: rows.length,
    textColumns,
    metadataColumns
  });

  const documents = buildDocumentsFromRows(rows, textColumns, metadataColumns);
  const chunks = documents.flatMap((doc) => chunker(doc, cfg));

  if (chunks.length === 0) {
    logger.warn("No chunks produced from CSV rows; persisting empty index");
    vectorStore.persist(cfg.indexPath);
    return { documents, chunks };
  }

  const embeddings = await embedChunks(chunks, embeddingClient);
  vectorStore.addMany(chunks, embeddings);
  vectorStore.persist(cfg.indexPath);
  return { documents, chunks };
}

async function main(): Promise<void> {
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/csv-rag.config.json");
  logger.info("Loading CSV RAG config", { configPath });
  const cfg = loadCsvRagConfig(configPath);
  await runCsvIngestion(cfg);
  logger.info("CSV ingestion complete", { indexPath: path.resolve(cfg.indexPath) });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("CSV ingestion failed", { err });
    process.exitCode = 1;
  });
}

