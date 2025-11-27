import readline from "node:readline";
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
import {
  loadInMemoryVectorStore,
  VectorStore
} from "../../../shared/typescript/utils/vectorStore";
import { RagConfig, RetrievedChunk } from "../../../shared/typescript/utils/types";

/**
 * Interactive query interface for the basic RAG system.
 *
 * This function provides a command-line interface for asking questions
 * against the ingested document index. It implements the complete RAG
 * retrieval and generation pipeline:
 *
 * 1. **Load Index**: Loads the pre-built vector index from disk
 * 2. **Embed Query**: Converts the user's question into a vector embedding
 * 3. **Retrieve**: Finds the top-K most similar document chunks using cosine similarity
 * 4. **Construct Prompt**: Builds a prompt that includes the retrieved context and question
 * 5. **Generate Answer**: Sends the prompt to an LLM to generate a contextually-grounded answer
 * 6. **Display Results**: Shows the answer along with similarity scores for transparency
 *
 * The retrieval process uses cosine similarity between the query embedding and
 * stored chunk embeddings. Higher scores indicate more relevant chunks.
 *
 * The LLM is instructed to only answer based on the provided context, ensuring
 * answers are grounded in the ingested documents rather than general knowledge.
 *
 * @throws Error if the index file doesn't exist, configuration is invalid,
 *         or API calls fail
 *
 * @example
 * ```bash
 * # Run from projects/basic-rag directory
 * pnpm run query
 * # Then type questions interactively
 * > What is the main topic?
 * ```
 */
type VectorSearcher = Pick<VectorStore, "search">;

export interface QueryDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

export interface AnswerResult {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
}

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

export async function answerQuestion(
  question: string,
  cfg: RagConfig,
  deps: QueryDependencies = {}
): Promise<AnswerResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  const [queryEmbedding] = await embeddingClient.embed([trimmedQuestion]);
  const retrieved = store.search(queryEmbedding, cfg.topK);
  const prompt = buildPrompt(trimmedQuestion, retrieved);
  const answer = await chatClient.chat(
    [
      {
        role: "user",
        content: prompt
      }
    ],
    cfg.chatModel
  );

  return { answer, retrieved, prompt };
}

async function interactiveQuery(): Promise<void> {
  // Load environment variables (including OpenAI API key)
  loadEnv();

  // Load configuration to get paths and model settings
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/basic-rag.config.json");
  const cfg = loadRagConfig(configPath);

  // Load the vector index that was created during ingestion
  // This contains all document chunks with their embeddings
  const store = loadInMemoryVectorStore(cfg.indexPath);

  // Initialize clients for embedding queries and generating answers
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  // Set up readline interface for interactive input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Helper function to prompt user and wait for input
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("Basic RAG query CLI ready. Type 'exit' to quit.");

  // Main interactive loop: keep asking questions until user types 'exit'
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get user's question
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;

    const { answer } = await answerQuestion(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // Display the answer to the user
    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
  }

  // Clean up: close the readline interface
  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Query CLI failed", { err });
    process.exitCode = 1;
  });
}


