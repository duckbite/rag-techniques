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

/**
 * Configuration for Reliable RAG with validation and highlighting.
 *
 * Extends the base RAG configuration with reliability-focused settings:
 * - `relevanceThreshold`: Minimum similarity score (0-1) for a chunk to be considered relevant
 * - `highlightWindow`: Number of characters to extract around matched keywords for highlighting
 *
 * **Why Reliable RAG?** Basic RAG can retrieve chunks that are semantically similar
 * but not actually relevant to the question. Reliable RAG adds a validation step
 * that checks both embedding similarity AND lexical overlap (keyword matching) to
 * filter out false positives before sending context to the LLM.
 */
export interface ReliableRagConfig extends RagConfig {
  relevanceThreshold: number;
  highlightWindow: number;
}

/**
 * Loads and validates a Reliable RAG configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated ReliableRagConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadReliableConfig(configPath: string): ReliableRagConfig {
  const data = loadJsonConfig(configPath) as Partial<ReliableRagConfig>;
  const requiredKeys: (keyof ReliableRagConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "relevanceThreshold",
    "highlightWindow"
  ];
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing config key: ${key.toString()}`);
    }
  }
  return data as ReliableRagConfig;
}

type VectorSearcher = Pick<VectorStore, "search">;

export interface ReliableQueryDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

/**
 * A retrieved chunk that has been validated for relevance.
 *
 * Extends RetrievedChunk with validation metadata:
 * - `overlap`: Lexical overlap score (0-1) indicating how many question keywords appear in the chunk
 * - `excerpt`: A highlighted excerpt showing the most relevant portion of the chunk
 * - `isRelevant`: Boolean indicating whether the chunk passed validation thresholds
 */
export interface ValidatedChunk extends RetrievedChunk {
  overlap: number;
  excerpt: string;
  isRelevant: boolean;
}

/**
 * Tokenizes a question into searchable keywords.
 *
 * This function extracts meaningful tokens from a question by:
 * 1. Converting to lowercase for case-insensitive matching
 * 2. Splitting on non-alphanumeric characters
 * 3. Filtering out very short tokens (less than 4 characters) which are often stop words
 *
 * **Why tokenize?** Lexical validation compares question keywords against chunk
 * content. Short tokens like "the", "is", "a" are filtered out because they appear
 * in almost every chunk and don't help distinguish relevance.
 *
 * @param question - The user's question
 * @returns Array of meaningful keyword tokens (length >= 4)
 *
 * @example
 * ```typescript
 * const tokens = tokenizeQuestion("What is the revenue for 2023?");
 * // Returns: ["what", "revenue", "2023"]
 * ```
 */
function tokenizeQuestion(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 3);
}

/**
 * Computes a lexical overlap score between question tokens and chunk content.
 *
 * This function measures how many question keywords appear in the chunk text.
 * The score is the ratio of matched tokens to total tokens (0 = no matches, 1 = all match).
 *
 * **Why lexical overlap?** Embedding similarity can sometimes match chunks that are
 * semantically related but don't actually answer the question. For example, a question
 * about "2023 revenue" might retrieve a chunk about "2024 revenue" because they're
 * semantically similar, but they don't answer the question. Lexical overlap catches
 * these cases by requiring actual keyword matches.
 *
 * @param content - The chunk content to search
 * @param tokens - Question keywords to search for
 * @returns Overlap score between 0 (no matches) and 1 (all tokens match)
 *
 * @example
 * ```typescript
 * const score = computeOverlapScore("Revenue in 2023 was $1M", ["revenue", "2023"]);
 * // Returns: 1.0 (both tokens found)
 * ```
 */
function computeOverlapScore(content: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const lowerContent = content.toLowerCase();
  const matchCount = tokens.filter((token) => lowerContent.includes(token)).length;
  return matchCount / tokens.length;
}

/**
 * Extracts a highlighted excerpt from chunk content around matched keywords.
 *
 * This function finds the first occurrence of any question keyword in the chunk
 * and extracts a window of text around it. This creates a focused excerpt that
 * shows why the chunk is relevant, making it easier for users (and the LLM) to
 * understand the connection between the question and the retrieved content.
 *
 * **Excerpt strategy**: If a keyword is found, extracts `window/2` characters
 * before and after the match. If no keywords are found, returns the first `window`
 * characters of the chunk.
 *
 * @param content - The full chunk content
 * @param tokens - Question keywords to search for
 * @param window - Total number of characters to include in the excerpt
 * @returns A trimmed excerpt string highlighting the relevant portion
 *
 * @example
 * ```typescript
 * const excerpt = extractExcerpt("In 2023, revenue reached $1M...", ["revenue", "2023"], 50);
 * // Returns: "In 2023, revenue reached $1M"
 * ```
 */
