/** @jsxImportSource @semajsx/terminal */

/**
 * Logger - A rich terminal logging utility built on SemaJSX terminal
 *
 * Features:
 * - Beautiful visual styling with colors and icons
 * - Structured logging with tables and progress bars
 * - Grouping and indentation
 * - Performance timing
 * - Tag/label support
 * - JSX content support
 */

import type { VNode } from "@semajsx/core";
import { print } from "@semajsx/terminal";
import type {
  GroupOptions,
  LogData,
  LoggerOptions,
  LogLevel,
  LogLevelConfig,
  ProgressOptions,
  TableOptions,
  TimerResult,
} from "./types";

/**
 * Default log level configurations
 */
const DEFAULT_LEVEL_CONFIG: Record<LogLevel, LogLevelConfig> = {
  debug: { icon: "?", color: "gray", bold: false },
  info: { icon: "i", color: "cyan", bold: false },
  success: { icon: "+", color: "green", bold: true },
  warn: { icon: "!", color: "yellow", bold: true },
  error: { icon: "x", color: "red", bold: true, borderColor: "red" },
};

/**
 * Log level priorities (for filtering)
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

/**
 * Logger class
 */
export class Logger {
  private options: Required<Omit<LoggerOptions, "levelConfig" | "timestampFormat">> & {
    timestampFormat: () => string;
    levelConfig: Record<LogLevel, LogLevelConfig>;
  };
  private groupDepth = 0;
  private tags: string[] = [];
  private groupStack: Array<{
    title: string;
    color: string;
    bordered: boolean;
  }> = [];

  constructor(options: LoggerOptions = {}) {
    this.options = {
      timestamp: options.timestamp ?? true,
      timestampFormat: options.timestampFormat || (() => new Date().toLocaleTimeString()),
      showLevel: options.showLevel ?? true,
      minLevel: options.minLevel || "debug",
      prefix: options.prefix || "",
      stream: options.stream || process.stdout,
      bordered: options.bordered || false,
      levelConfig: this.mergeLevelConfig(options.levelConfig),
    };
  }

  /**
   * Merge custom level config with defaults
   */
  private mergeLevelConfig(
    custom?: Partial<Record<LogLevel, Partial<LogLevelConfig>>>,
  ): Record<LogLevel, LogLevelConfig> {
    if (!custom) return DEFAULT_LEVEL_CONFIG;

    const merged = { ...DEFAULT_LEVEL_CONFIG };
    for (const [level, config] of Object.entries(custom)) {
      merged[level as LogLevel] = {
        ...DEFAULT_LEVEL_CONFIG[level as LogLevel],
        ...config,
      };
    }
    return merged;
  }

  /**
   * Check if log level should be displayed
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.options.minLevel];
  }

  /**
   * Format log data to string
   */
  private formatData(data: LogData): string {
    if (typeof data === "string") {
      return data;
    }
    if (typeof data === "object" && "type" in data) {
      // It's a VNode, can't stringify
      return "[JSX Content]";
    }
    // Format JSON with newline before opening brace
    const json = JSON.stringify(data, null, 2);
    return "\n" + json;
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, data: LogData, ...args: LogData[]): void {
    if (!this.shouldLog(level)) return;

    const config = this.options.levelConfig[level];

    // Build log parts
    const parts: VNode[] = [];

    // Timestamp
    if (this.options.timestamp) {
      parts.push(
        <text dim marginRight={1}>
          [{this.options.timestampFormat()}]
        </text>,
      );
    }

    // Level with icon
    if (this.options.showLevel) {
      parts.push(
        <text color={config.color} bold={config.bold} marginRight={1}>
          {config.icon} {level.toUpperCase()}
        </text>,
      );
    }

    // Prefix
    if (this.options.prefix) {
      parts.push(
        <text marginRight={1} color="magenta" bold>
          [{this.options.prefix}]
        </text>,
      );
    }

    // Tags
    if (this.tags.length > 0) {
      parts.push(
        <text marginRight={1} color="blue">
          {this.tags.map((tag) => `#${tag}`).join(" ")}
        </text>,
      );
    }

    // Main content
    if (typeof data === "object" && "type" in data) {
      // It's JSX - render it directly
      parts.push(data as VNode);
    } else {
      const content = this.formatData(data);
      parts.push(<text>{content}</text>);
    }

    // Additional arguments
    if (args.length > 0) {
      for (const arg of args) {
        const formatted = this.formatData(arg);
        parts.push(
          <text marginLeft={1} dim>
            {formatted}
          </text>,
        );
      }
    }

    // Render the log
    const logContent = <box flexDirection="row">{parts}</box>;

    if (this.options.bordered && config.borderColor) {
      print(
        <box border="round" borderColor={config.borderColor} paddingInline={1}>
          {logContent}
        </box>,
        { stream: this.options.stream },
      );
    } else {
      print(logContent, { stream: this.options.stream });
    }
  }

  /**
   * Debug log
   */
  debug(data: LogData, ...args: LogData[]): this {
    this.log("debug", data, ...args);
    return this;
  }

  /**
   * Info log
   */
  info(data: LogData, ...args: LogData[]): this {
    this.log("info", data, ...args);
    return this;
  }

  /**
   * Success log
   */
  success(data: LogData, ...args: LogData[]): this {
    this.log("success", data, ...args);
    return this;
  }

