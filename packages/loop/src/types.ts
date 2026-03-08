// ── Status ──────────────────────────────────────────────────────────────────

export type LoopStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

// ── Timeline events ────────────────────────────────────────────────────────

export type LoopEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool_call_start";
      name: string;
      /** Present on Claude Code, Cursor, AI SDK. Absent on Codex. */
      callId?: string;
      args?: Record<string, unknown>;
    }
  | {
      /** Not all providers emit this — Cursor does not. Do not assume start/end pairs. */
      type: "tool_call_end";
      name: string;
      callId?: string;
      result?: unknown;
      durationMs?: number;
      error?: string;
    }
  | { type: "error"; error: Error }
  | { type: "unknown"; data: unknown };

// ── Token usage ─────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ── Run handle ──────────────────────────────────────────────────────────────

export interface LoopResult {
  events: LoopEvent[];
  usage: TokenUsage;
  durationMs: number;
}

/**
 * Returned by run(). Async-iterable for real-time events, with .result for final summary.
 *
 * Events are streamed as the provider produces them. Errors propagate through
 * the async iterator (thrown on next()) and also reject .result.
 *
 * **Provider differences (best-effort, not guaranteed):**
 * - `tool_call_end` depends on the provider — Claude Code and Codex emit it,
 *   Cursor does not. Do not assume start/end always come in pairs.
 * - `callId` is present on Claude Code, Cursor, and AI SDK tool events,
 *   but absent on Codex. Do not rely on callId for cross-event correlation
 *   unless you know which provider is in use.
 * - `thinking` events are only emitted by providers that support reasoning
 *   (Claude with extended thinking, AI SDK models with reasoning output).
 *
 * ```ts
 * const run = loop.run("fix bug");
 *
 * // Stream events in real-time
 * for await (const event of run) {
 *   console.log(event);
 * }
 * const result = await run.result;
 *
 * // Or just wait for everything
 * const result = await run.result;
 * ```
 */
export interface LoopRun extends AsyncIterable<LoopEvent> {
  /** Resolves when the run completes with all events + usage */
  result: Promise<LoopResult>;
}

// ── Event channel ───────────────────────────────────────────────────────────

/**
 * Push-based channel for bridging sync event producers to async iteration.
 */
export interface EventChannel<T> {
  push(event: T): void;
  end(): void;
  error(err: Error): void;
  iterable: AsyncIterable<T>;
}

export function createEventChannel<T>(): EventChannel<T> {
  const queue: T[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let rejection: Error | null = null;

  return {
    push(event: T) {
      queue.push(event);
      resolve?.();
      resolve = null;
    },

    end() {
      done = true;
      resolve?.();
      resolve = null;
    },

    error(err: Error) {
      rejection = err;
      done = true;
      resolve?.();
      resolve = null;
    },

    iterable: {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<T>> {
            while (true) {
              if (queue.length > 0) {
                return { value: queue.shift()!, done: false };
              }
              if (rejection) {
                throw rejection;
              }
              if (done) {
                return { value: undefined as unknown as T, done: true };
              }
              await new Promise<void>((r) => { resolve = r; });
            }
          },
        };
      },
    },
  };
}

// ── CLI loop options ────────────────────────────────────────────────────────

export interface CliLoopOptions {
  /** Model name/alias for the CLI tool */
  model?: string;
  /** System prompt / instructions */
  instructions?: string;
  /** Working directory for the CLI process */
  cwd?: string;
  /** Extra CLI arguments */
  extraArgs?: string[];
  /** Idle timeout in ms (kill if no output). Default: 60_000 */
  idleTimeout?: number;
}

export interface ClaudeCodeLoopOptions extends CliLoopOptions {
  /** Allowed tools for Claude Code (--allowedTools) */
  allowedTools?: string[];
  /** Permission mode */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
}

export interface CodexLoopOptions extends CliLoopOptions {
  /** Sandbox mode for shell commands */
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  /** Run in full-auto mode (no confirmations, workspace-write sandbox) */
  fullAuto?: boolean;
}

export interface CursorLoopOptions extends CliLoopOptions {}

// ── Preflight ────────────────────────────────────────────────────────────────

/**
 * Result of preflight() — checks environment config (CLI installed, API key present, auth valid).
 * This is a config/env check, not a runtime verification that the model actually works.
 */
export interface PreflightResult {
  ok: boolean;
  version?: string;
  error?: string;
}
