import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logging";

// Helper to strip ANSI color codes for testing
function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// Helper to get all log output as a single string
function getAllLogOutput(calls: unknown[][]): string {
  return calls.map((c) => String(c[0])).join("\n");
}

describe("logger", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should log debug messages when LOG_LEVEL is debug", () => {
    process.env.LOG_LEVEL = "debug";
    logger.debug("Debug message", { key: "value" });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = stripAnsiCodes(getAllLogOutput(consoleLogSpy.mock.calls));
    expect(output).toContain("DEBUG");
    expect(output).toContain("Debug message");
    expect(output).toMatch(/key:\s*value/);
  });

  it("should not log debug messages when LOG_LEVEL is info", () => {
    process.env.LOG_LEVEL = "info";
    logger.debug("Debug message");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should log info messages", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    expect(output).toContain("INFO");
    expect(output).toContain("Info message");
  });

  it("should log warn messages", () => {
    process.env.LOG_LEVEL = "warn";
    logger.warn("Warning message", { error: "test" });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = stripAnsiCodes(getAllLogOutput(consoleLogSpy.mock.calls));
    expect(output).toContain("WARN");
    expect(output).toContain("Warning message");
    expect(output).toMatch(/error:\s*test/);
  });

  it("should log error messages", () => {
    process.env.LOG_LEVEL = "error";
    logger.error("Error message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    expect(output).toContain("ERROR");
    expect(output).toContain("Error message");
  });

  it("should include timestamp in log output", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    // Timestamp should be at the start in ISO format within brackets
    expect(output).toMatch(/^\[[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });

  it("should not include meta field when not provided", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    expect(output).toContain("Test message");
    // Should be a single line without a JSON meta block
    expect(output.split("\n").length).toBe(1);
  });

  it("should default to info level when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    expect(output).toContain("INFO");
    expect(output).toContain("Info message");
  });

  it("should default to info level when LOG_LEVEL is invalid", () => {
    process.env.LOG_LEVEL = "invalid";
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = stripAnsiCodes(String(consoleLogSpy.mock.calls[0][0]));
    expect(output).toContain("INFO");
    expect(output).toContain("Info message");
  });

  it("should respect log level hierarchy", () => {
    process.env.LOG_LEVEL = "warn";
    logger.debug("Debug");
    logger.info("Info");
    logger.warn("Warn");
    logger.error("Error");

    expect(consoleLogSpy).toHaveBeenCalledTimes(2); // warn and error only
  });

  it("should colorize log levels for pretty CLI output", () => {
    process.env.LOG_LEVEL = "debug";
    logger.error("Colored error");

    expect(consoleLogSpy).toHaveBeenCalled();
    const call = String(consoleLogSpy.mock.calls[0][0]);
    // Expect ANSI color sequence around ERROR (before stripping)
    expect(call).toMatch(/\x1b\[[0-9;]*mERROR\x1b\[0m/);
    // But stripped version should still contain ERROR
    expect(stripAnsiCodes(call)).toContain("ERROR");
  });
});
