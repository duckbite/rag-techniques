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
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
import { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";

export interface ReliableIngestDependencies {
  readDocuments?: (dir: string) => Document[];
  chunkDocument?: (doc: Document, cfg: Pick<RagConfig, "chunkSize" | "chunkOverlap">) => Chunk[];
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
}

export interface ReliableIngestionResult {
  documents: Document[];
  chunks: Chunk[];
}

export async function runReliableIngestion(
  cfg: RagConfig,
  deps: ReliableIngestDependencies = {}
): Promise<ReliableIngestionResult> {
  const readDocs = deps.readDocuments ?? readDocumentsFromDir;
  const chunker =
    deps.chunkDocument ??
    ((doc: Document) => simpleChunkDocument(doc, { chunkSize: cfg.chunkSize, chunkOverlap: cfg.chunkOverlap }));
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
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/reliable-rag.config.json");
  logger.info("Loading config", { configPath });
  const cfg = loadRagConfig(configPath);
  await runReliableIngestion(cfg);
  logger.info("Reliable ingestion complete", { indexPath: path.resolve(cfg.indexPath) });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Reliable ingestion failed", { err });
    process.exitCode = 1;
  });
}

