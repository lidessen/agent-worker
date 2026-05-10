/** @jsxImportSource semajsx/dom */

import { Icon, ArrowUp, ArrowDown } from "semajsx/icons";
import type { DaemonEvent } from "../../api/types.ts";
import * as s from "./run-block.style.ts";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m${remainSec}s`;
}

export function RunBlock(props: { event: DaemonEvent }) {
  const { event } = props;
  const isStart = event.type === "harness.agent_run_start" || event.type === "run_start";

  const durationMs = (event.durationMs as number) ?? (event.duration as number | undefined);
  const tokenCount = event.tokens as number | undefined;
  const inputTokens = event.inputTokens as number | undefined;
  const outputTokens = event.outputTokens as number | undefined;
  const runId = event.runId as string | undefined;
  const model = event.model as string | undefined;

  const hasTokenBreakdown = inputTokens !== undefined && outputTokens !== undefined;

  return (
    <div class={isStart ? [s.rail, s.railRunning] : s.rail}>
      <span class={s.dot} />
      <span class={s.label}>{isStart ? "Run started" : "Run ended"}</span>
      {runId ? <span class={s.detail}>{runId}</span> : null}
      {model ? <span class={s.detail}>· {model}</span> : null}
      {!isStart && durationMs !== undefined ? (
        <span class={s.detail}>· {formatDuration(durationMs)}</span>
      ) : null}
      {!isStart && hasTokenBreakdown ? (
        <span class={[s.detail, s.detailInline]}>
          ·
          <span class={s.detailIcon}>
            <Icon icon={ArrowUp} size={11} />
          </span>
          {inputTokens}
          <span class={s.detailIcon}>
            <Icon icon={ArrowDown} size={11} />
          </span>
          {outputTokens}
        </span>
      ) : !isStart && tokenCount !== undefined ? (
        <span class={s.detail}>· {tokenCount} tokens</span>
      ) : null}
      <span class={s.divider} />
    </div>
  );
}
