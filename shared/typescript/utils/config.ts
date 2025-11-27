import fs from "node:fs";
import path from "node:path";
import { logger } from "./logging";
import { RagConfig } from "./types";

/**
 * Loads and parses a JSON configuration file.
 *
 * This is a generic utility for reading JSON config files. It handles
 * file path resolution, existence checking, and JSON parsing with
 * error handling.
 *
 * @param configPath - Path to the JSON config file (relative or absolute)
 * @returns The parsed JSON object as unknown (caller should validate/type)
 * @throws Error if the file doesn't exist or contains invalid JSON
 *
 * @example
 * ```typescript
 * const config = loadJsonConfig("./config/app.json");
 * ```
 */
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

/**
 * Loads and validates a RAG configuration file.
 *
 * This function loads a JSON config file and validates that it contains
 * all required fields for a RAG system. It ensures type safety and
 * provides clear error messages for missing configuration.
 *
 * Required configuration fields:
 * - `chunkSize`: Number of characters per document chunk
 * - `chunkOverlap`: Characters of overlap between chunks
 * - `topK`: Number of chunks to retrieve per query
 * - `embeddingModel`: OpenAI embedding model identifier
 * - `chatModel`: OpenAI chat model identifier
 * - `dataPath`: Path to directory containing source documents
 * - `indexPath`: Path where the vector index should be saved/loaded
 *
 * @param configPath - Path to the JSON config file (relative or absolute)
 * @returns A validated RagConfig object with all required fields
 * @throws Error if the config file is missing, invalid JSON, or missing required keys
 *
 * @example
 * ```typescript
 * const config = loadRagConfig("./config/basic-rag.config.json");
 * // config.chunkSize, config.topK, etc. are now available and typed
 * ```
 */
export function loadRagConfig(configPath: string): RagConfig {
  const data = loadJsonConfig(configPath) as Partial<RagConfig>;

  // Define all required configuration keys
  const requiredKeys: (keyof RagConfig)[] = [
    "chunkSize",
    "chunkOverlap",
    "topK",
    "embeddingModel",
    "chatModel",
    "dataPath",
    "indexPath"
  ];

  // Validate that all required keys are present
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing required config key: ${key}`);
    }
  }

  return data as RagConfig;
}


