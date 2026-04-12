/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { computed } from "semajsx/signal";
import {
  daemonEvents,
  loadDaemonEvents,
  startDaemonEventStream,
  stopDaemonEventStream,
  isDaemonStreaming,
} from "../stores/daemon-events.ts";
import { formatDateTime } from "../utils/time.ts";
import * as styles from "./global-events-view.style.ts";

export const GlobalEventsView: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  let cancelled = false;

  loadDaemonEvents().then(() => {
    if (!cancelled) startDaemonEventStream();
  });

  ctx.onCleanup(() => {
    cancelled = true;
    stopDaemonEventStream();
  });

  const eventCount = computed(daemonEvents, (list) => String(list.length));

  const streamBadge = computed(isDaemonStreaming, (streaming) => (streaming ? "live" : "paused"));

  const eventListContent = computed(daemonEvents, (events) => {
    if (events.length === 0) {
      return <div class={styles.emptyState}>No events yet</div>;
    }

    // Show most recent events first
    const reversed = [...events].reverse();

    return (
      <div class={styles.eventList}>
        {reversed.map((evt) => (
          <div class={styles.eventItem}>
            <span class={styles.eventTime}>{formatDateTime(evt.ts)}</span>
            <span class={styles.eventType}>{evt.type}</span>
            <span class={styles.eventAgent}>{evt.agent ? String(evt.agent) : ""}</span>
            <span class={styles.eventDetail}>
              {evt.workspace ? `@${String(evt.workspace)}` : ""}
              {evt.message ? ` ${String(evt.message)}` : ""}
            </span>
          </div>
        ))}
      </div>
    );
  });

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.headerInfo}>
          <span class={styles.title}>Event Log</span>
          <span class={styles.badge}>{eventCount} events</span>
          <span class={styles.badge}>{streamBadge}</span>
        </div>
      </div>

      <div class={styles.content}>{eventListContent}</div>
    </div>
  );
};
