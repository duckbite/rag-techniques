import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadJsonConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  ChatClient,
  EmbeddingClient,
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import { RagConfig, Chunk, Document } from "../../../shared/typescript/utils/types";
import { readDocumentsFromDir } from "../../../shared/typescript/utils/documents";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
import { generateHypotheticalQuestions } from "./hype";
import { HyPEVectorStore } from "./vectorStore";

/**
 * Extended configuration for HyPE RAG system.
 *
 * Includes standard RAG configuration plus HyPE-specific settings:
 * - `questionGenModel`: LLM model for generating hypothetical questions
 * - `questionsPerChunk`: Target number of questions to generate per chunk
 */
export interface HyPEConfig extends RagConfig {
  questionGenModel: string;
  questionsPerChunk: number;
}

/**
 * Loads and validates a HyPE configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated HyPEConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadHyPEConfig(configPath: string): HyPEConfig {
  const data = loadJsonConfig(configPath) as Partial<HyPEConfig>;
  const requiredKeys: (keyof HyPEConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "questionGenModel",
    "questionsPerChunk"
  ];
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing config key: ${key.toString()}`);
    }
  }
  return data as HyPEConfig;
}

/**
 * Main ingestion pipeline for the HyPE RAG system.
 *
 * This function implements enhanced ingestion with question generation:
 * 1. Loads documents from the data directory
 * 2. Splits documents into chunks
 * 3. For each chunk:
 *    - Generates multiple hypothetical questions
 *    - Embeds each question
 *    - Stores chunk with all question embeddings
 * 4. Persists the enhanced vector store to disk
 *
 * **Key difference from basic-rag**: Instead of embedding chunks directly,
 * HyPE embeds hypothetical questions generated from chunks. This transforms
 * retrieval into a question-question matching problem.
 *
 * @throws Error if configuration is invalid, documents cannot be read,
 *         embeddings fail to generate, or the index cannot be persisted
 *
 * @example
 * ```bash
 * # Run from projects/hype directory
 * pnpm run ingest
 * ```
 */
async function main(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/hype.config.json");
  const cfg = loadHyPEConfig(configPath);

  logger.info("Loading config", { configPath });
  logger.info("Starting HyPE ingestion", {
    dataPath: cfg.dataPath,
    questionGenModel: cfg.questionGenModel,
    questionsPerChunk: cfg.questionsPerChunk
  });

  // Step 1: Load and chunk documents
  logger.info("Reading documents", { dataPath: cfg.dataPath });
  let documents = readDocumentsFromDir(cfg.dataPath);
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
    const docChunks = simpleChunkDocument(doc, cfg);
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
    averageChunkSize:
      chunks.length > 0
        ? Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)
        : 0
  });

  if (chunks.length === 0) {
    logger.warn("No chunks generated; persisting empty index", { indexPath: cfg.indexPath });
    const store = new HyPEVectorStore();
    store.persist(cfg.indexPath);
    return;
  }

  // Step 2: Initialize clients
  const chatClient = new OpenAIChatClient();
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const store = new HyPEVectorStore();

  // Step 3: For each chunk, generate questions and embed them
  logger.info("Generating hypothetical questions and embeddings", {
    chunkCount: chunks.length,
    questionsPerChunk: cfg.questionsPerChunk
  });

  let totalQuestions = 0;
  let totalEmbeddings = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    logger.info("Processing chunk", {
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      chunkId: chunk.id,
      chunkLength: chunk.content.length
    });

    // Generate hypothetical questions for this chunk
    const questions = await generateHypotheticalQuestions(
      chunk.content,
      chatClient,
      cfg.questionGenModel
    );
    logger.info("Generated questions for chunk", {
      chunkId: chunk.id,
      questionCount: questions.length,
      questions: questions.slice(0, 3) // Log first 3 for debugging
    });
    totalQuestions += questions.length;

    // Embed all questions
    const questionEmbeddings = await embeddingClient.embed(questions);
    totalEmbeddings += questionEmbeddings.length;
    logger.info("Embedded questions for chunk", {
      chunkId: chunk.id,
      embeddingCount: questionEmbeddings.length
    });

    // Store chunk with all question embeddings
    store.addChunkWithQuestions(chunk, questionEmbeddings, questions);
  }

  logger.info("Generated all questions and embeddings", {
    totalChunks: chunks.length,
    totalQuestions,
    totalEmbeddings,
    averageQuestionsPerChunk: (totalQuestions / chunks.length).toFixed(2)
  });

  // Step 4: Persist the enhanced vector store
  store.persist(cfg.indexPath);
  logger.info("Persisted HyPE vector index", { indexPath: path.resolve(cfg.indexPath) });

  logger.info("Ingestion complete - Summary", {
    documentsProcessed: documents.length,
    chunksCreated: chunks.length,
    totalQuestionsGenerated: totalQuestions,
    totalEmbeddingsCreated: totalEmbeddings,
    averageQuestionsPerChunk: (totalQuestions / chunks.length).toFixed(2),
    indexPath: path.resolve(cfg.indexPath),
    embeddingModel: cfg.embeddingModel,
    questionGenModel: cfg.questionGenModel,
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

