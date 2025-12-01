import fs from "node:fs";
import path from "node:path";
import { loadJsonConfig } from "../../../shared/typescript/utils/config";
import { logger } from "../../../shared/typescript/utils/logging";
import { simpleChunkDocument } from "../../../shared/typescript/utils/chunking";
import { Document } from "../../../shared/typescript/utils/types";

/**
 * Configuration for chunk size benchmarking.
 *
 * Defines the parameters for running chunking experiments:
 * - `sampleDocPath`: Path to a sample document to use for benchmarking
 * - `chunkSizes`: Array of chunk sizes (in characters) to test
 * - `chunkOverlaps`: Array of overlap sizes (in characters) to test
 * - `reportPath`: Where to save the benchmark results JSON file
 *
 * The optimizer will test all combinations of chunk sizes and overlaps,
 * generating metrics to help you choose optimal values for your use case.
 */
export interface ChunkOptimizerConfig {
  sampleDocPath: string;
  chunkSizes: number[];
  chunkOverlaps: number[];
  reportPath: string;
}

export interface ChunkBenchmark {
  chunkSize: number;
  chunkOverlap: number;
  chunkCount: number;
  averageLength: number;
  overlapPercent: number;
  redundancyRatio: number;
}

/**
 * Loads and validates a chunk optimizer configuration file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns A validated ChunkOptimizerConfig object
 * @throws Error if the config file is missing or missing required keys
 */
export function loadChunkOptimizerConfig(configPath: string): ChunkOptimizerConfig {
  const data = loadJsonConfig(configPath) as Partial<ChunkOptimizerConfig>;
  const required: (keyof ChunkOptimizerConfig)[] = [
    "sampleDocPath",
    "chunkSizes",
    "chunkOverlaps",
    "reportPath"
  ];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing chunk optimizer config key: ${key.toString()}`);
    }
  }
  return data as ChunkOptimizerConfig;
}

/**
 * Benchmarks different chunk size and overlap combinations on a sample document.
 *
 * This function runs a systematic experiment to help you choose optimal chunking
 * parameters. It tests all combinations of the provided chunk sizes and overlaps,
 * generating metrics for each combination:
 *
 * - **chunkCount**: Total number of chunks produced
 * - **averageLength**: Average chunk size (helps identify if chunks are too small/large)
 * - **overlapPercent**: Overlap as a percentage of chunk size (helps understand redundancy)
 * - **redundancyRatio**: Total redundant characters (overlap × chunks) / document length
 *
 * **Why benchmark?** Chunk size and overlap significantly impact RAG performance:
 * - **Too small**: Chunks lose context, making retrieval less accurate
 * - **Too large**: Chunks include irrelevant information, diluting relevance
 * - **Too little overlap**: Important information at chunk boundaries gets lost
 * - **Too much overlap**: Wastes embedding API calls and increases storage
 *
 * **Interpreting results**: Look for combinations that:
 * - Produce a reasonable number of chunks (not too many, not too few)
 * - Have moderate overlap (10-25% is typical)
 * - Balance context preservation with retrieval precision
 *
 * @param text - The sample document text to benchmark
 * @param chunkSizes - Array of chunk sizes (in characters) to test
 * @param chunkOverlaps - Array of overlap sizes (in characters) to test
 * @returns Array of ChunkBenchmark objects, sorted by chunk size then overlap
 *
 * @example
 * ```typescript
 * const benchmarks = benchmarkChunking(sampleText, [400, 800, 1200], [50, 150, 250]);
 * // Returns 9 benchmark results (3 sizes × 3 overlaps)
 * ```
 */
export function benchmarkChunking(
  text: string,
  chunkSizes: number[],
  chunkOverlaps: number[]
): ChunkBenchmark[] {
  const doc: Document = {
    id: "benchmark-doc",
    content: text,
    title: "Sample"
  };

  const results: ChunkBenchmark[] = [];
  for (const size of chunkSizes) {
    for (const overlap of chunkOverlaps) {
      if (overlap >= size) continue;
      const chunks = simpleChunkDocument(doc, { chunkSize: size, chunkOverlap: overlap });
      const averageLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length;
      const overlapPercent = Number((overlap / size).toFixed(2));
      const redundancyRatio = Number(
        Math.max(0, chunks.length * overlap) / Math.max(1, text.length)
      );
      results.push({
        chunkSize: size,
        chunkOverlap: overlap,
        chunkCount: chunks.length,
        averageLength: Number(averageLength.toFixed(1)),
        overlapPercent,
        redundancyRatio: Number(redundancyRatio.toFixed(2))
      });
    }
  }
  return results.sort((a, b) => a.chunkSize - b.chunkSize || a.chunkOverlap - b.chunkOverlap);
}

/**
 * Saves benchmark results to a JSON file.
 *
 * Creates the report directory if it doesn't exist and writes the results
 * with a timestamp for tracking when the benchmark was run.
 *
 * @param reportPath - Path where the JSON report should be saved
 * @param benchmarks - Array of benchmark results to save
 */
function saveReport(reportPath: string, benchmarks: ChunkBenchmark[]): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), benchmarks }, null, 2));
}

/**
 * Prints benchmark results as a formatted table to the console.
 *
 * Uses Node.js's built-in `console.table()` to display results in an easy-to-read
 * tabular format. This helps you quickly compare different chunking configurations.
 *
 * @param benchmarks - Array of benchmark results to display
 */
function printTable(benchmarks: ChunkBenchmark[]): void {
  const rows = benchmarks.map((b) => ({
    "Chunk Size": b.chunkSize,
    "Overlap": b.chunkOverlap,
    "Chunks": b.chunkCount,
    "Avg Length": b.averageLength,
    "Overlap %": b.overlapPercent,
    "Redundancy": b.redundancyRatio
  }));
  // eslint-disable-next-line no-console
  console.table(rows);
}

async function main(): Promise<void> {
  const configPath =
    process.env.CHUNK_OPTIMIZER_CONFIG ??
    path.resolve(__dirname, "../config/chunk-optimizer.config.json");
  const cfg = loadChunkOptimizerConfig(configPath);
  const samplePath = path.resolve(path.join(path.dirname(configPath), "..", cfg.sampleDocPath));
  const sampleText = fs.readFileSync(samplePath, "utf-8");

  logger.info("Running chunk benchmark", {
    sampleDocPath: cfg.sampleDocPath,
    chunkSizes: cfg.chunkSizes,
    chunkOverlaps: cfg.chunkOverlaps
  });

  const benchmarks = benchmarkChunking(sampleText, cfg.chunkSizes, cfg.chunkOverlaps);
  const reportPath = path.resolve(path.join(path.dirname(configPath), "..", cfg.reportPath));
  saveReport(reportPath, benchmarks);
  printTable(benchmarks);

  logger.info("Chunk benchmarking complete", { reportPath });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Chunk benchmark failed", { err });
    process.exitCode = 1;
  });
}

