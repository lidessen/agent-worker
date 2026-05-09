/**
 * Logger types and interfaces
 */

import type { VNode } from "@semajsx/core";

/**
 * Log level
 */
export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

/**
 * Log level configuration
 */
export interface LogLevelConfig {
  icon: string;
  color: string;
  borderColor?: string;
  bold?: boolean;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /**
   * Whether to show timestamps
   * @default true
   */
  timestamp?: boolean;

  /**
   * Timestamp format function
   * @default () => new Date().toLocaleTimeString()
   */
  timestampFormat?: () => string;

  /**
   * Whether to show log level
   * @default true
   */
  showLevel?: boolean;

  /**
   * Minimum log level to display
   * @default "debug"
   */
  minLevel?: LogLevel;

  /**
   * Custom prefix for all logs
   */
  prefix?: string;

  /**
   * Output stream
   * @default process.stdout
   */
  stream?: NodeJS.WriteStream;

  /**
   * Whether to use borders for logs
   * @default false
   */
  bordered?: boolean;

  /**
   * Custom level configurations
   */
  levelConfig?: Partial<Record<LogLevel, Partial<LogLevelConfig>>>;
}

/**
 * Group options
 */
export interface GroupOptions {
  /**
   * Whether to show border around group
   * @default false
   */
  bordered?: boolean;

  /**
   * Border/underline color
   * @default "cyan"
   */
  borderColor?: string;

  /**
   * Whether the group is collapsed
   * @default false
   */
  collapsed?: boolean;
}

/**
 * Table options
 */
export interface TableOptions {
  /**
   * Column headers
   */
  headers?: string[];

  /**
   * Border style
   * @default "single"
   */
  border?: "single" | "double" | "round" | "bold" | "none";

  /**
   * Border color
   */
  borderColor?: string;

  /**
   * Whether to show header separator
   * @default true
   */
  headerSeparator?: boolean;
}

/**
 * Progress bar options
 */
export interface ProgressOptions {
  /**
   * Progress bar width
   * @default 40
   */
  width?: number;

  /**
   * Progress bar character
   * @default "█"
   */
  char?: string;

  /**
   * Empty character
   * @default "░"
   */
  emptyChar?: string;

  /**
   * Whether to show percentage
   * @default true
   */
  showPercentage?: boolean;

  /**
   * Progress bar color
   */
  color?: string;
}

/**
 * Timer result
 */
export interface TimerResult {
  /**
   * End the timer and log the duration
   */
  end: (message?: string) => void;

  /**
   * Get elapsed time in milliseconds
   */
  elapsed: () => number;
}

/**
 * Data to log (can be string, object, or JSX)
 */
export type LogData = string | Record<string, unknown> | VNode;
