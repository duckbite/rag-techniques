import { describe, expect, it } from "vitest";
import { generateHypotheticalQuestions } from "../hype";
import { ChatClient, ChatMessage } from "../../../../shared/typescript/utils/llm";

class FakeChatClient implements ChatClient {
  public calls: { messages: ChatMessage[]; model: string }[] = [];

  async chat(messages: ChatMessage[], model: string): Promise<string> {
    this.calls.push({ messages, model });
    // Return mock questions in various formats
    return `1. What causes climate change?
2. How do greenhouse gases affect the climate?
3. What are the effects of climate change?
4. How can we mitigate climate change?`;
  }
}

describe("hype", () => {
  describe("generateHypotheticalQuestions", () => {
    it("generates multiple questions for a chunk", async () => {
      const chatClient = new FakeChatClient();
      const result = await generateHypotheticalQuestions(
        "Climate change is caused by greenhouse gases...",
        chatClient,
        "gpt-4o-mini"
      );

      expect(chatClient.calls).toHaveLength(1);
      expect(chatClient.calls[0].model).toBe("gpt-4o-mini");
      expect(chatClient.calls[0].messages[0].content).toContain("Climate change");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((q) => q.length > 10)).toBe(true);
    });

    it("parses numbered list format", async () => {
      const chatClient = new FakeChatClient();
      const result = await generateHypotheticalQuestions("test", chatClient, "model");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((q) => !q.match(/^\d+\./))).toBe(true); // No numbers at start
    });

    it("parses bulleted list format", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return "- First question\n- Second question\n- Third question";
        }
      };
      const result = await generateHypotheticalQuestions("test", chatClient, "model");
      expect(result.length).toBe(3);
      expect(result[0]).not.toContain("-");
    });

    it("handles empty response with fallback", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return "  \n\n  ";
        }
      };
      const result = await generateHypotheticalQuestions("test chunk text", chatClient, "model");
      expect(result.length).toBe(1);
      expect(result[0]).toContain("test chunk");
    });

    it("filters out header lines", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return `Questions:
1. First question
2. Second question`;
        }
      };
      const result = await generateHypotheticalQuestions("test", chatClient, "model");
      expect(result.length).toBe(2);
      expect(result[0]).not.toContain("Questions:");
    });

    it("handles double newlines", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return "1. First\n\n2. Second";
        }
      };
      const result = await generateHypotheticalQuestions("test", chatClient, "model");
      expect(result.length).toBe(2);
    });
  });
});


