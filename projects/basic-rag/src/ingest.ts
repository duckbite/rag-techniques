import fs from "node:fs";
import path from "node:path";
import { loadRagConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { OpenAIEmbeddingClient } from "../../../shared/typescript/utils/llm";
import {
  Chunk,
  Document,
  RagConfig
} from "../../../shared/typescript/utils/types";
import {
  InMemoryVectorStore,
  embedChunks
} from "../../../shared/typescript/utils/vectorStore";

function readDocumentsFromDir(dir: string): Document[] {
  const resolved = path.resolve(dir);
  const files = fs.readdirSync(resolved).filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
  return files.map((file, idx) => {
    const content = fs.readFileSync(path.join(resolved, file), "utf-8");
    return {
      id: `doc-${idx}`,
      title: file,
      content
    };
  });
}

function simpleChunkDocument(doc: Document, cfg: RagConfig): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, chunkOverlap } = cfg;
  const text = doc.content;
  let index = 0;
  let chunkIndex = 0;
  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    const content = text.slice(index, end);
    chunks.push({
      id: `${doc.id}-chunk-${chunkIndex}`,
      documentId: doc.id,
      content,
      index: chunkIndex
    });
    if (end === text.length) break;
    index += chunkSize - chunkOverlap;
    chunkIndex += 1;
  }
  return chunks;
}

async function main(): Promise<void> {
  const configPath =
    process.env.RAG_CONFIG_PATH ??
    path.resolve(__dirname, "../config/basic-rag.config.json");

  logger.info("Loading config", { configPath });
  const cfg = loadRagConfig(configPath);

  logger.info("Reading documents", { dataPath: cfg.dataPath });
  const docs = readDocumentsFromDir(cfg.dataPath);
  logger.info("Loaded documents", { count: docs.length });

  const allChunks: Chunk[] = docs.flatMap((doc) => simpleChunkDocument(doc, cfg));
  logger.info("Created chunks", { count: allChunks.length });

  const embeddingClient = new OpenAIEmbeddingClient(cfg.embeddingModel);
  const embeddings = await embedChunks(allChunks, embeddingClient);

  const store = new InMemoryVectorStore();
  store.addMany(allChunks, embeddings);
  store.persist(cfg.indexPath);
}

main().catch((err) => {
  logger.error("Ingestion failed", { err });
  process.exitCode = 1;
});


