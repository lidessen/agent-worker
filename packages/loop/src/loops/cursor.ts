import type { CursorLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export class CursorLoop {
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;

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
        command: "cursor",
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

  /** Check if cursor CLI is installed. Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("cursor");
    return { ok: cli.available, version: cli.version, error: cli.error };
  }
}

function buildArgs(prompt: string, opts: CursorLoopOptions): string[] {
  const args = ["agent", "-p", prompt, "--output-format", "stream-json"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

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
