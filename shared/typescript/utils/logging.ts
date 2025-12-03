import prettyjson from "prettyjson";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const prettyJsonOptions = {
  noColor: false
};

function currentLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LOG_LEVELS.includes(level) ? level : "info";
}

function levelToIndex(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

function colorize(level: LogLevel, text: string): string {
  const RESET = "\x1b[0m";

  const COLORS: Record<LogLevel, string> = {
    debug: "\x1b[90m", // bright black / gray
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m" // red
  };

  const color = COLORS[level];
  return `${color}${text}${RESET}`;
}

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (levelToIndex(level) < levelToIndex(currentLevel())) return;

  const time = new Date().toISOString();

  const coloredLevel = colorize(level, level.toUpperCase());

  // eslint-disable-next-line no-console
  console.log(`[${time}] [${coloredLevel}] ${message}`);

  if (meta !== undefined) {
    const metaString =
      typeof meta === "string" ? meta : JSON.stringify(meta, null, 2);
    console.log(`${prettyjson.render(meta, prettyJsonOptions)}\n`);  
    // console.log(`\n  ${metaString}`);
  }


}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta)
};


