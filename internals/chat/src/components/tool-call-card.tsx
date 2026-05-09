/** @jsxImportSource @semajsx/dom */

import { signal, computed } from "@semajsx/signal";
import { when } from "@semajsx/core";
import type { ChatEvent } from "../types";
import { chatTokens as t } from "../theme/tokens";
import * as styles from "./tool-call-card.style";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ToolCallCard(props: { event: ChatEvent }) {
  const { event } = props;
  const expanded = signal(false);
  const resultExpanded = signal(false);

  const toolName = (event.tool as string) ?? (event.name as string) ?? "tool";
  const args = event.args ?? event.input;
  const result = event.result ?? event.output;
  const error = event.error as string | undefined;
  const durationMs = (event.duration as number) ?? (event.durationMs as number | undefined);
  const hasResult = result !== undefined || error !== undefined;
  const isPending = !hasResult;

  const borderColor = error
    ? t.chat.toolBorderError
    : hasResult
      ? t.chat.toolBorderSuccess
      : t.chat.toolBorder;

  const dotColor = error
    ? t.chat.toolBorderError
    : hasResult
      ? t.chat.toolBorderSuccess
      : t.chat.toolBorderPending;

  const dotStyle = isPending
    ? `background: ${dotColor}; animation: pulse 1.5s ease-in-out infinite;`
    : `background: ${dotColor};`;

  function toggleExpand() {
    expanded.value = !expanded.value;
  }

  function toggleResult() {
    resultExpanded.value = !resultExpanded.value;
  }

  return (
    <div class={styles.block} style={`border-left-color: ${borderColor}`}>
      <div class={styles.header} onclick={toggleExpand}>
        <span class={styles.toolIcon}>{"\uD83D\uDD27"}</span>
        <span class={styles.statusDot} style={dotStyle} />
        <span class={styles.toolName}>{toolName}</span>
        {durationMs !== undefined ? (
          <span class={styles.duration}>{formatDuration(durationMs)}</span>
        ) : null}
        <span class={styles.toggle}>{computed(expanded, (v) => (v ? "\u25BC" : "\u25B6"))}</span>
      </div>

      {args
        ? when(expanded, () => (
            <pre class={styles.args}>
              {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
            </pre>
          ))
        : null}

      {error ? (
        <pre class={styles.result} style={`color: ${t.chat.errorText}`}>
          {error}
        </pre>
      ) : hasResult ? (
        <div class={styles.resultSection}>
          <button class={styles.resultToggle} onclick={toggleResult}>
            {computed(resultExpanded, (v) => (v ? "\u25BC result" : "\u25B6 result"))}
          </button>
          {when(resultExpanded, () => (
            <pre class={styles.result}>
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          ))}
        </div>
      ) : (
        <div class={styles.pending}>
          <span
            class={styles.statusDot}
            style={`background: ${t.chat.toolBorderPending}; animation: pulse 1.5s ease-in-out infinite;`}
          />
          running...
        </div>
      )}
    </div>
  );
}