function extractExcerpt(content: string, tokens: string[], window: number): string {
  const lower = content.toLowerCase();
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1) {
      const start = Math.max(0, idx - window / 2);
      const end = Math.min(content.length, idx + token.length + window / 2);
      return content.slice(start, end).trim();
    }
  }
  return content.slice(0, window).trim();
}

/**
 * Validates retrieved chunks using both embedding similarity and lexical overlap.
 *
 * This is the core validation function for Reliable RAG. It applies a two-stage
 * validation process:
 *
 * 1. **Embedding similarity check**: Chunk must have a similarity score >= `relevanceThreshold`
 * 2. **Lexical overlap check**: OR chunk must have lexical overlap >= 0.4 (40% of keywords match)
 *
 * A chunk is considered relevant if it passes EITHER check. This dual-criteria
 * approach catches both semantically similar content (via embeddings) and content
 * with explicit keyword matches (via lexical overlap).
 *
 * **Why both checks?** Embeddings are great for semantic understanding but can
 * miss exact matches. Lexical overlap catches exact keyword matches but misses
 * synonyms. Combining both gives the best of both worlds.
 *
 * @param question - The user's question
 * @param chunks - Retrieved chunks with similarity scores
 * @param cfg - Reliable RAG configuration (thresholds, window size)
 * @returns Array of ValidatedChunk objects with overlap scores and relevance flags
 *
 * @example
 * ```typescript
 * const validated = validateRetrievedChunks("What is 2023 revenue?", chunks, config);
 * // Returns chunks with isRelevant=true if they pass validation
 * ```
 */
export function validateRetrievedChunks(
  question: string,
  chunks: RetrievedChunk[],
  cfg: ReliableRagConfig
): ValidatedChunk[] {
  const tokens = tokenizeQuestion(question);
  return chunks.map((chunk) => {
    const overlap = computeOverlapScore(chunk.content, tokens);
    const isRelevant = chunk.score >= cfg.relevanceThreshold || overlap >= 0.4;
    const excerpt = extractExcerpt(chunk.content, tokens, cfg.highlightWindow);
    return { ...chunk, overlap, isRelevant, excerpt };
  });
}

/**
 * Constructs a prompt for the LLM using validated chunks with transparency.
 *
 * This function builds a prompt that includes validation metadata (scores, overlap,
 * relevance status) so the LLM understands which chunks are high-confidence and
 * which are low-confidence. This transparency helps the LLM:
 * - Weight high-confidence chunks more heavily
 * - Acknowledge uncertainty when only low-confidence chunks are available
 * - Provide more accurate and honest answers
 *
 * **Prompt structure**: Each chunk is labeled as "validated" or "low-confidence"
 * and includes both similarity score and lexical overlap score. The excerpt shows
 * the highlighted portion that matched the question.
 *
 * @param question - The user's question
 * @param chunks - Validated chunks with relevance metadata
 * @returns A formatted prompt string with validation transparency
 *
 * @example
 * ```typescript
 * const prompt = buildReliablePrompt("What is revenue?", validatedChunks);
 * // Includes validation scores and excerpts for each chunk
 * ```
 */
export function buildReliablePrompt(question: string, chunks: ValidatedChunk[]): string {
  const context =
    chunks.length === 0
      ? "Validation removed all retrieved chunks. Answer: \"I don't know.\""
      : chunks
          .map((chunk, idx) => {
            const status = chunk.isRelevant ? "validated" : "low-confidence";
            return [
              `Chunk ${idx + 1} (${status})`,
              `Score: ${chunk.score.toFixed(3)}, overlap=${chunk.overlap.toFixed(2)}`,
              chunk.excerpt
            ].join("\n");
          })
          .join("\n\n");
  return [
    "You answer using the validated context below.",
    "If no validated context remains, explicitly state that you do not know.",
    "",
    "Context:",
    context,
    "",
    `Question: ${question}`,
    "Answer:"
  ].join("\n");
}

export interface ReliableAnswer {
  answer: string;
  validatedChunks: ValidatedChunk[];
  prompt: string;
}