  /**
   * Warning log
   */
  warn(data: LogData, ...args: LogData[]): this {
    this.log("warn", data, ...args);
    return this;
  }

  /**
   * Error log
   */
  error(data: LogData, ...args: LogData[]): this {
    this.log("error", data, ...args);
    return this;
  }

  /**
   * Start a log group
   */
  group(title: string, options: GroupOptions = {}): this {
    const { bordered = false, borderColor = "cyan" } = options;

    // Store group info for groupEnd
    this.groupStack.push({ title, color: borderColor, bordered });

    if (bordered) {
      // Bordered style - box with title
      print(
        <box border="round" borderColor={borderColor} paddingInline={1}>
          <text bold color={borderColor}>
            {title}
          </text>
        </box>,
        { stream: this.options.stream },
      );
    } else {
      // Default style - title with underline
      print(
        <box flexDirection="column">
          <text bold color={borderColor}>
            {title}
          </text>
          <text color={borderColor} dim>
            {"─".repeat(Math.min(title.length, 50))}
          </text>
        </box>,
        { stream: this.options.stream },
      );
    }

    this.groupDepth++;
    return this;
  }

  /**
   * End a log group
   */
  groupEnd(): this {
    if (this.groupDepth > 0) {
      this.groupDepth--;

      // Pop group info and draw closing line (only for non-bordered groups)
      const groupInfo = this.groupStack.pop();
      if (groupInfo && !groupInfo.bordered) {
        print(
          <text color={groupInfo.color} dim>
            {"─".repeat(Math.min(groupInfo.title.length, 50))}
          </text>,
          { stream: this.options.stream },
        );
      }
    }
    return this;
  }

  /**
   * Add tags to subsequent logs
   */
  withTags(...tags: string[]): Logger {
    const newLogger = new Logger(this.options);
    newLogger.groupDepth = this.groupDepth;
    newLogger.tags = [...this.tags, ...tags];
    newLogger.groupStack = [...this.groupStack];
    return newLogger;
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.options,
      prefix: this.options.prefix ? `${this.options.prefix}:${prefix}` : prefix,
    });
  }

  /**
   * Log a table
   */
  table(data: Record<string, unknown>[], options: TableOptions = {}): this {
    const { headers, border = "single", borderColor = "cyan", headerSeparator = true } = options;

    if (data.length === 0) {
      this.info("Empty table");
      return this;
    }

    // Get headers from first row if not provided
    const cols = headers || Object.keys(data[0] || {});

    const rows: VNode[] = [];

    // Header row
    if (headerSeparator) {
      const headerRow = (
        <box flexDirection="row">
          {cols.map((col) => (
            <text bold color={borderColor} width={20}>
              {col}
            </text>
          ))}
        </box>
      );
      rows.push(headerRow);

      // Separator
      rows.push(<text dim>{"-".repeat(cols.length * 20)}</text>);
    }

    // Data rows
    for (const row of data) {
      const dataRow = (
        <box flexDirection="row">
          {cols.map((col) => (
            <text width={20}>{String(row[col] ?? "")}</text>
          ))}
        </box>
      );
      rows.push(dataRow);
    }

    print(
      <box flexDirection="column" border={border} borderColor={borderColor} paddingInline={1}>
        {rows}
      </box>,
      { stream: this.options.stream },
    );

    return this;
  }

  /**
   * Show a progress bar
   */
  progress(current: number, total: number, label?: string, options: ProgressOptions = {}): this {
    const {
      width = 40,
      char = "█",
      emptyChar = "░",
      showPercentage = true,
      color = "green",
    } = options;

    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;

    const bar = char.repeat(filled) + emptyChar.repeat(empty);

    const content = (
      <box flexDirection="row" alignItems="center">
        {label && (
          <text marginRight={2} bold>
            {label}
          </text>
        )}
        <text color={color}>{bar}</text>
        {showPercentage && (
          <text marginLeft={2} bold color={color}>
            {percentage.toFixed(1)}%
          </text>
        )}
        <text marginLeft={2} dim>
          ({current}/{total})
        </text>
      </box>
    );

    print(content, { stream: this.options.stream });

    return this;
  }

  /**
   * Start a timer
   */
  time(label: string): TimerResult {
    const startTime = Date.now();

    return {
      end: (message?: string) => {
        const duration = Date.now() - startTime;
        this.info(
          <box flexDirection="row">
            <text bold color="magenta">
              ⏱ {label}
            </text>
            <text marginLeft={1}>took</text>
            <text marginLeft={1} bold color="cyan">
              {duration}ms
            </text>
            {message && <text marginLeft={1}>- {message}</text>}
          </box>,
        );
      },
      elapsed: () => Date.now() - startTime,
    };
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    const timer = this.time(label);
    try {
      const result = await fn();
      timer.end("✓ completed");
      return result;
    } catch (error) {
      timer.end("✗ failed");
      throw error;
    }
  }

  /**
   * Log a separator line
   */
  separator(char = "─", color = "gray"): this {
    print(<text color={color}>{char.repeat(80)}</text>, {
      stream: this.options.stream,
    });
    return this;
  }

  /**
   * Log a blank line
   */
  blank(): this {
    print(<text></text>, { stream: this.options.stream });
    return this;
  }

  /**
   * Raw JSX log (for custom content)
   */
  jsx(content: VNode): this {
    print(content, { stream: this.options.stream });
    return this;
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

/**
 * Default logger instance
 */
export const logger: Logger = createLogger();
