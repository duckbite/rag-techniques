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
import {
  rewriteQuery,
  generateStepBackQuery,
  decomposeQuery,
  QueryTransformConfig
} from "./queryTransform";

/**
 * Extended configuration for query-transform RAG system.
 *
 * Includes standard RAG configuration plus query transformation settings:
 * - `transformationType`: Which transformation(s) to apply
 * - `transformationModel`: LLM model for transformations
 * - `maxSubQueries`: Maximum sub-queries for decomposition
 */
export interface QueryTransformRagConfig extends RagConfig, QueryTransformConfig {}

/**
 * Loads and validates a query-transform configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated QueryTransformRagConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadQueryTransformConfig(
  configPath: string
): QueryTransformRagConfig {
  const data = loadJsonConfig(configPath) as Partial<QueryTransformRagConfig>;
  const requiredKeys: (keyof QueryTransformRagConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath",
    "transformationType",
    "transformationModel",
    "maxSubQueries"
  ];
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing config key: ${key.toString()}`);
    }
  }
  return data as QueryTransformRagConfig;
}

type VectorSearcher = Pick<VectorStore, "search">;

export interface QueryTransformDependencies {
  embeddingClient?: EmbeddingClient;
  chatClient?: ChatClient;
  vectorStore?: VectorSearcher;
}

/**
 * Result of answering a question with query transformations.
 *
 * Includes the answer, retrieved chunks, and transformation metadata:
 * - `transformedQuery`: The transformed query used for retrieval (or original if no transformation)
 * - `subQueries`: Array of sub-queries if decomposition was used
 * - `transformationType`: Which transformation was applied
 */
