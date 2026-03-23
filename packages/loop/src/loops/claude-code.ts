import type { ClaudeCodeLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability, checkClaudeCodeAuth } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export type ClaudeCodeModel = "opus" | "sonnet" | "haiku";

export class ClaudeCodeLoop {
  readonly supports = [] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;

  constructor(private options: ClaudeCodeLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    const prompt = typeof input === "string" ? input : `${input.system}\n\n${input.prompt}`;
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const loopRun = runCliLoop(
      {
        command: "claude",
        args: buildArgs(prompt, this.options, this._mcpConfigPath),
        env: this.options.env,
        mapEvent: mapClaudeEvent,
        extractResult: extractClaudeResult,
      },
      this.options,
      { abortSignal: this.abortController.signal },
    );

    loopRun.result
      .then(() => {
        if (this._status === "running") this._status = "completed";
      })
      .catch(() => {
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

  /** Check if claude CLI is installed and authenticated. Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("claude");
    if (!cli.available) return { ok: false, version: cli.version, error: cli.error };

    const auth = await checkClaudeCodeAuth();
    if (!auth.authenticated) {
      return { ok: false, version: cli.version, error: auth.error ?? "Not authenticated" };
    }

    return { ok: true, version: cli.version };
  }
}

function buildArgs(
  prompt: string,
  opts: ClaudeCodeLoopOptions,
  mcpConfigPath?: string | null,
): string[] {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.instructions) args.push("--system-prompt", opts.instructions);
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.permissionMode === "acceptEdits" || opts.permissionMode === "bypassPermissions") {
    args.push("--dangerously-skip-permissions");
  }
  if (opts.allowedPaths?.length) args.push("--add-dir", ...opts.allowedPaths);
  if (mcpConfigPath) args.push("--mcp-config", mcpConfigPath);
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

  return args;
}

function mapClaudeEvent(data: unknown): RawCliEvent | RawCliEvent[] {
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
        } else if (block.type === "thinking") {
          events.push({ type: "thinking", text: block.thinking as string });
        } else if (block.type === "text") {
          events.push({ type: "text", text: block.text as string });
        }
      }
      return events.length > 0 ? events : { type: "unknown", data: event };
    }

    case "tool":
      return {
        type: "tool_call_end",
        name: (event.tool_name as string) ?? "unknown",
        callId: event.tool_call_id as string | undefined,
        result: event.content,
      };

    case "result": {
      const usage = event.usage as Record<string, number> | undefined;
      if (usage) {
        return {
          type: "usage",
          usage: {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          },
        };
      }
      return { type: "unknown", data: event };
    }

    default:
      return { type: "unknown", data: event };
  }
}

function extractClaudeResult(stdout: string): string {
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
