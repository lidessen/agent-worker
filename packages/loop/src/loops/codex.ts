import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CodexLoopOptions,
  LoopEvent,
  LoopRun,
  LoopStatus,
  PreflightResult,
} from "../types.ts";
import { createEventChannel } from "../types.ts";
import { checkCliAvailability, checkCodexAuth } from "../utils/cli.ts";
import { JsonRpcStdioClient, type JsonRpcNotification } from "../utils/jsonrpc-stdio.ts";
import { buildCodexMcpOverrides } from "../utils/mcp-config.ts";

interface CodexTurnState {
  turnId: string;
  events: LoopEvent[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  startedAt: number;
  resolve: (value: {
    events: LoopEvent[];
    usage: CodexTurnState["usage"];
    durationMs: number;
  }) => void;
  reject: (err: Error) => void;
  emit: (event: LoopEvent) => void;
}

export class CodexLoop {
  readonly supports = ["interruptible", "usageStream"] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;
  private client: JsonRpcStdioClient | null = null;
  private threadId: string | null = null;
  private threadReady = false;
  private currentTurn: CodexTurnState | null = null;
  private pendingDeveloperInstructions: string | null = null;

  constructor(private options: CodexLoopOptions = {}) {
    if (options.threadId) {
      this.threadId = options.threadId;
    } else if (options.threadIdFile) {
      // Best-effort: read a previously persisted thread id so the
      // next run of this loop instance resumes the same session.
      const existing = readThreadIdFile(options.threadIdFile);
      if (existing) this.threadId = existing;
    }
  }

