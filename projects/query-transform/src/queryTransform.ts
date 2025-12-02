import { ChatClient, ChatMessage } from "../../../shared/typescript/utils/llm";
import { logger } from "../../../shared/typescript/utils/logging";

/**
 * Configuration for query transformation operations.
 *
 * Controls how queries are transformed before retrieval:
 * - `transformationType`: Which transformation(s) to apply
 * - `transformationModel`: LLM model to use for transformations
 * - `maxSubQueries`: Maximum number of sub-queries for decomposition
 */
export interface QueryTransformConfig {
  transformationType: "rewrite" | "stepback" | "decompose" | "all";
  transformationModel: string;
  maxSubQueries: number;
}

/**
 * Rewrites a query to be more specific and detailed for improved retrieval.
 *
 * Query rewriting reformulates the original query to be more specific, detailed,
 * and likely to retrieve relevant information. This technique addresses the
 * problem of vague or ambiguous queries by expanding them with additional
 * context and specificity.
 *
 * **How it works**:
 * 1. Takes the original user query
 * 2. Uses an LLM to reformulate it with more detail and specificity
 * 3. Returns the rewritten query for use in retrieval
 *
 * **When to use**: Best for queries that are too vague or need more context
 * to match relevant documents. For example, "climate change" becomes
 * "What are the specific impacts of climate change on global temperature,
 * biodiversity, and weather patterns?"
 *
 * @param question - The original user query to rewrite
 * @param chatClient - Chat client for LLM interaction
 * @param model - The LLM model to use for rewriting
 * @returns Promise resolving to the rewritten, more specific query
 * @throws Error if LLM call fails
 *
 * @example
 * ```typescript
 * const rewritten = await rewriteQuery(
 *   "What is climate change?",
 *   chatClient,
 *   "gpt-4o-mini"
 * );
 * // Returns: "What are the causes, effects, and scientific evidence of climate change?"
 * ```
 */
export async function rewriteQuery(
  question: string,
  chatClient: ChatClient,
  model: string
): Promise<string> {
  const prompt: ChatMessage[] = [
    {
      role: "user",
      content: `You are an AI assistant tasked with reformulating user queries to improve retrieval in a RAG system. Given the original query, rewrite it to be more specific, detailed, and likely to retrieve relevant information.

Original query: ${question}

Rewritten query:`
    }
  ];

  logger.debug("Rewriting query", { originalQuery: question, model });
  const rewritten = await chatClient.chat(prompt, model);
  logger.debug("Query rewritten", {
    originalQuery: question,
    rewrittenQuery: rewritten.trim()
  });

  return rewritten.trim();
}

/**
 * Generates a broader, more general "step-back" query for context retrieval.
 *
 * Step-back prompting generates a more general query that provides broader
 * context or background information. This technique is useful when the original
 * query is too specific and might miss relevant background information.
 *
 * **How it works**:
 * 1. Takes a specific user query
 * 2. Uses an LLM to generate a more general question that provides broader context
 * 3. Returns the step-back query for retrieval
 *
 * **When to use**: Best for specific queries that might benefit from broader
 * context. For example, "What is the revenue for Q3 2023?" becomes
 * "What are the financial performance trends and quarterly revenue patterns?"
 *
 * @param question - The specific user query
 * @param chatClient - Chat client for LLM interaction
 * @param model - The LLM model to use for step-back generation
 * @returns Promise resolving to a broader, more general query
 * @throws Error if LLM call fails
 *
 * @example
 * ```typescript
 * const stepBack = await generateStepBackQuery(
 *   "What is the revenue for Q3 2023?",
 *   chatClient,
 *   "gpt-4o-mini"
 * );
 * // Returns: "What are the financial performance trends and quarterly revenue patterns?"
 * ```
 */
export async function generateStepBackQuery(
  question: string,
  chatClient: ChatClient,
  model: string
): Promise<string> {
  const prompt: ChatMessage[] = [
    {
      role: "user",
      content: `You are an AI assistant. Given a specific question, generate a more general "step-back" question that provides broader context or background information.

Original question: ${question}

Step-back question:`
    }
  ];

  logger.debug("Generating step-back query", { originalQuery: question, model });
  const stepBack = await chatClient.chat(prompt, model);
  logger.debug("Step-back query generated", {
    originalQuery: question,
    stepBackQuery: stepBack.trim()
  });

  return stepBack.trim();
}

