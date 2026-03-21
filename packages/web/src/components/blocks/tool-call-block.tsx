/** @jsxImportSource semajsx/dom */

import { Icon, Wrench, ChevronDown, ChevronRight } from "@semajsx/icons";
import { signal, computed } from "semajsx/signal";
import type { DaemonEvent } from "../../api/types.ts";
import { tokens } from "../../theme/tokens.ts";
import * as styles from "./tool-call-block.style.ts";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ToolCallBlock(props: { event: DaemonEvent }) {
  const { event } = props;
  const expanded = signal(false);
  const resultExpanded = signal(false);

  const toolName = (event.tool as string) ?? (event.name as string) ?? "tool";
  const args = event.args ?? event.input;
  const result = event.result ?? event.output;
  const error = event.error as string | undefined;
  const durationMs = event.duration as number ?? event.durationMs as number | undefined;
  const hasResult = result !== undefined || error !== undefined;
  const isPending = !hasResult;

  const dotColor = error
    ? tokens.colors.danger
    : hasResult
      ? tokens.colors.success
      : tokens.colors.primary;

  const dotStyle = isPending
    ? `background: ${dotColor}; animation: pulse 1.5s ease-in-out infinite;`
    : `background: ${dotColor};`;

  function toggleExpand() {
    expanded.value = !expanded.value;
  }

  function toggleResult() {
    resultExpanded.value = !resultExpanded.value;
  }

  const toggleIcon = computed(expanded, (ex) =>
    <Icon icon={ex ? ChevronDown : ChevronRight} size={12} />,
  );
  const resultToggleLabel = computed(resultExpanded, (re) =>
    <span><Icon icon={re ? ChevronDown : ChevronRight} size={12} style="vertical-align: -2px; margin-right: 2px;" /> result</span>,
  );

  const argsBlock = computed(expanded, (ex) => {
    if (!ex || !args) return null;
    return (
      <pre class={styles.args}>
        {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
      </pre>
    );
  });

  const resultPre = computed(resultExpanded, (re) => {
    if (!re) return null;
    return (
      <pre class={styles.result}>
        {typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2)}
      </pre>
    );
  });

  return (
    <div class={styles.block}>
      <div class={styles.header} onclick={toggleExpand}>
        <span class={styles.toolIcon}><Icon icon={Wrench} size={14} /></span>
        <span class={styles.statusDot} style={dotStyle} />
        <span class={styles.toolName}>{toolName}</span>
        {durationMs !== undefined ? (
          <span class={styles.duration}>{formatDuration(durationMs)}</span>
        ) : null}
        <span class={styles.toggle}>{toggleIcon}</span>
      </div>

      {argsBlock}

      {error ? (
        <pre class={styles.result} style={`color: ${tokens.colors.danger}`}>
          {error}
        </pre>
      ) : hasResult ? (
        <div class={styles.resultSection}>
          <button class={styles.resultToggle} onclick={toggleResult}>
            {resultToggleLabel}
          </button>
          {resultPre}
        </div>
      ) : (
        <div class={styles.pending}>
          <span
            class={styles.statusDot}
            style={`background: ${tokens.colors.primary}; animation: pulse 1.5s ease-in-out infinite;`}
          />
          running...
        </div>
      )}
    </div>
  );
}