/**
 * Answers a question using Reliable RAG with validation and highlighting.
 *
 * This function implements the complete Reliable RAG pipeline:
 *
 * 1. **Embed Query**: Converts question to vector embedding
 * 2. **Retrieve**: Gets top-K chunks via similarity search
 * 3. **Validate**: Applies dual-criteria validation (similarity + lexical overlap)
 * 4. **Filter**: Keeps only validated chunks (or falls back to top chunk if none pass)
 * 5. **Build Prompt**: Creates prompt with validation metadata and excerpts
 * 6. **Generate Answer**: Sends prompt to LLM for grounded answer generation
 *
 * **Fallback behavior**: If no chunks pass validation, the system still includes
 * the top-scoring chunk (marked as low-confidence) rather than returning empty
 * context. This ensures the LLM always has some context, even if it's uncertain.
 *
 * **Why Reliable RAG?** Basic RAG can retrieve irrelevant chunks that confuse the
 * LLM or lead to hallucinated answers. Reliable RAG filters these out before
 * prompting, improving answer quality and reducing false information.
 *
 * @param question - The user's question (will be trimmed)
 * @param cfg - Reliable RAG configuration (thresholds, models, topK)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing answer, validated chunks, and prompt
 * @throws Error if question is empty, index missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerReliableQuestion("What is 2023 revenue?", config);
 * // result.validatedChunks: Only chunks that passed validation
 * // result.answer: LLM answer based on validated context
 * ```
 */
export async function answerReliableQuestion(
  question: string,
  cfg: ReliableRagConfig,
  deps: ReliableQueryDependencies = {}
): Promise<ReliableAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient = deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  logger.info("Processing reliable query", {
    question: trimmed,
    topK: cfg.topK,
    relevanceThreshold: cfg.relevanceThreshold
  });
  const [queryEmbedding] = await embeddingClient.embed([trimmed]);
  logger.info("Generated query embedding", { dimension: queryEmbedding.length });

  const retrieved = store.search(queryEmbedding, cfg.topK);
  logger.info("Retrieved candidate chunks", {
    count: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3))
  });

  const allValidated = validateRetrievedChunks(trimmed, retrieved, cfg);
  const validated = allValidated.filter((chunk) => chunk.isRelevant);
  logger.info("Validation results", {
    totalRetrieved: retrieved.length,
    validatedCount: validated.length,
    rejectedCount: retrieved.length - validated.length,
    validationDetails: allValidated.map((c) => ({
      score: c.score.toFixed(3),
      overlap: c.overlap.toFixed(2),
      isRelevant: c.isRelevant
    }))
  });

  const chunksForPrompt = validated.length > 0 ? validated : allValidated.slice(0, 1);
  if (validated.length === 0) {
    logger.warn("No chunks passed validation; using top chunk as fallback", {
      fallbackScore: chunksForPrompt[0]?.score.toFixed(3)
    });
  }

  const prompt = buildReliablePrompt(trimmed, chunksForPrompt);
  logger.info("Built prompt with validated chunks", {
    promptLength: prompt.length,
    validatedChunksInPrompt: chunksForPrompt.length
  });

  logger.info("Generating answer", { chatModel: cfg.chatModel });
  const answer = await chatClient.chat([{ role: "user", content: prompt }], cfg.chatModel);
  logger.info("Generated answer", {
    answerLength: answer.length,
    validatedChunksUsed: chunksForPrompt.length,
    topScore: chunksForPrompt.length > 0 ? chunksForPrompt[0].score.toFixed(3) : "N/A"
  });

  return { answer, validatedChunks: chunksForPrompt, prompt };
}

async function interactiveQuery(): Promise<void> {
  loadEnv();
  const configPath =
    process.env.RAG_CONFIG_PATH ?? path.resolve(__dirname, "../config/reliable-rag.config.json");
  const cfg = loadReliableConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (promptText: string) => new Promise<string>((resolve) => rl.question(promptText, resolve));

  logger.info("Reliable RAG query CLI ready. Type 'exit' to quit.");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;
    const { answer, validatedChunks } = await answerReliableQuestion(question, cfg, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });
    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
    logger.info("Query summary", {
      question,
      chunksRetrieved: validatedChunks.length,
      validatedCount: validatedChunks.filter((c) => c.isRelevant).length,
      topScore: validatedChunks.length > 0 ? validatedChunks[0].score.toFixed(3) : "N/A",
      topOverlap:
        validatedChunks.length > 0 ? validatedChunks[0].overlap.toFixed(2) : "N/A",
      answerGenerated: answer.length > 0
    });
  }

  rl.close();
}

if (require.main === module) {
  interactiveQuery().catch((err) => {
    logger.error("Reliable query CLI failed", { err });
    process.exitCode = 1;
  });
}

