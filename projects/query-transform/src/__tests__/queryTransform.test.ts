import { describe, expect, it } from "vitest";
import {
  rewriteQuery,
  generateStepBackQuery,
  decomposeQuery
} from "../queryTransform";
import { ChatClient, ChatMessage } from "../../../../shared/typescript/utils/llm";

class FakeChatClient implements ChatClient {
  public calls: { messages: ChatMessage[]; model: string }[] = [];

  async chat(messages: ChatMessage[], model: string): Promise<string> {
    this.calls.push({ messages, model });
    // Return mock responses based on the prompt content
    const content = messages[0]?.content ?? "";
    if (content.includes("rewrite")) {
      return "What are the specific causes, effects, and scientific evidence of climate change?";
    }
    if (content.includes("step-back")) {
      return "What are the broader environmental and climate patterns?";
    }
    if (content.includes("decompose")) {
      return `1. What are the impacts of climate change on biodiversity?
2. How does climate change affect the oceans?
3. What are the effects of climate change on agriculture?
4. What are the impacts of climate change on human health?`;
    }
    return "mock response";
  }
}

describe("queryTransform", () => {
  describe("rewriteQuery", () => {
    it("reformulates query to be more specific and detailed", async () => {
      const chatClient = new FakeChatClient();
      const result = await rewriteQuery("What is climate change?", chatClient, "gpt-4o-mini");

      expect(chatClient.calls).toHaveLength(1);
      expect(chatClient.calls[0].model).toBe("gpt-4o-mini");
      expect(chatClient.calls[0].messages[0].content).toContain("What is climate change?");
      expect(chatClient.calls[0].messages[0].content).toContain("rewrite");
      expect(result).toContain("climate change");
      expect(result.length).toBeGreaterThan("What is climate change?".length);
    });

    it("trims whitespace from response", async () => {
      const chatClient = new FakeChatClient();
      const result = await rewriteQuery("test", chatClient, "model");
      expect(result).toBe(result.trim());
    });
  });

  describe("generateStepBackQuery", () => {
    it("generates broader, more general query", async () => {
      const chatClient = new FakeChatClient();
      const result = await generateStepBackQuery(
        "What is the revenue for Q3 2023?",
        chatClient,
        "gpt-4o-mini"
      );

      expect(chatClient.calls).toHaveLength(1);
      expect(chatClient.calls[0].model).toBe("gpt-4o-mini");
      expect(chatClient.calls[0].messages[0].content).toContain("Q3 2023");
      expect(chatClient.calls[0].messages[0].content).toContain("step-back");
      expect(result).toContain("environmental");
    });

    it("trims whitespace from response", async () => {
      const chatClient = new FakeChatClient();
      const result = await generateStepBackQuery("test", chatClient, "model");
      expect(result).toBe(result.trim());
    });
  });

  describe("decomposeQuery", () => {
    it("breaks complex query into simpler sub-queries", async () => {
      const chatClient = new FakeChatClient();
      const result = await decomposeQuery(
        "What are the impacts of climate change on the environment?",
        chatClient,
        "gpt-4o-mini",
        4
      );

      expect(chatClient.calls).toHaveLength(1);
      expect(chatClient.calls[0].model).toBe("gpt-4o-mini");
      expect(chatClient.calls[0].messages[0].content).toContain("climate change");
      expect(chatClient.calls[0].messages[0].content).toContain("decompose");
      expect(result).toHaveLength(4);
      expect(result[0]).toContain("biodiversity");
      expect(result[1]).toContain("oceans");
      expect(result[2]).toContain("agriculture");
      expect(result[3]).toContain("human health");
    });

    it("parses numbered list format", async () => {
      const chatClient = new FakeChatClient();
      const result = await decomposeQuery("test", chatClient, "model", 4);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((q) => !q.match(/^\d+\./))).toBe(true); // No numbers at start
    });

    it("handles empty response by returning original query", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return "  \n\n  ";
        }
      };
      const result = await decomposeQuery("original query", chatClient, "model", 4);
      expect(result).toEqual(["original query"]);
    });

    it("respects maxQueries limit", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return `1. Question one
2. Question two
3. Question three
4. Question four
5. Question five`;
        }
      };
      const result = await decomposeQuery("test", chatClient, "model", 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("filters out header lines", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return `Sub-queries:
1. First question
2. Second question`;
        }
      };
      const result = await decomposeQuery("test", chatClient, "model", 4);
      expect(result.length).toBe(2);
      expect(result[0]).not.toContain("Sub-queries");
    });
  });
});