/**
 * Decomposes a complex query into simpler sub-queries for comprehensive retrieval.
 *
 * Sub-query decomposition breaks down complex queries into 2-4 simpler sub-queries
 * that, when answered together, provide a comprehensive response. This technique
 * addresses queries that cover multiple topics or require information from different
 * aspects of the document corpus.
 *
 * **How it works**:
 * 1. Takes a complex user query
 * 2. Uses an LLM to break it into 2-4 simpler sub-queries
 * 3. Parses the response to extract individual sub-queries
 * 4. Returns an array of cleaned sub-query strings
 *
 * **Parsing strategy**: The function handles various response formats:
 * - Numbered lists (1. Question, 2. Question)
 * - Bulleted lists (- Question, * Question)
 * - Plain newline-separated questions
 *
 * **When to use**: Best for complex, multi-faceted queries. For example,
 * "What are the impacts of climate change on the environment?" becomes:
 * - "What are the impacts of climate change on biodiversity?"
 * - "How does climate change affect the oceans?"
 * - "What are the effects of climate change on agriculture?"
 * - "What are the impacts of climate change on human health?"
 *
 * @param question - The complex query to decompose
 * @param chatClient - Chat client for LLM interaction
 * @param model - The LLM model to use for decomposition
 * @param maxQueries - Maximum number of sub-queries to generate (default: 4)
 * @returns Promise resolving to an array of simpler sub-queries
 * @throws Error if LLM call fails or parsing fails
 *
 * @example
 * ```typescript
 * const subQueries = await decomposeQuery(
 *   "What are the impacts of climate change on the environment?",
 *   chatClient,
 *   "gpt-4o-mini",
 *   4
 * );
 * // Returns: [
 * //   "What are the impacts of climate change on biodiversity?",
 * //   "How does climate change affect the oceans?",
 * //   ...
 * // ]
 * ```
 */
export async function decomposeQuery(
  question: string,
  chatClient: ChatClient,
  model: string,
  maxQueries: number = 4
): Promise<string[]> {
  const prompt: ChatMessage[] = [
    {
      role: "user",
      content: `You are an AI assistant tasked with breaking down complex queries into simpler sub-queries for a RAG system.
Given the original query, decompose it into 2-${maxQueries} simpler sub-queries that, when answered together, would provide a comprehensive response to the original query.

Original query: ${question}

Example: What are the impacts of climate change on the environment?

Sub-queries:
1. What are the impacts of climate change on biodiversity?
2. How does climate change affect the oceans?
3. What are the effects of climate change on agriculture?
4. What are the impacts of climate change on human health?

Now decompose the original query into sub-queries:`
    }
  ];

  logger.debug("Decomposing query", {
    originalQuery: question,
    model,
    maxQueries
  });
  const response = await chatClient.chat(prompt, model);
  logger.debug("Query decomposed", {
    originalQuery: question,
    responseLength: response.length
  });

  // Parse the response to extract sub-queries
  // Handle various formats: numbered lists, bulleted lists, plain newlines
  const lines = response
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const subQueries: string[] = [];
  for (const line of lines) {
    // Remove common prefixes: numbers, bullets, dashes, etc.
    const cleaned = line
      .replace(/^\d+\.\s*/, "") // Remove "1. " prefix
      .replace(/^[-*•]\s*/, "") // Remove "- ", "* ", "• " prefix
      .replace(/^[a-zA-Z]\)\s*/, "") // Remove "a) " prefix
      .replace(/^\([a-zA-Z0-9]+\)\s*/, "") // Remove "(1) " prefix
      .trim();

    // Skip lines that are just labels or headers
    if (
      cleaned.length > 10 &&
      !cleaned.toLowerCase().startsWith("sub-queries") &&
      !cleaned.toLowerCase().startsWith("questions:")
    ) {
      subQueries.push(cleaned);
    }
  }

  // Limit to maxQueries
  const result = subQueries.slice(0, maxQueries);
  logger.debug("Parsed sub-queries", {
    count: result.length,
    subQueries: result
  });

  if (result.length === 0) {
    logger.warn("No sub-queries parsed from response, using original query", {
      response
    });
    return [question];
  }

  return result;
}


