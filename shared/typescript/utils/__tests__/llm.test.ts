import { describe, expect, it, vi, beforeEach } from "vitest";
import { OpenAIEmbeddingClient, OpenAIChatClient, ChatMessage } from "../llm";

// Use vi.hoisted() to create mock functions that can be accessed in both mock factory and tests
const { mockEmbeddingsCreate, mockChatCompletionsCreate } = vi.hoisted(() => {
  return {
    mockEmbeddingsCreate: vi.fn(),
    mockChatCompletionsCreate: vi.fn()
  };
});

// Mock OpenAI module
vi.mock("openai", () => {
  const mockOpenAIClient = {
    embeddings: {
      create: mockEmbeddingsCreate
    },
    chat: {
      completions: {
        create: mockChatCompletionsCreate
      }
    }
  };

  // Create a mock class that returns our mock client
  class MockOpenAI {
    constructor() {
      return mockOpenAIClient;
    }
  }

  return {
    default: MockOpenAI
  };
});

describe("OpenAIEmbeddingClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  it("should throw error if OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIEmbeddingClient("text-embedding-3-small")).toThrow(
      "OPENAI_API_KEY is not set"
    );
  });

  it("should generate embeddings for texts", async () => {
    const mockEmbeddings = [
      { embedding: [0.1, 0.2, 0.3] },
      { embedding: [0.4, 0.5, 0.6] }
    ];

    mockEmbeddingsCreate.mockResolvedValue({
      data: mockEmbeddings
    });

    const client = new OpenAIEmbeddingClient("text-embedding-3-small");
    const result = await client.embed(["text1", "text2"]);

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["text1", "text2"]
    });
    expect(result).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  });

  it("should handle empty input array", async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [] });

    const client = new OpenAIEmbeddingClient("text-embedding-3-small");
    const result = await client.embed([]);

    expect(result).toEqual([]);
  });
});

describe("OpenAIChatClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  it("should throw error if OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIChatClient()).toThrow("OPENAI_API_KEY is not set");
  });

  it("should generate chat completion", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "This is a test response"
          }
        }
      ]
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const client = new OpenAIChatClient();
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" }
    ];
    const result = await client.chat(messages, "gpt-4o-mini");

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages
    });
    expect(result).toBe("This is a test response");
  });

  it("should return empty string if content is null", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null
          }
        }
      ]
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const client = new OpenAIChatClient();
    const result = await client.chat([{ role: "user", content: "test" }], "gpt-4o-mini");

    expect(result).toBe("");
  });

  it("should handle system and user messages", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Response" } }]
    });

    const client = new OpenAIChatClient();
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "What is RAG?" }
    ];

    await client.chat(messages, "gpt-4o-mini");

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages
    });
  });
});
