/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { Icon, Drama } from "semajsx/icons";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon } from "./brand-icons.tsx";
import type { AgentInfo } from "../api/types.ts";
import { navigate } from "../router.ts";
import * as styles from "./agent-card.style.ts";

function runtimeIcon(runtime: string): JSXNode {
  switch (runtime) {
    case "claude-code":
      return <ClaudeIcon size={12} />;
    case "codex":
      return <OpenAIIcon size={12} />;
    case "cursor":
      return <CursorIcon size={12} />;
    case "ai-sdk":
      return <VercelIcon size={12} />;
    case "mock":
      return <Icon icon={Drama} size={12} />;
    default:
      return null;
  }
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
  const badgeDotClass = [
    styles.badgeDot,
    agent.state === "running"
      ? styles.badgeDotRunning
      : agent.state === "processing"
        ? styles.badgeDotProcessing
        : agent.state === "error" || agent.state === "failed"
          ? styles.badgeDotError
          : agent.state === "completed"
            ? styles.badgeDotCompleted
            : styles.badgeDotIdle,
  ];

  function handleClick() {
    navigate("/agents/" + agent.name);
  }

  return (
    <div class={styles.card} role="button" tabIndex={0} onclick={handleClick}>
      <span class={styles.name}>{agent.name}</span>
      <div class={styles.statusRow}>
        <div class={styles.badge}>
          <span class={badgeDotClass} />
          {agent.state}
        </div>
        {agent.createdAt ? (
          <span class={styles.timeText}>{timeAgo(agent.createdAt)}</span>
        ) : null}
      </div>
      <div class={styles.meta}>
        <span class={styles.runtimeBadge}>
          <span class={styles.runtimeIcon}>{runtimeIcon(agent.runtime)}</span>
          {agent.runtime}
        </span>
        {agent.model ? <span class={styles.metaItem}>{agent.model}</span> : null}
      </div>
    </div>
  );
}
