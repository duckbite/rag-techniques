import { describe, expect, it } from "vitest";
import { generateHypotheticalDocument } from "../hyde";
import { ChatClient, ChatMessage } from "../../../../shared/typescript/utils/llm";

class FakeChatClient implements ChatClient {
  public calls: { messages: ChatMessage[]; model: string }[] = [];

  async chat(messages: ChatMessage[], model: string): Promise<string> {
    this.calls.push({ messages, model });
    // Return mock hypothetical document
    return "Climate change refers to long-term shifts in global temperatures and weather patterns. It is primarily caused by human activities that increase greenhouse gas concentrations in the atmosphere, such as burning fossil fuels and deforestation. The effects include rising sea levels, more frequent extreme weather events, and changes in precipitation patterns.";
  }
}

describe("hyde", () => {
  describe("generateHypotheticalDocument", () => {
    it("generates a hypothetical document answering the query", async () => {
      const chatClient = new FakeChatClient();
      const result = await generateHypotheticalDocument(
        "What is climate change?",
        800,
        chatClient,
        "gpt-4o-mini"
      );

      expect(chatClient.calls).toHaveLength(1);
      expect(chatClient.calls[0].model).toBe("gpt-4o-mini");
      expect(chatClient.calls[0].messages[0].content).toContain("What is climate change?");
      expect(chatClient.calls[0].messages[0].content).toContain("800");
      expect(result).toContain("Climate change");
      expect(result.length).toBeGreaterThan(0);
    });

    it("trims whitespace from response", async () => {
      const chatClient: ChatClient = {
        async chat() {
          return "  \n  test document  \n  ";
        }
      };
      const result = await generateHypotheticalDocument("test", 100, chatClient, "model");
      expect(result).toBe("test document");
    });

    it("includes target length in prompt", async () => {
      const chatClient = new FakeChatClient();
      await generateHypotheticalDocument("test", 500, chatClient, "model");
      expect(chatClient.calls[0].messages[0].content).toContain("500");
    });
  });
});


