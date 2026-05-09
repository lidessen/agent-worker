// ── Status ──────────────────────────────────────────────────────────────────

export type LoopStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

// ── Timeline events ────────────────────────────────────────────────────────

export type LoopEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "hook";
      phase: "started" | "progress" | "response";
      name: string;
      hookEvent: string;
      output?: string;
      stdout?: string;
      stderr?: string;
      outcome?: "success" | "error" | "cancelled";
    }
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
  | {
      /**
       * Cumulative token usage for the current turn/run, emitted as the runtime
       * learns about it. Not all runtimes support mid-stream usage — check the
       * loop's `supports` for `"usageStream"`. Consumers should treat the numbers
       * as cumulative (take last/max, not sum) across multiple events in one run.
       */
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      /** Model context window limit, if the runtime reports it. */
      contextWindow?: number;
      /** totalTokens / contextWindow when contextWindow is known. */
      usedRatio?: number;
      /** "runtime" = reported by the provider; "estimate" = computed locally. */
      source: "runtime" | "estimate";
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
              await new Promise<void>((r) => {
                resolve = r;
              });
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
  /** Additional directories the agent is allowed to access beyond cwd. */
  allowedPaths?: string[];
  /** Extra CLI arguments */
  extraArgs?: string[];
  /** Extra environment variables for the CLI subprocess (merged on top of process.env). */
  env?: Record<string, string>;
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
  /** Route app-server approval requests. Defaults to Codex app-server behavior. */
  approvalsReviewer?: "user" | "auto_review" | "guardian_subagent";
  /** Service tier override for Codex turns. */
  serviceTier?: "fast" | "flex";
  /** Reasoning effort override for Codex turns. */
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  /** Reasoning summary style override for Codex turns. */
  summary?: "auto" | "concise" | "detailed" | "none";
  /**
   * Optional JSON Schema used by Codex app-server to constrain the final
   * assistant message for each turn.
   */
  outputSchema?: Record<string, unknown>;
  /**
   * Newer per-turn sandbox policy shape accepted by Codex app-server.
   * Keep `sandbox` for thread-level legacy shorthand; use this only when
   * the caller has already resolved the full app-server policy object.
   */
  sandboxPolicy?: Record<string, unknown>;
  /** Resume an existing app-server thread. */
  threadId?: string;
  /**
   * Optional path to a JSON file where the active thread id is
   * persisted. The file format is `{"threadId":"thr_..."}`. When
   * provided, CodexLoop reads it eagerly at construction time to
   * seed `threadId`, and rewrites it whenever a new thread is
   * opened via `thread/start`. Enables session continuity across
   * daemon restarts. See docs/design/phase-2-session-continuity.
   */
  threadIdFile?: string;
}

export type CursorSettingSource = "project" | "user" | "team" | "mdm" | "plugins" | "all";

export interface CursorLoopOptions extends CliLoopOptions {
  /** Cursor API key. Falls back to env.CURSOR_API_KEY or process.env.CURSOR_API_KEY. */
  apiKey?: string;
  /** Persisted Cursor agent id, if the caller wants SDK-level local continuity. */
  agentId?: string;
  /** Cursor local settings layers to load for SDK runs. */
  settingSources?: CursorSettingSource[];
  /** Cursor SDK local sandbox toggle. */
  sandboxEnabled?: boolean;
  /** If true, preflight verifies the API key against Cursor's API. */
  preflightOnline?: boolean;
}

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
