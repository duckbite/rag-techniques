import readline from "node:readline";
import path from "node:path";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import {
  OpenAIChatClient,
  OpenAIEmbeddingClient
} from "../../../shared/typescript/utils/llm";
import { loadInMemoryVectorStore } from "../../../shared/typescript/utils/vectorStore";

async function interactiveQuery(): Promise<void> {
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/basic-rag.config.json");
  const cfg = loadRagConfig(configPath);

  const store = loadInMemoryVectorStore(cfg.indexPath);
  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const chatClient = new OpenAIChatClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  logger.info("Basic RAG query CLI ready. Type 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const question = (await ask("> ")).trim();
    if (!question || question.toLowerCase() === "exit") break;

    const [queryEmbedding] = await embeddingClient.embed([question]);
    const retrieved = store.search(queryEmbedding, cfg.topK);

    const contextText = retrieved
      .map((c, idx) => `Chunk ${idx + 1} (score=${c.score.toFixed(3)}):\n${c.content}`)
      .join("\n\n");

    const prompt = [
      "You are a helpful assistant answering questions based only on the provided context.",
      "If the answer is not in the context, say you don't know.",
      "",
      "Context:",
      contextText,
      "",
      `Question: ${question}`,
      "Answer:"
    ].join("\n");

    const answer = await chatClient.chat(
      [
        {
          role: "user",
          content: prompt
        }
      ],
      cfg.chatModel
    );

    // eslint-disable-next-line no-console
    console.log("\nAnswer:\n", answer, "\n");
  }

  rl.close();
}

interactiveQuery().catch((err) => {
  logger.error("Query CLI failed", { err });
  process.exitCode = 1;
});


