/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { signal, computed } from "semajsx/signal";
import { Icon, Search, Zap, Clock } from "semajsx/icons";
import {
  daemonEvents,
  loadDaemonEvents,
  startDaemonEventStream,
  stopDaemonEventStream,
  isDaemonStreaming,
  daemonEventsCursor,
} from "../stores/daemon-events.ts";
import type { DaemonEvent } from "../api/types.ts";
import * as s from "./global-events-view.style.ts";

type FilterKey = "all" | "msg" | "tool" | "run" | "err" | "warn";

const FILTERS: FilterKey[] = ["all", "msg", "tool", "run", "err", "warn"];

function detectType(eventType: string): FilterKey | "other" {
  const t = eventType.toLowerCase();
  if (t.includes("tool")) return "tool";
  if (t.includes("run")) return "run";
  if (t.includes("err") || t === "error") return "err";
  if (t.includes("warn")) return "warn";
  if (t.includes("msg") || t.includes("text") || t.includes("message")) return "msg";
  return "other";
}

function eventTypeClass(type: string) {
  switch (detectType(type)) {
    case "msg":
      return [s.eventType, s.eventTypeMsg];
    case "tool":
      return [s.eventType, s.eventTypeTool];
    case "run":
      return [s.eventType, s.eventTypeRun];
    case "err":
      return [s.eventType, s.eventTypeErr];
    case "warn":
      return [s.eventType, s.eventTypeWarn];
    default:
      return s.eventType;
  }
}

function eventTypeLabel(type: string): string {
  const d = detectType(type);
  if (d === "other") {
    const idx = type.lastIndexOf(".");
    return (idx >= 0 ? type.slice(idx + 1) : type).slice(0, 10);
  }
  return d;
}

function eventActor(e: DaemonEvent): string {
  return (e.actor as string) ?? (e.agent as string) ?? (e.from as string) ?? "";
}

function eventBodyText(e: DaemonEvent): string {
  return (
    (e.body as string) ??
    (e.text as string) ??
    (e.message as string) ??
    (e.content as string) ??
    ""
  );
}

export const GlobalEventsView: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  const filter = signal<FilterKey>("all");
  const query = signal("");
  let cancelled = false;

  loadDaemonEvents().then(() => {
    if (!cancelled) startDaemonEventStream();
  });

  ctx.onCleanup(() => {
    cancelled = true;
    stopDaemonEventStream();
  });

  const liveBadge = computed([isDaemonStreaming, daemonEventsCursor], (streaming, cur) => [
    <span class={s.cursor}>cursor {cur}</span>,
    <span class={s.livePill}>
      <span class={s.liveDot} />
      {streaming ? "live" : "paused"}
    </span>,
  ]);

  const list = computed([daemonEvents, filter, query], (events, f, q) => {
    const regex = q ? safeRegex(q) : null;
    const matching = events
      .slice()
      .reverse()
      .filter((e) => {
        if (f !== "all") {
          const t = detectType(e.type);
          if (t !== f) return false;
        }
        if (regex) {
          const joined = `${e.type} ${eventActor(e)} ${eventBodyText(e)}`;
          if (!regex.test(joined)) return false;
        }
        return true;
      });
    if (matching.length === 0) {
      return <div class={s.emptyState}>No events match</div>;
    }
    return (
      <div class={s.eventList}>
        {matching.map((e) => (
          <div class={s.eventRow}>
            <span class={s.eventTs}>{fmtTs(e.ts)}</span>
            <span class={eventTypeClass(e.type)}>{eventTypeLabel(e.type)}</span>
            <span class={s.eventActor}>{eventActor(e)}</span>
            <span class={s.eventBody}>{eventBodyText(e) || e.type}</span>
          </div>
        ))}
      </div>
    );
  });

  function chipCls(key: FilterKey) {
    return computed(filter, (f) => (f === key ? [s.chip, s.chipActive] : s.chip));
  }

  return (
    <div class={s.container}>
      <div class={s.header}>
        <div class={s.headerRow}>
          <h1 class={s.title}>
            <Icon icon={Zap} size={18} /> Events
          </h1>
          <div class={s.headerRight}>
            {liveBadge}
            <button
              class={s.chip}
              onclick={() => {
                stopDaemonEventStream();
                loadDaemonEvents();
              }}
            >
              <Icon icon={Clock} size={11} /> Reload
            </button>
          </div>
        </div>
        <div class={s.subtitle}>all daemon events · fetch+stream · ?cursor replay supported</div>
      </div>

      <div class={s.filters}>
        {FILTERS.map((k) => (
          <span class={chipCls(k)} onclick={() => (filter.value = k)}>
            {k}
          </span>
        ))}
        <span class={s.spacer} />
        <div class={s.search}>
          <Icon icon={Search} size={11} />
          <input
            class={s.searchInput}
            placeholder="filter regex…"
            oninput={(e: Event) => {
              query.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
      </div>

      <div class={s.content}>{list}</div>
    </div>
  );
};

function fmtTs(ts: number | string | Date): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}

function safeRegex(q: string): RegExp | null {
  try {
    return new RegExp(q, "i");
  } catch {
    return null;
  }
}
