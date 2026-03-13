import type { CursorLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export class CursorLoop {
  readonly supports = [] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;

  constructor(private options: CursorLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(prompt: string): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const loopRun = runCliLoop(
      {
        command: "agent",
        args: buildArgs(prompt, this.options),
        mapEvent: mapCursorEvent,
        extractResult: extractCursorResult,
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

  /** Check if agent CLI (Cursor Agent) is installed. Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("agent");
    return { ok: cli.available, version: cli.version, error: cli.error };
  }
}

function buildArgs(prompt: string, opts: CursorLoopOptions): string[] {
  // `agent` CLI: prompt is positional, `-p`/`--print` is a boolean flag for headless mode,
  // `--yolo` skips workspace trust + auto-approves commands.
  const args = ["-p", "--output-format", "stream-json", "--yolo"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

  // Prompt must come last (positional argument)
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
      if (!Array.isArray(content)) return null;

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
      return events.length === 1 ? events[0]! : events.length > 1 ? events : null;
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

    case "result": {
      const resultText = event.result as string;
      if (resultText) {
        return { type: "text", text: resultText };
      }
      return null;
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
