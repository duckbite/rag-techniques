import readline from "node:readline";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
import { loadHyPEConfig } from "./ingest";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  ChatClient,
  EmbeddingClient,
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import { RetrievedChunk } from "../../../shared/typescript/utils/types";
import { loadHyPEVectorStore, HyPEVectorStore } from "./vectorStore";

/**
 * Result of answering a question using HyPE.
 *
 * Includes the answer, retrieved chunks, and query metadata.
 */
export interface HyPEAnswerResult {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
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
 * @param question - The user's question
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
 * Answers a question using HyPE (Hypothetical Prompt Embedding).
 *
 * This function implements the complete HyPE RAG pipeline:
 *
 * 1. **Embed Query**: Converts the user's query into a vector embedding
 *
 * 2. **Search Question Embeddings**: Searches the vector store using the query
 *    embedding. The store matches against question embeddings (not chunk embeddings),
 *    transforming retrieval into a question-question matching problem.
 *
 * 3. **Retrieve Chunks**: Returns chunks whose hypothetical questions matched
 *    the user's query. If multiple questions from the same chunk match, the chunk
 *    is deduplicated and scored by its best matching question.
 *
 * 4. **Generate Answer**: Uses retrieved context to generate the final answer.
 *
 * **Why HyPE works**: By pre-generating questions during ingestion and matching
 * user queries against question embeddings, we eliminate the query-document
 * semantic gap. Questions match questions, leading to better retrieval relevance.
 *
 * **Advantages over HyDE**:
 * - No runtime LLM calls for document generation (faster)
 * - Questions are pre-computed during ingestion (consistent)
 * - Multiple questions per chunk (better coverage)
 *
 * @param question - The user's question (will be trimmed)
 * @param cfg - HyPE configuration (RAG settings + question generation settings)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing answer, retrieved chunks, and prompt
 * @throws Error if question is empty, index missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerQuestionWithHyPE(
 *   "What is climate change?",
 *   config
 * );
 * // result.answer: Generated answer based on retrieved context
 * ```
 */
export async function answerQuestionWithHyPE(
  question: string,
  cfg: ReturnType<typeof loadHyPEConfig>,
  deps: {
    embeddingClient?: EmbeddingClient;
    chatClient?: ChatClient;
    vectorStore?: HyPEVectorStore;
  } = {}
): Promise<HyPEAnswerResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient =
    deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store =
    deps.vectorStore ?? loadHyPEVectorStore(cfg.indexPath);

  logger.info("Processing query with HyPE", {
    question: trimmedQuestion,
    topK: cfg.topK
  });

  // Step 1: Embed the user's query
  logger.info("Embedding user query", { embeddingModel: cfg.embeddingModel });
  const [queryEmbedding] = await embeddingClient.embed([trimmedQuestion]);
  logger.info("Generated query embedding", { dimension: queryEmbedding.length });

  // Step 2: Search against question embeddings (not chunk embeddings)
  logger.info("Searching against question embeddings");
  const retrieved = store.search(queryEmbedding, cfg.topK);
  logger.info("Retrieved chunks via question matching", {
    count: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3)),
    sources: retrieved.map((c) => c.metadata?.title ?? c.documentId)
  });

  // Step 3: Build prompt and generate answer
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
    prompt
  };
}

/**
 * Interactive query interface for the HyPE RAG system.
 *
 * Provides a command-line interface for asking questions using HyPE.
 * Users can see how question-question matching improves retrieval.
 *
 * @throws Error if the index file doesn't exist, configuration is invalid,
 *         or API calls fail
 *
 * @example
 * ```bash
 * # Run from projects/hype directory
 * pnpm run query
 * # Then type questions interactively
 * > What is climate change?
 * ```
 */
async function interactiveQuery(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/hype.config.json");
  const cfg = loadHyPEConfig(configPath);

  const store = loadHyPEVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("HyPE RAG query CLI ready. Type 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;

    const result = await answerQuestionWithHyPE(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", result.answer, "\n");

    logger.info("Query summary", {
      question,
      chunksRetrieved: result.retrieved.length,
      topScore: result.retrieved.length > 0 ? result.retrieved[0].score.toFixed(3) : "N/A",
      answerGenerated: result.answer.length > 0
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

