import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { loadEnv } from "../env";

// Mock dotenv
vi.mock("dotenv", () => ({
  config: vi.fn()
}));

describe("loadEnv", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("should load .env from current directory", async () => {
    const { config } = await import("dotenv");
    fs.writeFileSync(path.join(tmpDir, ".env"), "TEST_KEY=test_value");
    process.chdir(tmpDir);

    loadEnv();

    // Check that config was called with a path that resolves to our .env file
    const callArgs = (config as any).mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.path).toBeDefined();
    // Verify the path points to the .env file we created
    const actualPath = fs.realpathSync(callArgs.path);
    const expectedPath = fs.realpathSync(path.join(tmpDir, ".env"));
    expect(actualPath).toBe(expectedPath);
  });

  it("should search parent directories for .env", async () => {
    const { config } = await import("dotenv");
    const subDir = path.join(tmpDir, "sub", "nested");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".env"), "TEST_KEY=test_value");
    process.chdir(subDir);

    loadEnv();

    // Check that config was called with a path that resolves to the parent .env file
    const callArgs = (config as any).mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.path).toBeDefined();
    const actualPath = fs.realpathSync(callArgs.path);
    const expectedPath = fs.realpathSync(path.join(tmpDir, ".env"));
    expect(actualPath).toBe(expectedPath);
  });

  it("should fallback to default dotenv behavior if no .env found", async () => {
    const { config } = await import("dotenv");
    process.chdir(tmpDir);

    loadEnv();

    expect(config).toHaveBeenCalledWith();
  });
});
