import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { EmbeddingClient, OpenAIEmbeddingClient } from "../../../shared/typescript/utils/llm";
import {
  Chunk,
  Document,
  RagConfig
} from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";

/**
 * Reads all text and markdown documents from a directory and converts them
 * into Document objects.
 *
 * This function scans the specified directory for files with `.txt` or `.md`
 * extensions, reads their content, and creates Document objects with unique
 * IDs and filenames as titles.
 *
 * @param dir - The directory path containing document files (relative or absolute)
 * @returns An array of Document objects, one per file found
 * @throws Error if the directory doesn't exist or cannot be read
 *
 * @example
 * ```typescript
 * const docs = readDocumentsFromDir("./data");
 * // Returns: [{ id: "doc-0", title: "nike_report.txt", content: "..." }, ...]
 * ```
 */
export function readDocumentsFromDir(dir: string): Document[] {
  const resolved = path.resolve(dir);
  const files = fs.readdirSync(resolved).filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
  return files.map((file, idx) => {
    const content = fs.readFileSync(path.join(resolved, file), "utf-8");
    return {
      id: `doc-${idx}`,
      title: file,
      content
    };
  });
}

/**
 * Splits a document into overlapping chunks of text.
 *
 * This is a simple chunking strategy that divides text into fixed-size chunks
 * with a specified overlap. The overlap ensures that important information
 * spanning chunk boundaries is preserved in multiple chunks, improving
 * retrieval reliability.
 *
 * The algorithm:
 * 1. Starts at the beginning of the document
 * 2. Creates a chunk of `chunkSize` characters
 * 3. Moves forward by `chunkSize - chunkOverlap` characters (creating overlap)
 * 4. Repeats until the entire document is processed
 *
 * @param doc - The document to chunk
 * @param cfg - Configuration containing `chunkSize` and `chunkOverlap` parameters
 * @returns An array of Chunk objects, each containing a portion of the document
 *
 * @example
 * ```typescript
 * const chunks = simpleChunkDocument(
 *   { id: "doc-0", title: "test.txt", content: "This is a long document..." },
 *   { chunkSize: 100, chunkOverlap: 20, ... }
 * );
 * // Returns chunks of ~100 characters with 20-character overlaps
 * ```
 */
export function simpleChunkDocument(doc: Document, cfg: RagConfig): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, chunkOverlap } = cfg;
  const text = doc.content;
  let index = 0;
  let chunkIndex = 0;
  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    const content = text.slice(index, end);
    chunks.push({
      id: `${doc.id}-chunk-${chunkIndex}`,
      documentId: doc.id,
      content,
      index: chunkIndex
    });
    if (end === text.length) break;
    index += chunkSize - chunkOverlap;
    chunkIndex += 1;
  }
  return chunks;
}

/**
 * Main ingestion pipeline for the basic RAG system.
 *
 * This function orchestrates the complete document ingestion process:
 * 1. Loads environment variables (including OpenAI API key)
 * 2. Loads configuration from JSON file
 * 3. Reads documents from the data directory
 * 4. Splits documents into chunks
 * 5. Generates embeddings for each chunk
 * 6. Stores chunks and embeddings in a vector store
 * 7. Persists the vector store to disk for later use
 *
 * The resulting index file can be loaded by the query script to enable
 * semantic search and question answering.
 *
 * @throws Error if configuration is invalid, documents cannot be read,
 *         embeddings fail to generate, or the index cannot be persisted
 *
 * @example
 * ```bash
 * # Run from projects/basic-rag directory
 * pnpm run ingest
 * ```
 */
export interface IngestDependencies {
  readDocuments?: (dir: string) => Document[];
  chunkDocument?: (doc: Document, cfg: RagConfig) => Chunk[];
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
}

export interface IngestionResult {
  documents: Document[];
  chunks: Chunk[];
}

export async function runIngestion(
  cfg: RagConfig,
  deps: IngestDependencies = {}
): Promise<IngestionResult> {
  const readDocs = deps.readDocuments ?? readDocumentsFromDir;
  const chunker = deps.chunkDocument ?? simpleChunkDocument;
  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const vectorStore = deps.vectorStore ?? new InMemoryVectorStore();

  logger.info("Reading documents", { dataPath: cfg.dataPath });
  const documents = readDocs(cfg.dataPath);
  logger.info("Loaded documents", { count: documents.length });

  const chunks = documents.flatMap((doc) => chunker(doc, cfg));
  logger.info("Created chunks", { count: chunks.length });

  if (chunks.length === 0) {
    logger.warn("No chunks generated; persisting empty index", { indexPath: cfg.indexPath });
    vectorStore.persist(cfg.indexPath);
    return { documents, chunks };
  }

  const embeddings = await embedChunks(chunks, embeddingClient);
  vectorStore.addMany(chunks, embeddings);
  vectorStore.persist(cfg.indexPath);

  return { documents, chunks };
}

async function main(): Promise<void> {
  // Load environment variables from .env file
  loadEnv();

  // Determine config path: use RAG_CONFIG_PATH env var or default location
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/basic-rag.config.json");

  logger.info("Loading config", { configPath });
  const cfg = loadRagConfig(configPath);

  await runIngestion(cfg);
  logger.info("Ingestion complete", {
    indexPath: path.resolve(cfg.indexPath)
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Ingestion failed", { err });
    process.exitCode = 1;
  });
}


