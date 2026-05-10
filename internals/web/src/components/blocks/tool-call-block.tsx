/** @jsxImportSource semajsx/dom */

import { Icon, Terminal, X, ChevronRight } from "semajsx/icons";
import { signal, computed } from "semajsx/signal";
import type { DaemonEvent } from "../../api/types.ts";
import * as s from "./tool-call-block.style.ts";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${m}m${sec}s`;
}

function argsPreview(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") return args.slice(0, 80);
  try {
    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 0) return "";
    const parts = entries.map(([k, v]) => {
      const vs = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}: ${vs}`;
    });
    const joined = parts.join(", ");
    return joined.length > 80 ? `${joined.slice(0, 78)}…` : joined;
  } catch {
    return "";
  }
}

export function ToolCallBlock(props: { event: DaemonEvent }) {
  const { event } = props;
  const expanded = signal(false);

  const toolName = (event.tool as string) ?? (event.name as string) ?? "tool";
  const args = event.args ?? event.input;
  const result = event.result ?? event.output;
  const error = event.error as string | undefined;
  const durationMs = (event.duration as number) ?? (event.durationMs as number | undefined);
  const hasResult = result !== undefined || error !== undefined;

  const cardClass = computed(expanded, (ex) => (ex ? [s.card, s.cardOpen] : s.card));

  function toggle() {
    expanded.value = !expanded.value;
  }

  const body = computed(expanded, (ex) => {
    if (!ex) return null;
    return (
      <div class={s.body}>
        <div class={s.panel}>
          <div class={s.lbl}>args</div>
          <pre class={s.pre}>
            {args === undefined || args === null
              ? ""
              : typeof args === "string"
                ? args
                : JSON.stringify(args, null, 2)}
          </pre>
        </div>
        <div class={s.panel}>
          <div class={s.lbl}>{error ? "error" : "result"}</div>
          <pre class={error ? [s.pre, s.preError] : s.pre}>
            {error
              ? error
              : result === undefined || result === null
                ? ""
                : typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    );
  });

  return (
    <div class={cardClass}>
      <div class={s.head} onclick={toggle}>
        <span class={s.icon}>
          <Icon icon={error ? X : Terminal} size={12} />
        </span>
        <span class={s.name}>{toolName}</span>
        <span class={s.args}>{argsPreview(args)}</span>
        {durationMs !== undefined ? (
          <span class={s.duration}>{formatDuration(durationMs)}</span>
        ) : null}
        <span class={s.chev}>
          <Icon icon={ChevronRight} size={11} />
        </span>
      </div>
      {body}
      {!hasResult
        ? computed(expanded, (ex) =>
            ex ? null : (
              <div class={s.pending}>
                <span class={[s.statusDot, s.statusDotProcessing]} />
                running…
              </div>
            ),
          )
        : null}
    </div>
  );
}
