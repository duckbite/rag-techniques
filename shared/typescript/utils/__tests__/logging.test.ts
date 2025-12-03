import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logging";

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
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("DEBUG");
    expect(call).toContain("Debug message");
    expect(call).toContain('"key": "value"');
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
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("INFO");
    expect(call).toContain("Info message");
  });

  it("should log warn messages", () => {
    process.env.LOG_LEVEL = "warn";
    logger.warn("Warning message", { error: "test" });

    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("WARN");
    expect(call).toContain("Warning message");
    expect(call).toContain('"error": "test"');
  });

  it("should log error messages", () => {
    process.env.LOG_LEVEL = "error";
    logger.error("Error message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("ERROR");
    expect(call).toContain("Error message");
  });

  it("should include timestamp in log output", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const call = consoleLogSpy.mock.calls[0][0];
    // Timestamp should be at the start in ISO format within brackets
    expect(call).toMatch(/^\[[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });

  it("should not include meta field when not provided", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("Test message");
    // Should be a single line without a JSON meta block
    expect(call.split("\n").length).toBe(1);
  });

  it("should default to info level when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("INFO");
    expect(call).toContain("Info message");
  });

  it("should default to info level when LOG_LEVEL is invalid", () => {
    process.env.LOG_LEVEL = "invalid";
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain("INFO");
    expect(call).toContain("Info message");
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
    const call = consoleLogSpy.mock.calls[0][0];
    // Expect ANSI color sequence around ERROR
    expect(call).toMatch(/\x1b\[[0-9;]*mERROR\x1b\[0m/);
  });
});
