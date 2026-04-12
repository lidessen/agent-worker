/** @jsxImportSource semajsx/dom */

import { Icon, ArrowUp, ArrowDown } from "semajsx/icons";
import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./run-block.style.ts";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

export function RunBlock(props: { event: DaemonEvent }) {
  const { event } = props;
  const isStart = event.type === "workspace.agent_run_start" || event.type === "run_start";

  const durationMs = (event.durationMs as number) ?? (event.duration as number | undefined);
  const tokenCount = event.tokens as number | undefined;
  const inputTokens = event.inputTokens as number | undefined;
  const outputTokens = event.outputTokens as number | undefined;

  const hasTokenBreakdown = inputTokens !== undefined && outputTokens !== undefined;

  return (
    <div class={styles.block}>
      <span class={styles.label}>{isStart ? "Run started" : "Run completed"}</span>
      <span class={styles.divider} />
      {!isStart && durationMs !== undefined ? (
        <span class={styles.detail}>{formatDuration(durationMs)}</span>
      ) : null}
      {!isStart && hasTokenBreakdown ? (
        <span class={[styles.detail, styles.detailInline]}>
          <span class={styles.detailIcon}>
            <Icon icon={ArrowUp} size={12} />
          </span>
          {inputTokens}
          <span class={styles.detailIcon}>
            <Icon icon={ArrowDown} size={12} />
          </span>
          {outputTokens}
        </span>
      ) : !isStart && tokenCount !== undefined ? (
        <span class={styles.detail}>{tokenCount} tokens</span>
      ) : null}
    </div>
  );
}
