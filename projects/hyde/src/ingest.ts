import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { runIngestion } from "../../basic-rag/src/ingest";
import { RagConfig } from "../../../shared/typescript/utils/types";

/**
 * Main ingestion pipeline for the HyDE RAG system.
 *
 * This function reuses the standard ingestion pipeline from basic-rag.
 * No special ingestion requirements are needed for HyDE, as hypothetical
 * documents are generated at query time, not during ingestion.
 *
 * The ingestion process:
 * 1. Loads documents from the data directory
 * 2. Splits documents into chunks
 * 3. Generates embeddings for each chunk
 * 4. Stores chunks and embeddings in a vector store
 * 5. Persists the vector store to disk
 *
 * @throws Error if configuration is invalid, documents cannot be read,
 *         embeddings fail to generate, or the index cannot be persisted
 *
 * @example
 * ```bash
 * # Run from projects/hyde directory
 * pnpm run ingest
 * ```
 */
async function main(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/hyde.config.json");
  const cfg = loadRagConfig(configPath);

  const result = await runIngestion(cfg);
  logger.info("Ingestion complete - Summary", {
    documentsProcessed: result.documents.length,
    chunksCreated: result.chunks.length,
    averageChunksPerDocument:
      result.documents.length > 0
        ? (result.chunks.length / result.documents.length).toFixed(2)
        : 0,
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

