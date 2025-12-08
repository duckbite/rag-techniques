import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  ChatClient,
  EmbeddingClient,
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import { Chunk, Document, RagConfig } from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  VectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";
import { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";

export interface IngestDependencies {
  readDocuments?: (dir: string) => Document[];
  chunkDocument?: (doc: Document, cfg: RagConfig) => Chunk[];
  embeddingClient?: EmbeddingClient;
  vectorStore?: VectorStore;
  chatClient?: ChatClient;
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
  const chatClient = deps.chatClient ?? new OpenAIChatClient();

  logger.info("Reading documents for document-augmentation", { dataPath: cfg.dataPath });
  const documents = readDocs(cfg.dataPath);

  logger.info("Chunking documents for document-augmentation", {
    chunkSize: cfg.chunkSize,
    chunkOverlap: cfg.chunkOverlap
  });
  const chunks = documents.flatMap((doc) => chunker(doc, cfg));

  if (chunks.length === 0) {
    logger.warn("No chunks generated; persisting empty index", { indexPath: cfg.indexPath });
    vectorStore.persist(cfg.indexPath);
    return { documents, chunks };
  }

  logger.info("Generating embeddings for original chunks", {
    model: cfg.embeddingModel,
    chunkCount: chunks.length
  });
  const embeddings = await embedChunks(chunks, embeddingClient);

  logger.info("Storing original chunks and embeddings in vector store");
  vectorStore.addMany(chunks, embeddings);

  const questionsPerChunk = cfg.questionsPerChunk ?? 3;
  const qaChunks: Chunk[] = [];

  logger.info("Generating synthetic Q/A pairs for document augmentation", {
    questionsPerChunk
  });

  for (const chunk of chunks) {
    const prompt = [
      "You are helping to build a Retrieval-Augmented Generation (RAG) dataset.",
      "Given the following passage, generate a small set of question/answer pairs.",
      "",
      "Passage:",
      chunk.content,
      "",
      `Generate ${questionsPerChunk} diverse questions that can be answered from this passage.`,
      "Respond in JSON with the shape: [{\"question\": \"...\", \"answer\": \"...\"}, ...]."
    ].join("\n");

    const raw = await chatClient.chat(
      [
        {
          role: "user",
          content: prompt
        }
      ],
      cfg.chatModel
    );

    let parsed: Array<{ question: string; answer: string }> = [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.warn("Failed to parse Q/A JSON for chunk; skipping augmentation", {
        chunkId: chunk.id
      });
    }

    for (let i = 0; i < parsed.length; i += 1) {
      const qa = parsed[i];
      if (!qa?.question || !qa?.answer) continue;
      qaChunks.push({
        id: `${chunk.id}-qa-${i}`,
        documentId: chunk.documentId,
        content: `Q: ${qa.question}\nA: ${qa.answer}`,
        index: chunk.index,
        metadata: {
          ...(chunk.metadata ?? {}),
          sourceChunkId: chunk.id,
          augmentation: "qa"
        }
      });
    }
  }

  if (qaChunks.length > 0) {
    logger.info("Generating embeddings for synthetic Q/A chunks", {
      count: qaChunks.length
    });
    const qaEmbeddings = await embedChunks(qaChunks, embeddingClient);
    vectorStore.addMany(qaChunks, qaEmbeddings);
  }

  vectorStore.persist(cfg.indexPath);
  logger.info("Persisted vector index", { indexPath: cfg.indexPath });

  return { documents, chunks: [...chunks, ...qaChunks] };
}

async function main(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/document-augmentation.config.json");

  logger.info("Loading config for document-augmentation", { configPath });
  const cfg = loadRagConfig(configPath);

  const result = await runIngestion(cfg);
  logger.info("Document-augmentation ingestion complete", {
    documentsProcessed: result.documents.length,
    chunksCreated: result.chunks.length,
    indexPath: path.resolve(cfg.indexPath)
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Document-augmentation ingestion failed", { err });
    process.exitCode = 1;
  });
}


