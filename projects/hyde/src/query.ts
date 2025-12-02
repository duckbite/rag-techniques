import readline from "node:readline";
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
import {
  loadInMemoryVectorStore,
  VectorStore
} from "../../../shared/typescript/utils/vectorStore";
import { RagConfig, RetrievedChunk } from "../../../shared/typescript/utils/types";
import { generateHypotheticalDocument } from "./hyde";

/**
 * Extended configuration for HyDE RAG system.
 *
 * Includes standard RAG configuration plus HyDE-specific settings:
 * - `hydeModel`: LLM model for generating hypothetical documents
 * - `targetDocumentLength`: Target length for hypothetical documents (defaults to chunkSize)
 */
export interface HyDEConfig extends RagConfig {
  hydeModel: string;
  targetDocumentLength: number;
}

/**
 * Loads and validates a HyDE configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated HyDEConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadHyDEConfig(configPath: string): HyDEConfig {
  const data = loadJsonConfig(configPath) as Partial<HyDEConfig>;
  const requiredKeys: (keyof HyDEConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "hydeModel",
    "targetDocumentLength"
  ];
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing config key: ${key.toString()}`);
    }
  }
  return data as HyDEConfig;
}

type VectorSearcher = Pick<VectorStore, "search">;

export interface HyDEDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

/**
 * Result of answering a question using HyDE.
 *
 * Includes the answer, retrieved chunks, and HyDE metadata:
 * - `hypotheticalDocument`: The generated hypothetical document used for retrieval
 */
export interface HyDEAnswerResult {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
  hypotheticalDocument: string;
}

/**
 * Formats retrieved chunks for display in prompts.
 *
 * @param chunks - Array of retrieved chunks with similarity scores
 * @returns Formatted string representation of chunks
 */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant context retrieved.";
  }
  return chunks
    .map((chunk, idx) => {
      const source = chunk.metadata?.title ?? chunk.documentId;
      return [
        `Chunk ${idx + 1} (score=${chunk.score.toFixed(3)})`,
        `Source: ${source}`,
        chunk.content
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Builds a prompt for the LLM with retrieved context and question.
 *
 * @param question - The user's original question
 * @param chunks - Retrieved chunks to use as context
 * @returns Formatted prompt string
 */
export function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  return [
    "You are a helpful assistant answering questions based only on the provided context.",
    "If the answer is not in the context, say you don't know.",
    "",
    "Context:",
    formatRetrievedChunks(chunks),
    "",
    `Question: ${question}`,
    "Answer:"
  ].join("\n");
}

/**
 * Answers a question using HyDE (Hypothetical Document Embedding).
 *
 * This function implements the complete HyDE RAG pipeline:
 *
 * 1. **Generate Hypothetical Document**: Uses an LLM to create a synthetic document
 *    that answers the query. This document is similar in style and length to actual
 *    document chunks.
 *
 * 2. **Embed Hypothetical Document**: Converts the hypothetical document (not the
 *    original query) into a vector embedding.
 *
 * 3. **Retrieve**: Searches the vector store using the hypothetical document embedding,
 *    finding chunks that are similar to the hypothetical answer.
 *
 * 4. **Generate Answer**: Uses retrieved context to generate the final answer.
 *
 * **Why HyDE works**: By embedding a hypothetical document instead of the query,
 * we move the search vector closer to the document embedding space. This improves
 * retrieval relevance because:
 * - Hypothetical documents are similar in length and style to actual chunks
 * - They contain detailed information (like real documents) rather than just questions
 * - The embedding space alignment improves similarity matching
 *
 * @param question - The user's question (will be trimmed)
 * @param cfg - HyDE configuration (RAG settings + HyDE model)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing answer, retrieved chunks, and hypothetical document
 * @throws Error if question is empty, index missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerQuestionWithHyDE(
 *   "What is climate change?",
 *   config
 * );
 * // result.hypotheticalDocument: Generated document answering the question
 * // result.answer: Final answer based on retrieved context
 * ```
 */
export async function answerQuestionWithHyDE(
  question: string,
  cfg: HyDEConfig,
  deps: HyDEDependencies = {}
): Promise<HyDEAnswerResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient =
    deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  logger.info("Processing query with HyDE", {
    question: trimmedQuestion,
    hydeModel: cfg.hydeModel,
    topK: cfg.topK
  });

  // Step 1: Generate hypothetical document
  const hypotheticalDocument = await generateHypotheticalDocument(
    trimmedQuestion,
    cfg.targetDocumentLength,
    chatClient,
    cfg.hydeModel
  );
  logger.info("Generated hypothetical document", {
    query: trimmedQuestion,
    documentLength: hypotheticalDocument.length,
    targetLength: cfg.targetDocumentLength
  });

  // Step 2: Embed the hypothetical document (not the original query)
  logger.info("Embedding hypothetical document", {
    embeddingModel: cfg.embeddingModel
  });
  const [hypotheticalEmbedding] = await embeddingClient.embed([hypotheticalDocument]);
  logger.info("Generated embedding for hypothetical document", {
    dimension: hypotheticalEmbedding.length
  });

  // Step 3: Retrieve chunks using hypothetical document embedding
  const retrieved = store.search(hypotheticalEmbedding, cfg.topK);
  logger.info("Retrieved chunks using HyDE", {
    count: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3)),
    sources: retrieved.map((c) => c.metadata?.title ?? c.documentId)
  });

  // Step 4: Build prompt and generate answer
  const prompt = buildPrompt(trimmedQuestion, retrieved);
  logger.info("Built prompt", {
    promptLength: prompt.length,
    contextChunks: retrieved.length
  });

  logger.info("Generating answer", { chatModel: cfg.chatModel });
  const answer = await chatClient.chat(
    [
      {
        role: "user",
        content: prompt
      }
    ],
    cfg.chatModel
  );
  logger.info("Generated answer", {
    answerLength: answer.length,
    topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A"
  });

  return {
    answer,
    retrieved,
    prompt,
    hypotheticalDocument
  };
}

/**
 * Interactive query interface for the HyDE RAG system.
 *
 * Provides a command-line interface for asking questions using HyDE.
 * Users can see how hypothetical document generation improves retrieval.
 *
 * @throws Error if the index file doesn't exist, configuration is invalid,
 *         or API calls fail
 *
 * @example
 * ```bash
 * # Run from projects/hyde directory
 * pnpm run query
 * # Then type questions interactively
 * > What is climate change?
 * ```
 */
async function interactiveQuery(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/hyde.config.json");
  const cfg = loadHyDEConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("HyDE RAG query CLI ready. Type 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;

    const result = await answerQuestionWithHyDE(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", result.answer, "\n");
    // eslint-disable-next-line no-console
    console.log("Hypothetical document (first 200 chars):\n", result.hypotheticalDocument.slice(0, 200) + "...", "\n");

    logger.info("Query summary", {
      question,
      chunksRetrieved: result.retrieved.length,
      topScore: result.retrieved.length > 0 ? result.retrieved[0].score.toFixed(3) : "N/A",
      answerGenerated: result.answer.length > 0,
      hypotheticalDocLength: result.hypotheticalDocument.length
    });
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Query CLI failed", { err });
    process.exitCode = 1;
  });
}


