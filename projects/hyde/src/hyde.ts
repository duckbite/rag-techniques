import { ChatClient, ChatMessage } from "../../../shared/typescript/utils/llm";
import { logger } from "../../../shared/typescript/utils/logging";

/**
 * Generates a hypothetical document that answers the given query.
 *
 * Hypothetical Document Embedding (HyDE) is a technique that bridges the semantic
 * gap between short queries and longer documents. Instead of embedding the query
 * directly, HyDE generates a synthetic document that answers the query, then uses
 * that document's embedding for retrieval.
 *
 * **Why HyDE?** Traditional retrieval embeds queries (short, question-like) and
 * documents (long, detailed). These embeddings exist in different semantic spaces,
 * making it harder to find matches. By generating a hypothetical document that
 * answers the query, we move the query embedding closer to the document embedding
 * space, improving retrieval relevance.
 *
 * **How it works**:
 * 1. Takes the user's query
 * 2. Uses an LLM to generate a detailed hypothetical document that answers the query
 * 3. The generated document is similar in style and length to actual document chunks
 * 4. Returns the hypothetical document text for embedding and retrieval
 *
 * **Example**:
 * - Query: "What is climate change?"
 * - Hypothetical Document: "Climate change refers to long-term shifts in global
 *   temperatures and weather patterns. It is primarily caused by human activities
 *   that increase greenhouse gas concentrations in the atmosphere, such as burning
 *   fossil fuels and deforestation. The effects include rising sea levels, more
 *   frequent extreme weather events, and changes in precipitation patterns..."
 *
 * @param query - The user's question
 * @param chunkSize - Target length for the hypothetical document (in characters)
 * @param chatClient - Chat client for LLM interaction
 * @param model - The LLM model to use for document generation
 * @returns Promise resolving to the generated hypothetical document text
 * @throws Error if LLM call fails
 *
 * @example
 * ```typescript
 * const hypotheticalDoc = await generateHypotheticalDocument(
 *   "What is climate change?",
 *   800,
 *   chatClient,
 *   "gpt-4o-mini"
 * );
 * // Returns: "Climate change refers to long-term shifts..."
 * ```
 */
export async function generateHypotheticalDocument(
  query: string,
  chunkSize: number,
  chatClient: ChatClient,
  model: string
): Promise<string> {
  const prompt: ChatMessage[] = [
    {
      role: "user",
      content: `Given the question '${query}', generate a hypothetical document that directly answers this question. The document should be detailed and in-depth. The document size should be approximately ${chunkSize} characters.

Hypothetical document:`
    }
  ];

  logger.debug("Generating hypothetical document", {
    query,
    targetLength: chunkSize,
    model
  });
  const hypotheticalDoc = await chatClient.chat(prompt, model);
  const trimmed = hypotheticalDoc.trim();

  logger.debug("Hypothetical document generated", {
    query,
    generatedLength: trimmed.length,
    targetLength: chunkSize
  });

  return trimmed;
}


