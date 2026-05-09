/** @jsxImportSource @semajsx/dom */

import type { ChatEvent } from "../types";
import * as styles from "./run-block.style";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

export function RunBlock(props: { event: ChatEvent }) {
  const { event } = props;
  const isStart = event.type === "run_start" || (event.type as string).endsWith("_run_start");

  const durationMs = (event.durationMs as number) ?? (event.duration as number | undefined);
  const tokenCount = event.tokens as number | undefined;
  const inputTokens = event.inputTokens as number | undefined;
  const outputTokens = event.outputTokens as number | undefined;

  let tokenDisplay: string | null = null;
  if (inputTokens !== undefined && outputTokens !== undefined) {
    tokenDisplay = `\u2191${inputTokens} \u2193${outputTokens}`;
  } else if (tokenCount !== undefined) {
    tokenDisplay = `${tokenCount} tokens`;
  }

  return (
    <div class={styles.block}>
      <span class={styles.label}>{isStart ? "Run started" : "Run completed"}</span>
      <span class={styles.divider} />
      {!isStart && durationMs !== undefined ? (
        <span class={styles.detail}>{formatDuration(durationMs)}</span>
      ) : null}
      {!isStart && tokenDisplay ? <span class={styles.detail}>{tokenDisplay}</span> : null}
    </div>
  );
}
