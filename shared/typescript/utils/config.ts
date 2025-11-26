import fs from "node:fs";
import path from "node:path";
import { logger } from "./logging";
import { RagConfig } from "./types";

export function loadJsonConfig(configPath: string): unknown {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found at ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.error("Failed to parse JSON config", { err });
    throw err;
  }
}

export function loadRagConfig(configPath: string): RagConfig {
  const data = loadJsonConfig(configPath) as Partial<RagConfig>;

  const requiredKeys: (keyof RagConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath"
  ];

  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing required config key: ${key}`);
    }
  }

  return data as RagConfig;
}


