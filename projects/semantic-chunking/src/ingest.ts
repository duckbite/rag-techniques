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
import {
  semanticChunkDocument,
  simpleChunkDocument
} from "../../../shared/typescript/utils/chunking";

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

  logger.info("Reading documents for semantic-chunking", { dataPath: cfg.dataPath });
  const documents = readDocs(cfg.dataPath);

  const useSemantic = cfg.semanticChunking ?? true;
  logger.info("Chunking documents for semantic-chunking", {
    strategy: useSemantic ? "semantic" : "fixed",
    chunkSize: cfg.chunkSize,
    chunkOverlap: cfg.chunkOverlap
  });

  const chunks = documents.flatMap((doc) =>
    useSemantic ? semanticChunkDocument(doc, cfg) : chunker(doc, cfg)
  );

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

  logger.info("Storing chunks and embeddings in vector store");
  vectorStore.addMany(chunks, embeddings);
  vectorStore.persist(cfg.indexPath);
  logger.info("Persisted vector index", { indexPath: cfg.indexPath });

  return { documents, chunks };
}

async function main(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/semantic-chunking.config.json");

  logger.info("Loading config for semantic-chunking", { configPath });
  const cfg = loadRagConfig(configPath);

  const result = await runIngestion(cfg);
  logger.info("Semantic-chunking ingestion complete", {
    documentsProcessed: result.documents.length,
    chunksCreated: result.chunks.length,
    indexPath: path.resolve(cfg.indexPath)
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Semantic-chunking ingestion failed", { err });
    process.exitCode = 1;
  });
}


