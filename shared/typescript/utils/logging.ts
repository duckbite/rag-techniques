type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function currentLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LOG_LEVELS.includes(level) ? level : "info";
}

function levelToIndex(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (levelToIndex(level) < levelToIndex(currentLevel())) return;

  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ? { meta } : {})
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta)
};


