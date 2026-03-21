/** @jsxImportSource semajsx/dom */

import type { AgentInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import { tokens } from "../theme/tokens.ts";
import * as styles from "./agent-card.style.ts";

const stateColors: Record<string, string> = {
  idle: tokens.colors.agentIdle,
  running: tokens.colors.agentRunning,
  processing: tokens.colors.agentProcessing,
  error: tokens.colors.agentError,
  failed: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
  stopped: tokens.colors.agentIdle,
};

function stateColor(state: string): string {
  return stateColors[state] ?? tokens.colors.agentIdle;
}

const runtimeLabels: Record<string, string> = {
  "claude-code": "\u{1F916} claude-code",
  codex: "\u26A1 codex",
  cursor: "\u{1F5B1}\uFE0F cursor",
  "ai-sdk": "\u{1F9E0} ai-sdk",
  mock: "\u{1F3AD} mock",
};

function runtimeLabel(runtime: string): string {
  return runtimeLabels[runtime] ?? runtime;
}

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

export function AgentCard(props: { agent: AgentInfo }) {
  const { agent } = props;

  function handleClick() {
    navigate("/agents/" + agent.name);
  }

  return (
    <div class={styles.card} role="button" tabindex="0" onclick={handleClick}>
      <span class={styles.name}>{agent.name}</span>
      <div class={styles.statusRow}>
        <div class={styles.badge}>
          <span
            class={styles.badgeDot}
            style={`background: ${stateColor(agent.state)}`}
          />
          {agent.state}
        </div>
        {agent.createdAt ? (
          <span class={styles.timeText}>{timeAgo(agent.createdAt)}</span>
        ) : null}
      </div>
      <div class={styles.meta}>
        <span class={styles.runtimeBadge}>{runtimeLabel(agent.runtime)}</span>
        {agent.model ? <span class={styles.metaItem}>{agent.model}</span> : null}
      </div>
    </div>
  );
}
