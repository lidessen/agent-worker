/** @jsxImportSource semajsx/dom */

import type { HarnessInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import * as styles from "./harness-card.style.ts";

const modeLabels: Record<string, string> = {
  service: "service",
  task: "task",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HarnessCard(props: { harness: HarnessInfo }) {
  const { harness } = props;

  function handleClick() {
    navigate("/harnesss/" + harness.name);
  }

  const agentCount = harness.agents.length;
  const agentLabel = `${agentCount} agent${agentCount !== 1 ? "s" : ""}`;
  const badgeDotClass = [
    styles.badgeDot,
    harness.status === "running"
      ? styles.badgeDotRunning
      : harness.status === "error"
        ? styles.badgeDotError
        : harness.status === "completed"
          ? styles.badgeDotCompleted
          : styles.badgeDotStopped,
  ];

  return (
    <div class={styles.card} role="button" tabIndex={0} onclick={handleClick}>
      <div class={styles.headerRow}>
        <span class={styles.name}>{harness.name}</span>
        {harness.mode ? (
          <span
            class={harness.mode === "service" ? styles.modeBadgeService : styles.modeBadgeTask}
          >
            {modeLabels[harness.mode] ?? harness.mode}
          </span>
        ) : null}
      </div>
      <div class={styles.statusRow}>
        <div class={styles.badge}>
          <span class={badgeDotClass} />
          {harness.status}
        </div>
        {harness.createdAt ? (
          <span class={styles.timeText}>{timeAgo(harness.createdAt)}</span>
        ) : null}
      </div>
      <div class={styles.meta}>
        <span class={styles.metaItem}>{agentLabel}</span>
      </div>
    </div>
  );
}
