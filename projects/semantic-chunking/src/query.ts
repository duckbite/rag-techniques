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

  logger.info("Processing query for semantic-chunking", {
    question: trimmedQuestion,
    topK: cfg.topK
  });
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
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/semantic-chunking.config.json");
  const cfg = loadRagConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("Semantic-chunking query CLI ready. Type 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;

    const { answer, retrieved } = await answerQuestion(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
    logger.info("Query summary (semantic-chunking)", {
      question,
      chunksRetrieved: retrieved.length,
      topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A",
      answerLength: answer.length
    });
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Semantic-chunking query CLI failed", { err });
    process.exitCode = 1;
  });
}


