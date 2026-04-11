/** @jsxImportSource semajsx/dom */

import type { WorkspaceInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import * as styles from "./workspace-card.style.ts";

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

export function WorkspaceCard(props: { workspace: WorkspaceInfo }) {
  const { workspace } = props;

  function handleClick() {
    navigate("/workspaces/" + workspace.name);
  }

  const agentCount = workspace.agents.length;
  const agentLabel = `${agentCount} agent${agentCount !== 1 ? "s" : ""}`;
  const badgeDotClass = [
    styles.badgeDot,
    workspace.status === "running"
      ? styles.badgeDotRunning
      : workspace.status === "error"
        ? styles.badgeDotError
        : workspace.status === "completed"
          ? styles.badgeDotCompleted
          : styles.badgeDotStopped,
  ];

  return (
    <div class={styles.card} role="button" tabIndex={0} onclick={handleClick}>
      <div class={styles.headerRow}>
        <span class={styles.name}>{workspace.name}</span>
        {workspace.mode ? (
          <span
            class={
              workspace.mode === "service"
                ? styles.modeBadgeService
                : styles.modeBadgeTask
            }
          >
            {modeLabels[workspace.mode] ?? workspace.mode}
          </span>
        ) : null}
      </div>
      <div class={styles.statusRow}>
        <div class={styles.badge}>
          <span class={badgeDotClass} />
          {workspace.status}
        </div>
        {workspace.createdAt ? (
          <span class={styles.timeText}>{timeAgo(workspace.createdAt)}</span>
        ) : null}
      </div>
      <div class={styles.meta}>
        <span class={styles.metaItem}>{agentLabel}</span>
      </div>
    </div>
  );
}
