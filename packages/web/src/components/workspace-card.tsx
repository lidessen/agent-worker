/** @jsxImportSource semajsx/dom */

import type { WorkspaceInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import { tokens } from "../theme/tokens.ts";
import * as styles from "./workspace-card.style.ts";

const statusColors: Record<string, string> = {
  running: tokens.colors.agentRunning,
  stopped: tokens.colors.agentIdle,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
};

function statusColor(status: string): string {
  return statusColors[status] ?? tokens.colors.agentIdle;
}

export function WorkspaceCard(props: { workspace: WorkspaceInfo }) {
  const { workspace } = props;

  function handleClick() {
    navigate("/workspaces/" + workspace.name);
  }

  return (
    <div class={styles.card} role="button" tabindex="0" onclick={handleClick}>
      <span class={styles.name}>{workspace.name}</span>
      <div class={styles.badge}>
        <span
          class={styles.badgeDot}
          style={`background: ${statusColor(workspace.status)}`}
        />
        {workspace.status}
      </div>
      <div class={styles.meta}>
        <span class={styles.metaItem}>
          {workspace.agents.length} agent{workspace.agents.length !== 1 ? "s" : ""}
        </span>
        {workspace.mode ? <span class={styles.metaItem}>{workspace.mode}</span> : null}
      </div>
    </div>
  );
}
