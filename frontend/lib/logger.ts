/**
 * Structured client-side logger.
 *
 * Prefixes every log line with a timestamp and context tag so you can
 * filter in the browser DevTools console with e.g. "[SwipePage]".
 *
 * Usage:
 *   import { logger } from "@/frontend/lib/logger";
 *   logger.info("SwipePage", "Stack loaded", { count: jobs.length });
 *   logger.error("SwipePage", "Fetch failed", err);
 *
 * In production builds (NODE_ENV=production) debug lines are suppressed.
 */

type Level = "debug" | "info" | "warn" | "error";

function stamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function log(level: Level, context: string, message: string, data?: unknown) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;

  const prefix = `[${stamp()}] [${level.toUpperCase().padEnd(5)}] [${context}]`;

  switch (level) {
    case "error":
      data !== undefined ? console.error(prefix, message, data) : console.error(prefix, message);
      break;
    case "warn":
      data !== undefined ? console.warn(prefix, message, data) : console.warn(prefix, message);
      break;
    default:
      data !== undefined ? console.log(prefix, message, data) : console.log(prefix, message);
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
