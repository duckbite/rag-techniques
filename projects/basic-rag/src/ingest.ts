import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { EmbeddingClient, OpenAIEmbeddingClient } from "../../../shared/typescript/utils/llm";
import { Chunk, Document, RagConfig } from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";
import { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
export { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
export { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";
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
  let documents = readDocs(cfg.dataPath);
  if (cfg.documentTitles && cfg.documentTitles.length > 0) {
    const before = documents.length;
    documents = documents.filter((d) => d.title && cfg.documentTitles!.includes(d.title));
    logger.info("Filtered documents by title", {
      totalLoaded: before,
      allowedTitles: cfg.documentTitles,
      kept: documents.length
    });
  }
  logger.info("Loaded documents", {
    count: documents.length,
    titles: documents.map((d) => d.title)
  });

  logger.info("Chunking documents", {
    chunkSize: cfg.chunkSize,
    chunkOverlap: cfg.chunkOverlap
  });
  const chunks = documents.flatMap((doc) => {
    const docChunks = chunker(doc, cfg);
    logger.info("Chunked document", {
      documentId: doc.id,
      title: doc.title,
      chunkCount: docChunks.length,
      totalChars: doc.content.length
    });
    return docChunks;
  });
  logger.info("Created chunks", {
    count: chunks.length,
    averageChunkSize: chunks.length > 0
      ? Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)
      : 0
  });

  if (chunks.length === 0) {
    logger.warn("No chunks generated; persisting empty index", { indexPath: cfg.indexPath });
    vectorStore.persist(cfg.indexPath);
    return { documents, chunks };
  }

  logger.info("Generating embeddings", {
    model: cfg.embeddingModel,
    chunkCount: chunks.length
  });
  const embeddings = await embedChunks(chunks, embeddingClient);
  logger.info("Generated embeddings", {
    count: embeddings.length,
    dimension: embeddings[0]?.length ?? 0
  });

  logger.info("Storing chunks and embeddings in vector store");
  vectorStore.addMany(chunks, embeddings);
  vectorStore.persist(cfg.indexPath);
  logger.info("Persisted vector index", { indexPath: cfg.indexPath });

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

  const result = await runIngestion(cfg);
  logger.info("Ingestion complete - Summary", {
    documentsProcessed: result.documents.length,
    chunksCreated: result.chunks.length,
    averageChunksPerDocument:
      result.documents.length > 0 ? (result.chunks.length / result.documents.length).toFixed(2) : 0,
    indexPath: path.resolve(cfg.indexPath),
    embeddingModel: cfg.embeddingModel,
    chunkSize: cfg.chunkSize,
    chunkOverlap: cfg.chunkOverlap
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Ingestion failed", { err });
    process.exitCode = 1;
  });
}


