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
import { PropositionConfig, loadPropositionConfig } from "./ingest";

type VectorSearcher = Pick<VectorStore, "search">;

export interface PropositionQueryDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

export interface PropositionAnswer {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
}

/**
 * Formats a retrieved proposition chunk for display in the LLM prompt.
 *
 * Proposition chunks contain metadata linking them back to source chunks.
 * This function formats the proposition with its score and source excerpt to
 * help the LLM understand the context and confidence level.
 *
 * @param chunk - A retrieved proposition chunk with metadata
 * @returns Formatted string showing proposition, score, excerpt, and source
 *
 * @example
 * ```typescript
 * const formatted = formatPropositionChunk(retrievedChunk);
 * // Returns: "Proposition: Revenue was $1M\nScore: 0.90\nExcerpt: ...\nSource Chunk: doc-0-chunk-5"
 * ```
 */
export function formatPropositionChunk(chunk: RetrievedChunk): string {
  const metadata = chunk.metadata ?? {};
  const excerpt = metadata.excerpt ? `Excerpt: ${metadata.excerpt}` : "";
  const score = metadata.score !== undefined ? `Score: ${Number(metadata.score).toFixed(2)}` : "";
  return [
    `Proposition: ${chunk.content}`,
    score,
    excerpt,
    `Source Chunk: ${metadata.sourceChunkId ?? chunk.documentId}`
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Constructs a prompt for the LLM using retrieved proposition chunks.
 *
 * This function builds a prompt that emphasizes the factual, proposition-based
 * nature of the context. It instructs the LLM to only answer if the propositions
 * contain the necessary facts, preventing hallucination.
 *
 * @param question - The user's question
 * @param chunks - Retrieved proposition chunks with scores and metadata
 * @returns A formatted prompt string ready for the LLM
 */
export function buildPropositionPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context =
    chunks.length === 0
      ? "No propositions matched the question. Respond with \"I don't know.\""
      : chunks.map((chunk, idx) => `#${idx + 1}\n${formatPropositionChunk(chunk)}`).join("\n\n");
  return [
    "You answer questions using factual propositions extracted from the documents.",
    "Only answer if the context contains the necessary facts; otherwise say you don't know.",
    "",
    "Context:",
    context,
    "",
    `Question: ${question}`,
    "Answer:"
  ].join("\n");
}

/**
 * Answers a question using proposition-based RAG retrieval and generation.
 *
 * This function implements the complete proposition RAG query pipeline:
 *
 * 1. **Embed Query**: Converts question to vector embedding
 * 2. **Retrieve Propositions**: Searches for top-K most similar propositions
 * 3. **Build Prompt**: Formats propositions with scores and source excerpts
 * 4. **Generate Answer**: Sends prompt to LLM for factually-grounded answer
 *
 * **How proposition RAG differs**: Instead of retrieving full text chunks,
 * this retrieves focused propositions (factual statements). This provides:
 * - **Higher precision**: Propositions match queries more accurately
 * - **Better traceability**: Each proposition links back to its source chunk
 * - **Reduced noise**: No irrelevant context from chunk boundaries
 *
 * @param question - The user's question (will be trimmed)
 * @param cfg - Proposition configuration (models, topK, indexPath)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing answer, retrieved propositions, and prompt
 * @throws Error if question is empty, index missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerPropositionQuestion("What was the revenue?", config);
 * // result.answer: LLM answer based on retrieved propositions
 * // result.retrieved: Array of proposition chunks with scores
 * ```
 */
export async function answerPropositionQuestion(
  question: string,
  cfg: PropositionConfig,
  deps: PropositionQueryDependencies = {}
): Promise<PropositionAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  logger.info("Processing proposition query", { question: trimmed, topK: cfg.topK });
  const [queryEmbedding] = await embeddingClient.embed([trimmed]);
  logger.info("Generated query embedding", { dimension: queryEmbedding.length });

  const retrieved = store.search(queryEmbedding, cfg.topK);
  logger.info("Retrieved propositions", {
    count: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3)),
    propositionScores: retrieved.map((c) => {
      const propScore = c.metadata?.score;
      return propScore !== undefined ? Number(propScore).toFixed(2) : "N/A";
    })
  });

  const prompt = buildPropositionPrompt(trimmed, retrieved);
  logger.info("Built prompt", {
    promptLength: prompt.length,
    propositionsInContext: retrieved.length
  });

  logger.info("Generating answer", { chatModel: cfg.chatModel });
  const answer = await chatClient.chat([{ role: "user", content: prompt }], cfg.chatModel);
  logger.info("Generated answer", {
    answerLength: answer.length,
    propositionsUsed: retrieved.length,
    topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A"
  });

  return { answer, retrieved, prompt };
}

async function interactiveQuery(): Promise<void> {
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/proposition-chunking.config.json");
  const cfg = loadPropositionConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (promptText: string) => new Promise<string>((resolve) => rl.question(promptText, resolve));
  logger.info("Proposition RAG CLI ready. Type 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;
    const { answer, retrieved } = await answerPropositionQuestion(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });
    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
    logger.info("Query summary", {
      question,
      propositionsRetrieved: retrieved.length,
      topScore: retrieved.length > 0 ? retrieved[0].score.toFixed(3) : "N/A",
      averagePropositionScore:
        retrieved.length > 0
          ? (
              retrieved.reduce((sum, c) => {
                const score = c.metadata?.score;
                return sum + (score !== undefined ? Number(score) : 0);
              }, 0) / retrieved.length
            ).toFixed(2)
          : "N/A",
      answerGenerated: answer.length > 0
    });
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Proposition query CLI failed", { err });
    process.exitCode = 1;
  });
}

