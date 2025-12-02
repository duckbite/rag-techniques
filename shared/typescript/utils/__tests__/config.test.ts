import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { loadJsonConfig, loadRagConfig } from "../config";
import { logger } from "../logging";

// Mock logger to avoid console output in tests
vi.mock("../logging", () => ({
  logger: {
    error: vi.fn()
  }
}));

describe("loadJsonConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load and parse valid JSON config", () => {
    const configPath = path.join(tmpDir, "config.json");
    const configData = { key: "value", number: 42 };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    const result = loadJsonConfig(configPath);
    expect(result).toEqual(configData);
  });

  it("should throw error if file does not exist", () => {
    const configPath = path.join(tmpDir, "nonexistent.json");
    expect(() => loadJsonConfig(configPath)).toThrow("Config file not found");
  });

  it("should throw error if JSON is invalid", () => {
    const configPath = path.join(tmpDir, "invalid.json");
    fs.writeFileSync(configPath, "{ invalid json }");

    expect(() => loadJsonConfig(configPath)).toThrow();
    expect(logger.error).toHaveBeenCalled();
  });

  it("should handle relative paths", () => {
    const configPath = path.join(tmpDir, "config.json");
    const configData = { test: "data" };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    process.chdir(tmpDir);
    const result = loadJsonConfig("./config.json");
    expect(result).toEqual(configData);
  });
});

describe("loadRagConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-config-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load and validate complete RAG config", () => {
    const configPath = path.join(tmpDir, "rag.config.json");
    const configData = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 5,
      embeddingModel: "text-embedding-3-small",
      chatModel: "gpt-4o-mini",
      dataPath: "./data",
      indexPath: "./index"
    };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    const result = loadRagConfig(configPath);
    expect(result).toEqual(configData);
    expect(result.chunkSize).toBe(100);
    expect(result.topK).toBe(5);
  });

  it("should throw error if required key is missing", () => {
    const configPath = path.join(tmpDir, "incomplete.config.json");
    const configData = {
      chunkSize: 100,
      chunkOverlap: 20
      // missing other required keys
    };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    expect(() => loadRagConfig(configPath)).toThrow("Missing required config key");
  });

  it("should throw error if required key is null", () => {
    const configPath = path.join(tmpDir, "null-key.config.json");
    const configData = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: null,
      embeddingModel: "test",
      chatModel: "test",
      dataPath: "./data",
      indexPath: "./index"
    };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    expect(() => loadRagConfig(configPath)).toThrow("Missing required config key: topK");
  });

  it("should throw error if required key is undefined", () => {
    const configPath = path.join(tmpDir, "undefined-key.config.json");
    const configData = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 5,
      embeddingModel: "test",
      chatModel: "test",
      dataPath: "./data"
      // indexPath is missing
    };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    expect(() => loadRagConfig(configPath)).toThrow("Missing required config key: indexPath");
  });

  it("should accept optional documentTitles field", () => {
    const configPath = path.join(tmpDir, "with-titles.config.json");
    const configData = {
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 5,
      embeddingModel: "test",
      chatModel: "test",
      dataPath: "./data",
      indexPath: "./index",
      documentTitles: ["doc1.txt", "doc2.txt"]
    };
    fs.writeFileSync(configPath, JSON.stringify(configData));

    const result = loadRagConfig(configPath);
    expect(result.documentTitles).toEqual(["doc1.txt", "doc2.txt"]);
  });
});