  get status(): LoopStatus {
    return this._status;
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    if (this._status === "running" || this.currentTurn) throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const prompt = typeof input === "string" ? input : input.prompt;
    const developerInstructions =
      typeof input === "string" ? null : normalizeInstructions(input.system);
    if (developerInstructions !== this.pendingDeveloperInstructions) {
      this.pendingDeveloperInstructions = developerInstructions;
      this.threadReady = false;
    }
    const channel = createEventChannel<LoopEvent>();

    const emit = (event: LoopEvent) => {
      this.currentTurn?.events.push(event);
      channel.push(event);
    };

    const result = (async () => {
      try {
        await this.ensureThread();
        const turn = await new Promise<{
          events: LoopEvent[];
          usage: CodexTurnState["usage"];
          durationMs: number;
        }>((resolve, reject) => {
          void this.client!.request<{ turn: { id: string } }>("turn/start", {
            threadId: this.threadId,
            input: [{ type: "text", text: prompt, text_elements: [] }],
            cwd: this.options.cwd,
            model: this.options.model ?? undefined,
          })
            .then((response) => {
              this.currentTurn = {
                turnId: response.turn.id,
                events: [],
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                startedAt: Date.now(),
                resolve,
                reject,
                emit,
              };
              if (this.abortController?.signal.aborted) {
                this.interruptCurrentTurn();
              }
            })
            .catch((err) => {
              reject(err instanceof Error ? err : new Error(String(err)));
            });
        });

        if (this._status === "running") this._status = "completed";
        channel.end();
        return turn;
      } catch (err) {
        this._status = this.abortController?.signal.aborted ? "cancelled" : "failed";
        channel.error(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    })();

    result.catch(() => {});

    return {
      [Symbol.asyncIterator]() {
        return channel.iterable[Symbol.asyncIterator]();
      },
      result,
    };
  }

  cancel(): void {
    this.abortController?.abort();
    this.interruptCurrentTurn();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setMcpConfig(configPath: string): void {
    this._mcpConfigPath = configPath;
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
    this.threadReady = false;
  }

  async interrupt(input: string): Promise<void> {
    if (!this.currentTurn || !this.client || !this.threadId) {
      throw new Error("No active turn to interrupt");
    }

    await this.client.request("turn/steer", {
      threadId: this.threadId,
      expectedTurnId: this.currentTurn.turnId,
      input: [{ type: "text", text: input, text_elements: [] }],
    });
  }

  cleanup(): Promise<void> {
    this.client?.close();
    this.client = null;
    this.threadId = null;
    this.threadReady = false;
    return Promise.resolve();
  }

  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("codex");
    if (!cli.available) return { ok: false, version: cli.version, error: cli.error };

    const auth = await checkCodexAuth();
    if (!auth.authenticated) {
      return { ok: false, version: cli.version, error: auth.error ?? "Not authenticated" };
    }

    return { ok: true, version: cli.version };
  }

  private interruptCurrentTurn(): void {
    if (!this.currentTurn || !this.client || !this.threadId) return;
    void this.client
      .request("turn/interrupt", {
        threadId: this.threadId,
        turnId: this.currentTurn.turnId,
      })
      .catch(() => {});
  }

  private async ensureThread(): Promise<void> {
    if (!this.client) {
      const args = ["app-server", "--listen", "stdio://"];
      if (this._mcpConfigPath) args.push(...buildCodexMcpOverrides(this._mcpConfigPath));

      this.client = new JsonRpcStdioClient({
        command: "codex",
        args,
        cwd: this.options.cwd,
        env: this.options.env,
      });
      this.client.start((msg) => this.handleNotification(msg));
      await this.client.request("initialize", {
        clientInfo: { name: "agent-worker", title: "agent-worker", version: "0.0.1" },
        capabilities: null,
      });
    }

    if (!this.threadReady) {
      const request = this.threadId ? "thread/resume" : "thread/start";
      const response = await this.client.request<{
        thread: { id: string };
      }>(request, {
        cwd: this.options.cwd,
        model: this.options.model ?? undefined,
        threadId: this.threadId ?? undefined,
        approvalPolicy: this.options.fullAuto ? "never" : "on-request",
        sandbox: this.options.sandbox ?? (this.options.fullAuto ? "workspace-write" : undefined),
        developerInstructions: this.pendingDeveloperInstructions ?? undefined,
        baseInstructions: this.options.instructions ?? undefined,
        experimentalRawEvents: false,
        persistExtendedHistory: false,
      });
      const prevThreadId = this.threadId;
      this.threadId = response.thread.id;
      this.threadReady = true;
      // Persist the (possibly new) thread id so the next daemon
      // run resumes it. Only write when it actually changed.
      if (this.options.threadIdFile && this.threadId !== prevThreadId) {
        writeThreadIdFile(this.options.threadIdFile, this.threadId);
      }
    }
  }

  private handleNotification(message: JsonRpcNotification): void {
    const turn = this.currentTurn;
    if (!turn) return;

    switch (message.method) {
      case "item/agentMessage/delta": {
        const params = message.params as { turnId?: string; delta?: string };
        if (params.turnId !== turn.turnId || !params.delta) return;
        turn.emit({ type: "text", text: params.delta });
        return;
      }

      case "item/reasoning/textDelta":
      case "item/reasoning/summaryTextDelta": {
        const params = message.params as { turnId?: string; delta?: string };
        if (params.turnId !== turn.turnId || !params.delta) return;
        turn.emit({ type: "thinking", text: params.delta });
        return;
      }

      case "item/started": {
        const params = message.params as { turnId?: string; item?: Record<string, unknown> };
        if (params.turnId !== turn.turnId || !params.item) return;
        const started = mapCodexItemStart(params.item);
        if (started) turn.emit(started);
        return;
      }

      case "item/completed": {
        const params = message.params as { turnId?: string; item?: Record<string, unknown> };
        if (params.turnId !== turn.turnId || !params.item) return;
        const completed = mapCodexItemEnd(params.item);
        if (completed) turn.emit(completed);
        return;
      }

      case "thread/tokenUsage/updated": {
        const params = message.params as {
          turnId?: string;
          tokenUsage?: {
            /** Running total for the whole turn. Preferred when present. */
            cumulative?: {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            };
            /** Most recent API call's incremental usage. Fallback. */
            last?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
          };
        };
        if (params.turnId !== turn.turnId) return;
        // Prefer the cumulative field if the server provides it — "last" is the
        // incremental delta for the most recent API call and is not safe to
        // take-as-latest across multi-step turns. Fall back to "last" for
        // older app-server builds that only expose it.
        const snapshot = params.tokenUsage?.cumulative ?? params.tokenUsage?.last;
        if (!snapshot) return;
        turn.usage = {
          inputTokens: snapshot.inputTokens ?? 0,
          outputTokens: snapshot.outputTokens ?? 0,
          totalTokens: snapshot.totalTokens ?? 0,
        };
        turn.emit({
          type: "usage",
          inputTokens: turn.usage.inputTokens,
          outputTokens: turn.usage.outputTokens,
          totalTokens: turn.usage.totalTokens,
          source: "runtime",
        });
        return;
      }

      case "error": {
        const params = message.params as { message?: string };
        turn.reject(new Error(params.message ?? "codex app-server error"));
        this.currentTurn = null;
        return;
      }

      case "turn/completed": {
        const params = message.params as {
          turn?: { id?: string; status?: string; error?: { message?: string } | null };
        };
        if (params.turn?.id !== turn.turnId) return;
        switch (params.turn.status) {
          case "completed":
            turn.resolve({
              events: turn.events,
              usage: turn.usage,
              durationMs: Date.now() - turn.startedAt,
            });
            break;
          case "interrupted":
            turn.reject(new Error(params.turn.error?.message ?? "turn interrupted"));
            break;
          case "failed":
          default:
            turn.reject(new Error(params.turn.error?.message ?? "turn failed"));
            break;
        }
        this.currentTurn = null;
      }
    }
  }
}

/** @internal Exported for tests migrating off the old CLI wrapper. */
export function buildArgs(
  _prompt: string,
  opts: CodexLoopOptions,
  mcpConfigPath?: string | null,
): string[] {
  const args: string[] = [];
  if (opts.allowedPaths?.length) {
    for (const p of opts.allowedPaths) args.push("--add-dir", p);
  }
  if (mcpConfigPath) args.push(...buildCodexMcpOverrides(mcpConfigPath));
  return args;
}

export function mapCodexItemStart(item: Record<string, unknown>): LoopEvent | null {
  switch (item.type) {
    case "mcpToolCall":
      return {
        type: "tool_call_start",
        name: String(item.tool ?? "unknown"),
        callId: String(item.id ?? ""),
        args: (item.arguments as Record<string, unknown> | undefined) ?? {},
      };
    case "dynamicToolCall":
      return {
        type: "tool_call_start",
        name: String(item.tool ?? "unknown"),
        callId: String(item.id ?? ""),
        args: (item.arguments as Record<string, unknown> | undefined) ?? {},
      };
    case "commandExecution":
      return {
        type: "tool_call_start",
        name: "shell",
        callId: String(item.id ?? ""),
        args: {
          command: item.command,
          cwd: item.cwd,
        },
      };
    case "fileChange":
      return {
        type: "tool_call_start",
        name: "apply_patch",
        callId: String(item.id ?? ""),
      };
    default:
      return null;
  }
}

export function mapCodexItemEnd(item: Record<string, unknown>): LoopEvent | null {
  switch (item.type) {
    case "mcpToolCall":
      return {
        type: "tool_call_end",
        name: String(item.tool ?? "unknown"),
        callId: String(item.id ?? ""),
        result: item.error ? null : (item.result ?? null),
        durationMs: typeof item.durationMs === "number" ? item.durationMs : undefined,
        error: item.error ? JSON.stringify(item.error) : undefined,
      };
    case "dynamicToolCall":
      return {
        type: "tool_call_end",
        name: String(item.tool ?? "unknown"),
        callId: String(item.id ?? ""),
        result: item.contentItems ?? null,
        durationMs: typeof item.durationMs === "number" ? item.durationMs : undefined,
        error: item.success === false ? "dynamic tool call failed" : undefined,
      };
    case "commandExecution":
      return {
        type: "tool_call_end",
        name: "shell",
        callId: String(item.id ?? ""),
        result: item.aggregatedOutput ?? "",
        durationMs: typeof item.durationMs === "number" ? item.durationMs : undefined,
        error:
          item.status === "failed" ? `command failed (${item.exitCode ?? "unknown"})` : undefined,
      };
    case "fileChange":
      return {
        type: "tool_call_end",
        name: "apply_patch",
        callId: String(item.id ?? ""),
        result: item.changes ?? [],
        error: item.status && item.status !== "applied" ? String(item.status) : undefined,
      };
    default:
      return null;
  }
}

function normalizeInstructions(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

// ── Thread id persistence helpers ────────────────────────────────────────────
//
// The Codex app-server assigns a thread id on `thread/start` and
// lets us reattach later with `thread/resume`. Persisting that id
// across daemon restarts is what gives workspace-managed codex
// agents session continuity. The file format is intentionally
// trivial (`{"threadId":"thr_..."}`) so it's easy to inspect or
// hand-edit from a shell.

function readThreadIdFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as { threadId?: unknown };
    if (typeof parsed.threadId === "string" && parsed.threadId.length > 0) {
      return parsed.threadId;
    }
  } catch {
    // Corrupt file → treat as no prior session. The next
    // `thread/start` will mint a fresh id and overwrite this file.
  }
  return null;
}

function writeThreadIdFile(path: string, threadId: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ threadId }, null, 2));
  } catch (err) {
    // Best-effort: losing thread continuity on a file write
    // failure is strictly better than throwing mid-run.
    console.error(
      `[CodexLoop] failed to persist thread id to ${path}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
