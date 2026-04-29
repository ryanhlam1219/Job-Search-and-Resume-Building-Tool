/**
 * Structured server-side logger.
 *
 * Outputs single-line JSON to stdout/stderr so logs are easy to grep and
 * pipe through tools like `jq`.
 *
 * Usage:
 *   import { logger } from "@/backend/lib/logger";
 *   logger.info("jobs/route", "GET /api/jobs", { page: 1, total: 42 });
 *   logger.error("swipes/route", "DB write failed", err);
 *
 * Set LOG_LEVEL env var to control verbosity:
 *   debug | info (default) | warn | error
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function currentLevel(): Level {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && raw in LEVELS) return raw as Level;
  return "info";
}

function log(level: Level, context: string, message: string, data?: unknown) {
  if (LEVELS[level] < LEVELS[currentLevel()]) return;

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    context,
    message,
  };

  if (data !== undefined) {
    entry.data =
      data instanceof Error
        ? { name: data.name, message: data.message, stack: data.stack }
        : data;
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) =>
    log("debug", context, message, data),
  info: (context: string, message: string, data?: unknown) =>
    log("info", context, message, data),
  warn: (context: string, message: string, data?: unknown) =>
    log("warn", context, message, data),
  error: (context: string, message: string, data?: unknown) =>
    log("error", context, message, data),
};
