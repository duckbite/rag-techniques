import OpenAI from "openai";
import { logger } from "./logging";

/**
 * Interface for generating embeddings from text.
 * Embeddings are dense vector representations that capture semantic meaning,
 * enabling similarity search and semantic understanding.
 */
export interface EmbeddingClient {
  /**
   * Converts an array of text strings into embedding vectors.
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to an array of embedding vectors (one per text)
   */
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Represents a message in a chat conversation.
 * Used for constructing prompts and managing conversation context.
 */
export interface ChatMessage {
  /** The role of the message sender (system instructions, user query, or assistant response) */
  role: "system" | "user" | "assistant";
  /** The text content of the message */
  content: string;
}

/**
 * Interface for generating text completions using language models.
 * Used for answer generation in RAG systems.
 */
export interface ChatClient {
  /**
   * Generates a text completion based on a conversation history.
   * @param messages - Array of messages forming the conversation context
   * @param model - The model identifier to use for generation
   * @returns Promise resolving to the generated text response
   */
  chat(messages: ChatMessage[], model: string): Promise<string>;
}

/**
 * OpenAI implementation of the EmbeddingClient interface.
 *
 * This client wraps OpenAI's embedding API to convert text into dense vector
 * representations. Embeddings capture semantic meaning, allowing similar
 * texts to have similar vector representations.
 *
 * Common OpenAI embedding models:
 * - `text-embedding-3-small`: Cost-effective, 1536 dimensions
 * - `text-embedding-3-large`: Higher quality, 3072 dimensions
 * - `text-embedding-ada-002`: Legacy model, 1536 dimensions
 *
 * @example
 * ```typescript
 * const client = new OpenAIEmbeddingClient("text-embedding-3-small");
 * const embeddings = await client.embed(["Hello world", "Hi there"]);
 * // Returns: [[0.1, 0.2, ...], [0.15, 0.25, ...]]
 * ```
 */
export class OpenAIEmbeddingClient implements EmbeddingClient {
  private client: OpenAI;
  private model: string;

  /**
   * Creates a new OpenAI embedding client.
   * @param model - The OpenAI embedding model to use (e.g., "text-embedding-3-small")
   * @throws Error if OPENAI_API_KEY environment variable is not set
   */
  constructor(model: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generates embeddings for an array of text strings.
   *
   * This method sends a batch of texts to OpenAI's embedding API and returns
   * their vector representations. The embeddings can be used for:
   * - Semantic similarity search
   * - Clustering and classification
   * - As input to machine learning models
   *
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to an array of embedding vectors
   *          Each vector is an array of numbers representing the text's position in embedding space
   */
  async embed(texts: string[]): Promise<number[][]> {
    logger.debug("Requesting embeddings", { count: texts.length });
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });
    return response.data.map((item) => item.embedding);
  }
}

/**
 * OpenAI implementation of the ChatClient interface.
 *
 * This client wraps OpenAI's chat completion API to generate text responses
 * based on conversation context. It's used in RAG systems to generate answers
 * after retrieving relevant context from a vector store.
 *
 * Common OpenAI chat models:
 * - `gpt-4o-mini`: Fast and cost-effective, good for most RAG use cases
 * - `gpt-4o`: Higher quality reasoning, better for complex questions
 * - `gpt-3.5-turbo`: Legacy option, still functional
 *
 * @example
 * ```typescript
 * const client = new OpenAIChatClient();
 * const answer = await client.chat(
 *   [{ role: "user", content: "What is RAG?" }],
 *   "gpt-4o-mini"
 * );
 * ```
 */
export class OpenAIChatClient implements ChatClient {
  private client: OpenAI;

  /**
   * Creates a new OpenAI chat client.
   * @throws Error if OPENAI_API_KEY environment variable is not set
   */
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generates a text completion based on conversation messages.
   *
   * This method sends a conversation history to OpenAI's chat API and returns
   * the model's generated response. The conversation can include:
   * - System messages: Instructions for the model's behavior
   * - User messages: Questions or prompts
   * - Assistant messages: Previous responses (for multi-turn conversations)
   *
   * In RAG systems, this is typically used with:
   * 1. A system message setting behavior (e.g., "Answer only from context")
   * 2. A user message containing retrieved context + the question
   *
   * @param messages - Array of messages forming the conversation context
   * @param model - The OpenAI model identifier to use (e.g., "gpt-4o-mini")
   * @returns Promise resolving to the generated text response
   */
  async chat(messages: ChatMessage[], model: string): Promise<string> {
    logger.debug("Requesting chat completion", {
      model,
      messagesCount: messages.length
    });
    const response = await this.client.chat.completions.create({
      model,
      messages
    });
    const choice = response.choices[0];
    return choice.message?.content ?? "";
  }
}


