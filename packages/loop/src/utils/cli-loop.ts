import type { CliLoopOptions, LoopEvent, LoopResult, LoopRun, TokenUsage } from "../types.ts";
import { createEventChannel } from "../types.ts";
import { spawnCli } from "./cli.ts";
import { createStreamParser } from "./stream-parser.ts";

/**
 * Internal event type for CLI loop mappers. The `"usage_delta"` variant is a
 * sentinel used to accumulate per-message token deltas into the final
 * `LoopResult.usage` total — it is NOT emitted to the LoopEvent timeline.
 * For mid-stream public usage reporting, emit a real `LoopEvent` of
 * `{ type: "usage", ..., source: "runtime" }`.
 */
export type RawCliEvent = LoopEvent | { type: "usage_delta"; usage: TokenUsage } | null;

export interface CliLoopConfig {
  command: string;
  args: string[];
  /** Extra environment variables for the CLI process */
  env?: Record<string, string>;
  mapEvent: (data: unknown) => RawCliEvent | RawCliEvent[];
  extractResult: (stdout: string) => string;
  /**
   * When true, emit a post-hoc `usage` LoopEvent (with source:"estimate")
   * at the end of the run if the event stream never produced any real
   * `usage_delta` sentinels. The estimate uses an aggressive ~4 chars per
   * token rule on the accumulated text/thinking output. This is a fallback
   * for CLI runtimes that don't report token counts at all.
   */
  estimateUsage?: boolean;
}

/** Rough characters-per-token divisor for the fallback estimator. */
const ESTIMATE_CHARS_PER_TOKEN = 4;

/**
 * Run a CLI-based agent loop. Returns a LoopRun:
 * async-iterable for real-time events + .result promise.
 */
export function runCliLoop(
  config: CliLoopConfig,
  options: CliLoopOptions,
  callOptions: { abortSignal?: AbortSignal } = {},
): LoopRun {
  const channel = createEventChannel<LoopEvent>();
  const allEvents: LoopEvent[] = [];
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  const emit = (event: LoopEvent) => {
    allEvents.push(event);
    channel.push(event);
  };

  const result = (async (): Promise<LoopResult> => {
    const startTime = Date.now();
    let hasContent = false;
    let hasRealUsage = false;
    let textCharCount = 0;

    const handleRaw = (raw: RawCliEvent) => {
      if (!raw) return;

      if (raw.type === "usage_delta") {
        usage.inputTokens += raw.usage.inputTokens;
        usage.outputTokens += raw.usage.outputTokens;
        usage.totalTokens += raw.usage.totalTokens;
        hasRealUsage = true;
        return;
      }

      emit(raw);
      if (raw.type === "text") {
        hasContent = true;
        textCharCount += raw.text.length;
      } else if (raw.type === "thinking") {
        textCharCount += raw.text.length;
      }
    };

    const parser = createStreamParser<unknown>((data) => {
      const mapped = config.mapEvent(data);
      if (Array.isArray(mapped)) {
        for (const item of mapped) handleRaw(item);
      } else {
        handleRaw(mapped);
      }
    });

    try {
      const spawnResult = await spawnCli({
        command: config.command,
        args: config.args,
        cwd: options.cwd,
        env: config.env,
        signal: callOptions.abortSignal,
        idleTimeout: options.idleTimeout ?? 120_000,
        onStdout: (chunk) => parser.push(chunk),
      });

      parser.flush();

      if (!hasContent) {
        const text = config.extractResult(spawnResult.stdout);
        if (text) {
          emit({ type: "text", text });
          textCharCount += text.length;
        }
      }

      if (spawnResult.exitCode !== 0 && !callOptions.abortSignal?.aborted) {
        const error = new Error(
          spawnResult.stderr || `Process exited with code ${spawnResult.exitCode}`,
        );
        emit({ type: "error", error });
        channel.error(error);
        throw error;
      }

      // If the runtime reported no real token usage, optionally emit a
      // rough estimate so downstream pressure/context accounting has
      // something to work with. Marked source:"estimate" so consumers
      // can decide how much to trust it.
      if (config.estimateUsage && !hasRealUsage && textCharCount > 0) {
        const outputTokens = Math.ceil(textCharCount / ESTIMATE_CHARS_PER_TOKEN);
        usage.outputTokens = outputTokens;
        usage.totalTokens = outputTokens;
        emit({
          type: "usage",
          inputTokens: 0,
          outputTokens,
          totalTokens: outputTokens,
          source: "estimate",
        });
      }

      channel.end();
      return { events: allEvents, usage, durationMs: Date.now() - startTime };
    } catch (err) {
      channel.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  })();

  return {
    [Symbol.asyncIterator]() {
      return channel.iterable[Symbol.asyncIterator]();
    },
    result,
  };
}
