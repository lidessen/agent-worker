import type { CliLoopOptions, LoopEvent, LoopResult, LoopRun, TokenUsage } from "../types.ts";
import { createEventChannel } from "../types.ts";
import { spawnCli } from "./cli.ts";
import { createStreamParser } from "./stream-parser.ts";

/** Internal event type that includes usage (not exposed to timeline) */
export type RawCliEvent = LoopEvent | { type: "usage"; usage: TokenUsage } | null;

export interface CliLoopConfig {
  command: string;
  args: string[];
  /** Extra environment variables for the CLI process */
  env?: Record<string, string>;
  mapEvent: (data: unknown) => RawCliEvent | RawCliEvent[];
  extractResult: (stdout: string) => string;
}

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

    const handleRaw = (raw: RawCliEvent) => {
      if (!raw) return;

      if (raw.type === "usage") {
        usage.inputTokens += raw.usage.inputTokens;
        usage.outputTokens += raw.usage.outputTokens;
        usage.totalTokens += raw.usage.totalTokens;
        return;
      }

      emit(raw);
      if (raw.type === "text") hasContent = true;
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
        idleTimeout: options.idleTimeout ?? 60_000,
        onStdout: (chunk) => parser.push(chunk),
      });

      parser.flush();

      if (!hasContent) {
        const text = config.extractResult(spawnResult.stdout);
        if (text) emit({ type: "text", text });
      }

      if (spawnResult.exitCode !== 0 && !callOptions.abortSignal?.aborted) {
        const error = new Error(
          spawnResult.stderr || `Process exited with code ${spawnResult.exitCode}`,
        );
        emit({ type: "error", error });
        channel.error(error);
        throw error;
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
