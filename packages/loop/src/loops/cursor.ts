import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import type { CursorLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export class CursorLoop {
  readonly supports = ["usageStream"] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;
  private _mcpSnapshot: McpSnapshot | null = null;

  constructor(private options: CursorLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    const prompt = typeof input === "string" ? input : `${input.system}\n\n${input.prompt}`;
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    // Cursor agent detects MCP servers from .cursor/mcp.json in the cwd.
    // Inject the agent MCP config before starting the CLI process.
    if (this._mcpConfigPath) {
      this._mcpSnapshot = injectCursorMcpConfig(
        this._mcpConfigPath,
        this.options.cwd ?? process.cwd(),
      );
    }

    const loopRun = runCliLoop(
      {
        command: "agent",
        args: buildArgs(prompt, this.options),
        env: this.options.env,
        mapEvent: mapCursorEvent,
        extractResult: extractCursorResult,
        // Cursor doesn't report token counts. Opt in to the cli-loop's
        // post-hoc text-length estimate so consumers that care about
        // context pressure have something to work with.
        estimateUsage: true,
      },
      this.options,
      { abortSignal: this.abortController.signal },
    );

    loopRun.result
      .then(() => {
        this.cleanupMcpConfig();
        if (this._status === "running") this._status = "completed";
      })
      .catch(() => {
        this.cleanupMcpConfig();
        if (this._status === "running") {
          this._status = this.abortController!.signal.aborted ? "cancelled" : "failed";
        }
      });

    return loopRun;
  }

  cancel(): void {
    this.abortController?.abort();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setMcpConfig(configPath: string): void {
    this._mcpConfigPath = configPath;
  }

  private cleanupMcpConfig(): void {
    if (this._mcpSnapshot) {
      restoreCursorMcpConfig(this._mcpSnapshot);
      this._mcpSnapshot = null;
    }
  }

  /** Check if agent CLI (Cursor Agent) is installed. Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("agent");
    return { ok: cli.available, version: cli.version, error: cli.error };
  }
}

function buildArgs(prompt: string, opts: CursorLoopOptions): string[] {
  // `agent` CLI: prompt is positional, `-p`/`--print` is a boolean flag for headless mode,
  // `--yolo` skips workspace trust + auto-approves commands.
  const args = ["-p", "--output-format", "stream-json", "--yolo", "--approve-mcps"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

  // Prompt must come last (positional argument)
  // Note: Cursor has no --add-dir flag. allowedPaths passed via AGENT_ALLOWED_PATHS env var.
  args.push(prompt);

  return args;
}

function mapCursorEvent(data: unknown): RawCliEvent | RawCliEvent[] {
  const event = data as Record<string, unknown>;
  const type = event.type as string;

  switch (type) {
    case "assistant": {
      const message = event.message as Record<string, unknown> | undefined;
      const content = message?.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) return { type: "unknown", data: event };

      const events: RawCliEvent[] = [];
      for (const block of content) {
        if (block.type === "tool_use") {
          events.push({
            type: "tool_call_start",
            name: block.name as string,
            callId: block.id as string,
            args: block.input as Record<string, unknown>,
          });
        } else if (block.type === "text") {
          events.push({ type: "text", text: block.text as string });
        }
      }
      return events.length > 0 ? events : { type: "unknown", data: event };
    }

    case "tool_call": {
      const subtype = event.subtype as string;
      const toolCall = (event.tool_call as Record<string, unknown>) ?? {};
      const mcpCall = (toolCall.mcpToolCall as Record<string, unknown>) ?? {};
      const mcpArgs = (mcpCall.args as Record<string, unknown>) ?? {};
      const callId = event.call_id as string | undefined;

      if (subtype === "started") {
        return {
          type: "tool_call_start",
          name: (mcpArgs.toolName as string) ?? (mcpArgs.name as string) ?? "unknown",
          callId: callId ?? "",
          args: (mcpArgs.args as Record<string, unknown>) ?? {},
        };
      }
      if (subtype === "completed") {
        const result = mcpCall.result as Record<string, unknown> | undefined;
        const success = result?.success as Record<string, unknown> | undefined;
        const content = success?.content as Array<Record<string, unknown>> | undefined;
        const text = content?.[0]?.text as Record<string, unknown> | undefined;
        return {
          type: "tool_call_end",
          name: (mcpArgs?.toolName as string) ?? "unknown",
          callId: callId ?? "",
          result: (text?.text as string) ?? "",
        };
      }
      return { type: "unknown", data: event };
    }

    case "thinking": {
      const subtype = event.subtype as string;
      if (subtype === "delta") {
        const text = event.text as string;
        if (text) return { type: "thinking", text };
      }
      return { type: "unknown", data: event };
    }

    case "result": {
      const resultText = event.result as string;
      if (resultText) {
        return { type: "text", text: resultText };
      }
      return { type: "unknown", data: event };
    }

    default:
      return { type: "unknown", data: event };
  }
}

function extractCursorResult(stdout: string): string {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
      if (parsed.type === "result" && typeof parsed.result === "string") {
        return parsed.result;
      }
    } catch {
      // skip
    }
  }
  return stdout;
}

// ── Cursor MCP config injection ──────────────────────────────────────────────
//
// Cursor agent has no --mcp-config flag. It discovers MCP servers from
// .cursor/mcp.json in the working directory. We save a snapshot of the
// original file before injecting, and restore it exactly on cleanup.

interface McpSnapshot {
  cursorMcpPath: string;
  /** null means the file did not exist before injection. */
  originalContent: string | null;
  /** The content we wrote, used to detect external modifications during cleanup. */
  injectedContent: string;
}

/**
 * Inject agent MCP servers into .cursor/mcp.json, saving a snapshot
 * of the original file for exact restoration on cleanup.
 */
function injectCursorMcpConfig(configPath: string, cwd: string): McpSnapshot {
  const agentConfig = JSON.parse(readFileSync(configPath, "utf-8")) as {
    mcpServers?: Record<string, unknown>;
  };
  const cursorDir = join(cwd, ".cursor");
  const cursorMcpPath = join(cursorDir, "mcp.json");

  let originalContent: string | null = null;
  let existing: Record<string, unknown> = {};

  if (existsSync(cursorMcpPath)) {
    originalContent = readFileSync(cursorMcpPath, "utf-8");
    existing = JSON.parse(originalContent) as Record<string, unknown>;
  } else {
    mkdirSync(cursorDir, { recursive: true });
  }

  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers as Record<string, unknown>),
      ...agentConfig.mcpServers,
    },
  };

  const injectedContent = JSON.stringify(merged, null, 2);
  writeFileSync(cursorMcpPath, injectedContent);
  return { cursorMcpPath, originalContent, injectedContent };
}

/** Restore .cursor/mcp.json to its pre-injection state. */
function restoreCursorMcpConfig(snapshot: McpSnapshot): void {
  try {
    // If the file was modified externally since we wrote it, leave it alone.
    if (!existsSync(snapshot.cursorMcpPath)) return;
    const current = readFileSync(snapshot.cursorMcpPath, "utf-8");
    if (current !== snapshot.injectedContent) return;

    if (snapshot.originalContent === null) {
      // File didn't exist before — remove it and try to clean up .cursor/
      unlinkSync(snapshot.cursorMcpPath);
      try {
        rmdirSync(join(snapshot.cursorMcpPath, ".."));
      } catch {
        // .cursor/ has other files, leave it
      }
    } else {
      writeFileSync(snapshot.cursorMcpPath, snapshot.originalContent);
    }
  } catch {
    // Best-effort cleanup
  }
}
