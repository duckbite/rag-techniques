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
    const logData = JSON.parse(call);
    expect(logData.level).toBe("debug");
    expect(logData.message).toBe("Debug message");
    expect(logData.meta).toEqual({ key: "value" });
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
    const logData = JSON.parse(call);
    expect(logData.level).toBe("info");
    expect(logData.message).toBe("Info message");
  });

  it("should log warn messages", () => {
    process.env.LOG_LEVEL = "warn";
    logger.warn("Warning message", { error: "test" });

    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.level).toBe("warn");
    expect(logData.meta).toEqual({ error: "test" });
  });

  it("should log error messages", () => {
    process.env.LOG_LEVEL = "error";
    logger.error("Error message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.level).toBe("error");
  });

  it("should include timestamp in log output", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.time).toBeDefined();
    expect(new Date(logData.time).getTime()).toBeGreaterThan(0);
  });

  it("should not include meta field when not provided", () => {
    process.env.LOG_LEVEL = "info";
    logger.info("Test message");

    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.meta).toBeUndefined();
  });

  it("should default to info level when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.level).toBe("info");
  });

  it("should default to info level when LOG_LEVEL is invalid", () => {
    process.env.LOG_LEVEL = "invalid";
    logger.debug("Debug message");
    logger.info("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0][0];
    const logData = JSON.parse(call);
    expect(logData.level).toBe("info");
  });

  it("should respect log level hierarchy", () => {
    process.env.LOG_LEVEL = "warn";
    logger.debug("Debug");
    logger.info("Info");
    logger.warn("Warn");
    logger.error("Error");

    expect(consoleLogSpy).toHaveBeenCalledTimes(2); // warn and error only
  });
});
