import { ChatClient, ChatMessage } from "../../../shared/typescript/utils/llm";
import { logger } from "../../../shared/typescript/utils/logging";

/**
 * Generates multiple hypothetical questions for a given chunk.
 *
 * Hypothetical Prompt Embedding (HyPE) pre-generates questions that a chunk can
 * answer, then embeds those questions. At query time, the user's query is matched
 * against these question embeddings (question-question matching) rather than
 * against chunk embeddings (question-document matching).
 *
 * **Why HyPE?** Traditional RAG embeds queries (questions) and documents (answers),
 * creating a semantic mismatch. HyPE transforms retrieval into a question-question
 * matching problem by pre-generating questions that chunks answer. This improves
 * alignment because:
 * - Questions match questions (better semantic alignment)
 * - Pre-computed during ingestion (no runtime cost)
 * - Multiple questions per chunk (better coverage)
 *
 * **How it works**:
 * 1. Takes a document chunk
 * 2. Uses an LLM to generate multiple questions that the chunk answers
 * 3. Returns an array of cleaned question strings
 * 4. These questions will be embedded and stored with the chunk
 *
 * **Parsing strategy**: The function handles various response formats:
 * - Numbered lists (1. Question, 2. Question)
 * - Bulleted lists (- Question, * Question)
 * - Plain newline-separated questions
 *
 * @param chunkText - The text content of the chunk
 * @param chatClient - Chat client for LLM interaction
 * @param model - The LLM model to use for question generation
 * @returns Promise resolving to an array of question strings
 * @throws Error if LLM call fails
 *
 * @example
 * ```typescript
 * const questions = await generateHypotheticalQuestions(
 *   "Climate change is caused by greenhouse gases...",
 *   chatClient,
 *   "gpt-4o-mini"
 * );
 * // Returns: [
 * //   "What causes climate change?",
 * //   "What are greenhouse gases?",
 * //   "How do greenhouse gases affect the climate?"
 * // ]
 * ```
 */
export async function generateHypotheticalQuestions(
  chunkText: string,
  chatClient: ChatClient,
  model: string
): Promise<string[]> {
  const prompt: ChatMessage[] = [
    {
      role: "user",
      content: `Analyze the input text and generate essential questions that, when answered, capture the main points of the text. Each question should be one line, without numbering or prefixes.

Text:
${chunkText}

Questions:
`
    }
  ];

  logger.debug("Generating hypothetical questions", {
    chunkLength: chunkText.length,
    model
  });
  const response = await chatClient.chat(prompt, model);
  logger.debug("Generated hypothetical questions response", {
    responseLength: response.length
  });

  // Parse questions from response
  // Handle various formats: numbered lists, bulleted lists, plain newlines
  // Remove extra newlines (some models use \n\n for separation)
  const lines = response
    .replace(/\n\n/g, "\n") // Replace double newlines with single
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const questions: string[] = [];
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
      !cleaned.toLowerCase().startsWith("questions:") &&
      !cleaned.toLowerCase().startsWith("sub-queries:")
    ) {
      questions.push(cleaned);
    }
  }

  logger.debug("Parsed hypothetical questions", {
    count: questions.length,
    questions: questions.slice(0, 3) // Log first 3 for debugging
  });

  if (questions.length === 0) {
    logger.warn("No questions parsed from response, using fallback", {
      response: response.slice(0, 200)
    });
    // Fallback: create a simple question from the chunk
    return [`What does this text say about ${chunkText.slice(0, 50)}?`];
  }

  return questions;
}


