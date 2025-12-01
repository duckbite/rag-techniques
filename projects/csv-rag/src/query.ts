import readline from "node:readline";
import path from "node:path";
import { loadEnv } from "../../../shared/typescript/utils/env";
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
import { RetrievedChunk } from "../../../shared/typescript/utils/types";
import { CsvRagConfig, loadCsvRagConfig } from "./ingest";

type VectorSearcher = Pick<VectorStore, "search">;

/**
 * Dependency injection interface for CSV query pipeline.
 *
 * Allows external code to provide mock implementations for testing.
 * All fields are optional; defaults are used if not provided.
 */
export interface CsvQueryDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

export interface CsvAnswerResult {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
}

/**
 * Formats a retrieved CSV chunk for display in the LLM prompt.
 *
 * This function creates a human-readable representation of a retrieved chunk
 * that includes both the text content and associated metadata. The metadata
 * (like row index, revenue, dates) helps the LLM provide more contextual
 * and accurate answers.
 *
 * **Why include metadata?** CSV data often has rich structured information
 * (numbers, categories, dates) that isn't in the embedded text but is crucial
 * for answering questions. By including metadata in the prompt, the LLM can
 * reference specific values, compare metrics, or filter by categories.
 *
 * @param chunk - A retrieved chunk with similarity score and metadata
 * @returns Formatted string showing score, content, and metadata
 *
 * @example
 * ```typescript
 * const formatted = formatCsvChunk({
 *   content: "Company: Acme Corp",
 *   score: 0.85,
 *   metadata: { Revenue: "1000000", Year: "2023" }
 * });
 * // Returns: "Score: 0.850\nCompany: Acme Corp\nMetadata:\nRevenue: 1000000\nYear: 2023"
 * ```
 */
export function formatCsvChunk(chunk: RetrievedChunk): string {
  const metadataPairs = Object.entries(chunk.metadata ?? {}).map(([key, value]) => `${key}: ${value}`);
  const metadataBlock = metadataPairs.length > 0 ? `\nMetadata:\n${metadataPairs.join("\n")}` : "";
  return `Score: ${chunk.score.toFixed(3)}\n${chunk.content}${metadataBlock}`;
}

/**
 * Constructs a prompt for the LLM using retrieved CSV chunks.
 *
 * This function builds a structured prompt that instructs the LLM to answer
 * questions based only on the provided CSV context. It includes:
 * - Clear instructions to ground answers in the CSV data
 * - Formatted chunks with scores and metadata
 * - The user's question
 *
 * **Prompt engineering**: The prompt explicitly tells the LLM to say "I don't know"
 * if the answer isn't in the CSV. This prevents hallucination and ensures answers
 * are grounded in the ingested data.
 *
 * @param question - The user's question
 * @param chunks - Retrieved chunks with similarity scores and metadata
 * @returns A formatted prompt string ready for the LLM
 *
 * @example
 * ```typescript
 * const prompt = buildCsvPrompt("What is Acme's revenue?", retrievedChunks);
 * // Returns a multi-line prompt with context and question
 * ```
 */
export function buildCsvPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context =
    chunks.length === 0
      ? "No relevant rows were retrieved from the CSV."
      : chunks.map((chunk, idx) => `Row ${idx + 1}:\n${formatCsvChunk(chunk)}`).join("\n\n");
  return [
    "You answer questions strictly using the CSV-derived context below.",
    "If the answer is missing, reply with \"I don't know based on the CSV\".",
    "",
    "Context:",
    context,
    "",
    `Question: ${question}`,
    "Answer:"
  ].join("\n");
}

/**
 * Answers a question using CSV-based RAG retrieval and generation.
 *
 * This function implements the complete CSV RAG query pipeline:
 *
 * 1. **Embed Query**: Converts the question into a vector embedding
 * 2. **Retrieve**: Searches the vector store for top-K most similar CSV chunks
 * 3. **Build Prompt**: Formats retrieved chunks with metadata into a prompt
 * 4. **Generate Answer**: Sends prompt to LLM to generate a grounded answer
 *
 * **How CSV RAG differs from basic RAG**: The retrieved chunks come from
 * structured CSV rows, so they include both text content (for semantic search)
 * and metadata (for context). The LLM can reference specific values, compare
 * metrics, or filter by categories mentioned in the metadata.
 *
 * **Retrieval process**: Uses cosine similarity between the query embedding
 * and stored chunk embeddings. Higher scores indicate more relevant chunks.
 * The `topK` parameter controls how many chunks are retrieved (typically 3-5
 * for CSV data to avoid overwhelming the context window).
 *
 * @param question - The user's question (will be trimmed)
 * @param cfg - CSV RAG configuration (models, topK, indexPath)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing the answer, retrieved chunks, and prompt used
 * @throws Error if question is empty, index file missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerCsvQuestion("What companies have revenue > 1M?", config);
 * // result.answer: LLM-generated answer
 * // result.retrieved: Array of chunks with scores
 * // result.prompt: The full prompt sent to the LLM
 * ```
 */
export async function answerCsvQuestion(
  question: string,
  cfg: CsvRagConfig,
  deps: CsvQueryDependencies = {}
): Promise<CsvAnswerResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  logger.info("Processing CSV query", { question: trimmed, topK: cfg.topK });
  const [queryEmbedding] = await embeddingClient.embed([trimmed]);
  logger.info("Generated query embedding", { dimension: queryEmbedding.length });

  const retrieved = store.search(queryEmbedding, cfg.topK);
  logger.info("Retrieved CSV chunks", {
    count: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3)),
    rowIndices: retrieved.map((c) => c.metadata?.rowIndex ?? "N/A")
  });

  const prompt = buildCsvPrompt(trimmed, retrieved);
  logger.info("Built prompt", {
    promptLength: prompt.length,
    contextChunks: retrieved.length
  });

  logger.info("Generating answer", { chatModel: cfg.chatModel });
  const answer = await chatClient.chat([{ role: "user", content: prompt }], cfg.chatModel);
  logger.info("Generated answer", {
    answerLength: answer.length,
    topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A"
  });

  return { answer, retrieved, prompt };
}

async function interactiveQuery(): Promise<void> {
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/csv-rag.config.json");
  const cfg = loadCsvRagConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (promptText: string) => new Promise<string>((resolve) => rl.question(promptText, resolve));

  logger.info("CSV RAG query CLI ready. Type 'exit' to quit.");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;
    const { answer, retrieved } = await answerCsvQuestion(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });
    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
    logger.info("Query summary", {
      question,
      chunksRetrieved: retrieved.length,
      topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A",
      answerGenerated: answer.length > 0
    });
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("CSV query CLI failed", { err });
    process.exitCode = 1;
  });
}

