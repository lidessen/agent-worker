/**
 * Logger - Rich terminal logging utility for SemaJSX
 *
 * @example
 * ```tsx
 * import { logger } from "@semajsx/logger";
 *
 * // Basic logging
 * logger.info("Server started");
 * logger.success("Build complete!");
 * logger.warn("Deprecated API usage");
 * logger.error("Connection failed");
 *
 * // Structured data
 * logger.info({ user: "alice", action: "login" });
 *
 * // JSX content
 * logger.info(
 *   <box>
 *     <text color="green">Custom</text>
 *     <text bold> styled </text>
 *     <text color="blue">content</text>
 *   </box>
 * );
 *
 * // Groups
 * logger.group("Database Migration");
 * logger.info("Creating tables...");
 * logger.success("Tables created");
 * logger.groupEnd();
 *
 * // Tables
 * logger.table([
 *   { name: "Alice", age: 30, role: "Admin" },
 *   { name: "Bob", age: 25, role: "User" },
 * ]);
 *
 * // Progress
 * logger.progress(75, 100, "Building");
 *
 * // Timing
 * const timer = logger.time("Database Query");
 * // ... do work ...
 * timer.end();
 *
 * // Async timing
 * await logger.measure("API Call", async () => {
 *   return await fetch("https://api.example.com");
 * });
 *
 * // Tags
 * const dbLogger = logger.withTags("database", "production");
 * dbLogger.info("Query executed"); // Shows tags
 *
 * // Child loggers
 * const apiLogger = logger.child("api");
 * apiLogger.info("Request received"); // [api] Request received
 * ```
 */

export { Logger, createLogger, logger } from "./logger";
export type {
  LoggerOptions,
  LogLevel,
  LogLevelConfig,
  GroupOptions,
  TableOptions,
  ProgressOptions,
  TimerResult,
  LogData,
} from "./types";
