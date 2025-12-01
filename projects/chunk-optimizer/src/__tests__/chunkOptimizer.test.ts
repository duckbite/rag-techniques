import { describe, expect, it } from "vitest";
import { benchmarkChunking } from "../chunkOptimizer";

const sampleText = "Background insight action owner. Repeated instructions for benchmarking chunk sizes.";

describe("benchmarkChunking", () => {
  it("evaluates each chunk size/overlap pair", () => {
    const results = benchmarkChunking(sampleText, [50, 80], [10, 20]);
    expect(results).toHaveLength(4);
    expect(results[0].chunkSize).toBe(50);
    expect(results[0].chunkOverlap).toBe(10);
    expect(results[0].chunkCount).toBeGreaterThan(0);
  });

  it("skips invalid overlap configurations", () => {
    const results = benchmarkChunking(sampleText, [50], [60]);
    expect(results).toHaveLength(0);
  });
});