export interface TransformAnswerResult {
  answer: string;
  retrieved: RetrievedChunk[];
  prompt: string;
  transformedQuery?: string;
  subQueries?: string[];
  transformationType: string;
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
 * @param question - The user's question (original or transformed)
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
 * Merges and deduplicates retrieved chunks from multiple queries.
 *
 * When using sub-query decomposition, multiple queries are executed and their
 * results need to be merged. This function:
 * 1. Combines chunks from all queries
 * 2. Deduplicates by chunk ID
 * 3. Sorts by similarity score (highest first)
 * 4. Returns top-K chunks
 *
 * @param allChunks - Array of chunk arrays from multiple queries
 * @param topK - Maximum number of chunks to return
 * @returns Deduplicated and sorted array of top-K chunks
 */
export function mergeRetrievedChunks(
  allChunks: RetrievedChunk[][],
  topK: number
): RetrievedChunk[] {
  const chunkMap = new Map<string, RetrievedChunk>();

  // Collect all chunks, keeping the highest score for duplicates
  for (const chunks of allChunks) {
    for (const chunk of chunks) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  // Sort by score and return top-K
  return Array.from(chunkMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Answers a question using query transformations to improve retrieval.
 *
 * This function implements the complete query-transform RAG pipeline:
 *
 * 1. **Transform Query**: Applies selected transformation(s) to the user query
 *    - Rewrite: Makes query more specific and detailed
 *    - Step-back: Generates broader, more general query
 *    - Decompose: Breaks complex query into simpler sub-queries
 *    - All: Applies all transformations and merges results
 *
 * 2. **Retrieve**: For each transformed query (or sub-query), retrieves top-K chunks
 *
 * 3. **Merge Results**: If decomposition was used, merges and deduplicates chunks
 *
 * 4. **Generate Answer**: Uses retrieved context to generate final answer
 *
 * **Transformation strategies**:
 * - **Rewrite/Step-back**: Uses transformed query directly for retrieval
 * - **Decompose**: Retrieves for each sub-query, then merges results
 * - **All**: Applies all transformations, retrieves for each, merges all results
 *
 * @param question - The original user question
 * @param cfg - Query-transform configuration (RAG settings + transformation settings)
 * @param deps - Optional dependency overrides for testing
 * @returns Object containing answer, retrieved chunks, and transformation metadata
 * @throws Error if question is empty, index missing, or API calls fail
 *
 * @example
 * ```typescript
 * const result = await answerQuestionWithTransform(
 *   "What is climate change?",
 *   config
 * );
 * // result.transformedQuery: "What are the causes, effects, and scientific evidence of climate change?"
 * // result.answer: Generated answer based on transformed query retrieval
 * ```
 */
export async function answerQuestionWithTransform(
  question: string,
  cfg: QueryTransformRagConfig,
  deps: QueryTransformDependencies = {}
): Promise<TransformAnswerResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const embeddingClient =
    deps.embeddingClient ?? new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = deps.chatClient ?? new OpenAIChatClient();
  const store = deps.vectorStore ?? loadInMemoryVectorStore(cfg.indexPath);

  logger.info("Processing query with transformation", {
    question: trimmedQuestion,
    transformationType: cfg.transformationType,
    topK: cfg.topK
  });

  let transformedQuery: string | undefined;
  let subQueries: string[] | undefined;
  let allRetrieved: RetrievedChunk[][] = [];

  // Apply transformations based on configuration
  if (cfg.transformationType === "rewrite" || cfg.transformationType === "all") {
    transformedQuery = await rewriteQuery(
      trimmedQuestion,
      chatClient,
      cfg.transformationModel
    );
    logger.info("Query rewritten", {
      original: trimmedQuestion,
      rewritten: transformedQuery
    });

    const [queryEmbedding] = await embeddingClient.embed([transformedQuery]);
    const retrieved = store.search(queryEmbedding, cfg.topK);
    allRetrieved.push(retrieved);
    logger.info("Retrieved chunks for rewritten query", {
      count: retrieved.length,
      scores: retrieved.map((c) => c.score.toFixed(3))
    });
  }

  if (cfg.transformationType === "stepback" || cfg.transformationType === "all") {
    const stepBackQuery = await generateStepBackQuery(
      trimmedQuestion,
      chatClient,
      cfg.transformationModel
    );
    logger.info("Step-back query generated", {
      original: trimmedQuestion,
      stepBack: stepBackQuery
    });

    const [queryEmbedding] = await embeddingClient.embed([stepBackQuery]);
    const retrieved = store.search(queryEmbedding, cfg.topK);
    allRetrieved.push(retrieved);
    logger.info("Retrieved chunks for step-back query", {
      count: retrieved.length,
      scores: retrieved.map((c) => c.score.toFixed(3))
    });
  }

  if (cfg.transformationType === "decompose" || cfg.transformationType === "all") {
    subQueries = await decomposeQuery(
      trimmedQuestion,
      chatClient,
      cfg.transformationModel,
      cfg.maxSubQueries
    );
    logger.info("Query decomposed", {
      original: trimmedQuestion,
      subQueries,
      count: subQueries.length
    });

    // Retrieve for each sub-query
    for (const subQuery of subQueries) {
      const [queryEmbedding] = await embeddingClient.embed([subQuery]);
      const retrieved = store.search(queryEmbedding, cfg.topK);
      allRetrieved.push(retrieved);
      logger.info("Retrieved chunks for sub-query", {
        subQuery,
        count: retrieved.length,
        scores: retrieved.map((c) => c.score.toFixed(3))
      });
    }
  }

  // If no transformation was applied, use original query
  if (allRetrieved.length === 0) {
    logger.info("No transformation applied, using original query");
    const [queryEmbedding] = await embeddingClient.embed([trimmedQuestion]);
    const retrieved = store.search(queryEmbedding, cfg.topK);
    allRetrieved.push(retrieved);
  }

  // Merge results if multiple queries were used
  const retrieved =
    allRetrieved.length > 1
      ? mergeRetrievedChunks(allRetrieved, cfg.topK)
      : allRetrieved[0] ?? [];

  logger.info("Final retrieval results", {
    totalChunks: retrieved.length,
    scores: retrieved.map((c) => c.score.toFixed(3)),
    sources: retrieved.map((c) => c.metadata?.title ?? c.documentId)
  });

  // Use transformed query for prompt if available, otherwise use original
  const queryForPrompt =
    transformedQuery ?? (subQueries && subQueries.length > 0 ? trimmedQuestion : trimmedQuestion);

  const prompt = buildPrompt(queryForPrompt, retrieved);
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
    transformedQuery,
    subQueries,
    transformationType: cfg.transformationType
  };
}

/**
 * Valid transformation types for query transformation.
 */
type TransformationType = "rewrite" | "stepback" | "decompose" | "all";

/**
 * Prompts the user to select a transformation type.
 *
 * @param ask - Function to prompt for user input
 * @param defaultValue - Default transformation type from configuration
 * @returns The selected transformation type
 */
async function promptTransformationType(
  ask: (q: string) => Promise<string>,
  defaultValue: TransformationType
): Promise<TransformationType> {
  const validTypes: TransformationType[] = ["rewrite", "stepback", "decompose", "all"];
  const typeDescriptions: Record<TransformationType, string> = {
    rewrite: "Query rewriting (makes queries more specific)",
    stepback: "Step-back prompting (generates broader queries)",
    decompose: "Sub-query decomposition (breaks complex queries into simpler ones)",
    all: "All transformations (combines all strategies)"
  };

  // eslint-disable-next-line no-console
  console.log("\nAvailable transformation types:");
  validTypes.forEach((type, idx) => {
    // eslint-disable-next-line no-console
    console.log(`  ${idx + 1}. ${type} - ${typeDescriptions[type]}`);
  });

  while (true) {
    const input = (
      await ask(`\nSelect transformation type [${defaultValue}]: `)
    ).trim();
    
    if (!input) {
      return defaultValue;
    }

    // Check if input is a number (1-4)
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= validTypes.length) {
      return validTypes[num - 1];
    }

    // Check if input is a valid type name
    const lowerInput = input.toLowerCase();
    if (validTypes.includes(lowerInput as TransformationType)) {
      return lowerInput as TransformationType;
    }

    // eslint-disable-next-line no-console
    console.log(`Invalid selection. Please enter 1-${validTypes.length} or a type name (${validTypes.join(", ")}).`);
  }
}

/**
 * Interactive query interface for the query-transform RAG system.
 *
 * Provides a command-line interface for asking questions with query transformations.
 * Users can ask questions and see how transformations improve retrieval quality.
 * 
 * **Commands**:
 * - `tt` - Change transformation type
 * - `exit` - Quit the CLI
 *
 * @throws Error if the index file doesn't exist, configuration is invalid,
 *         or API calls fail
 *
 * @example
 * ```bash
 * # Run from projects/query-transform directory
 * pnpm run query
 * # Then type questions interactively
 * > What is climate change?
 * # Type 'tt' to change transformation type
 * > tt
 * ```
 */
async function interactiveQuery(): Promise<void> {
  loadEnv();

  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/query-transform.config.json");
  const cfg = loadQueryTransformConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("Query-transform RAG query CLI ready. Type 'exit' to quit, 'tt' to change transformation type.");

  // Prompt for initial transformation type
  let currentTransformationType = await promptTransformationType(
    ask,
    cfg.transformationType as TransformationType
  );
  logger.info("Transformation type selected", { type: currentTransformationType });
  // eslint-disable-next-line no-console
  console.log(`\nCurrent transformation type: ${currentTransformationType}`);
  // eslint-disable-next-line no-console
  console.log("Type 'tt' to change transformation type, 'exit' to quit.\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = (await ask("> ")).trim();
    
    if (!input || input.toLowerCase() === "exit") break;
    
    // Handle transformation type change command
    if (input.toLowerCase() === "tt") {
      currentTransformationType = await promptTransformationType(
        ask,
        currentTransformationType
      );
      logger.info("Transformation type changed", { type: currentTransformationType });
      // eslint-disable-next-line no-console
      console.log(`\nTransformation type set to: ${currentTransformationType}\n`);
      continue;
    }

    // Create a modified config with the current transformation type
    const currentConfig: QueryTransformRagConfig = {
      ...cfg,
      transformationType: currentTransformationType
    };

    const result = await answerQuestionWithTransform(input, currentConfig, {
      embeddingClient,
      chatClient,
      vectorStore: store
    });

    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", result.answer, "\n");

    if (result.transformedQuery) {
      // eslint-disable-next-line no-console
      console.log("Transformed query:", result.transformedQuery, "\n");
    }

    if (result.subQueries && result.subQueries.length > 0) {
      // eslint-disable-next-line no-console
      console.log("Sub-queries:");
      result.subQueries.forEach((sq, idx) => {
        // eslint-disable-next-line no-console
        console.log(`  ${idx + 1}. ${sq}`);
      });
      // eslint-disable-next-line no-console
      console.log();
    }

    logger.info("Query summary", {
      question: input,
      transformationType: result.transformationType,
      chunksRetrieved: result.retrieved.length,
      topScore: result.retrieved.length > 0 ? result.retrieved[0].score.toFixed(3) : "N/A",
      answerGenerated: result.answer.length > 0,
      subQueriesCount: result.subQueries?.length ?? 0
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

