import OpenAI from "openai";
import { logger } from "./logging";

export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatClient {
  chat(messages: ChatMessage[], model: string): Promise<string>;
}

export class OpenAIEmbeddingClient implements EmbeddingClient {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    logger.debug("Requesting embeddings", { count: texts.length });
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });
    return response.data.map((item) => item.embedding as number[]);
  }
}

export class OpenAIChatClient implements ChatClient {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey });
  }

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


