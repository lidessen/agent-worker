/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import type { ChannelMessage } from "../api/types.ts";
import type { VNode } from "semajsx";
import { wsAgents } from "../stores/workspace-data.ts";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon, parsePlatformName } from "./brand-icons.tsx";
import * as styles from "./channel-message.style.ts";

// Deterministic color per sender name
const senderColors = [
  "#f3f1ee",
  "#d8d1ca",
  "#c0b6aa",
  "#ffb07d",
  "#d6b18a",
  "#bfb9b0",
  "#e6d4bc",
  "#c8a88a",
];

function colorForSender(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return senderColors[Math.abs(hash) % senderColors.length]!;
}

function runtimeIcon(runtime: string): VNode | null {
  const iconProps = { size: 12 };
  switch (runtime) {
    case "claude-code":
      return ClaudeIcon(iconProps);
    case "cursor":
      return CursorIcon(iconProps);
    case "codex":
      return OpenAIIcon(iconProps);
    case "ai-sdk":
      return VercelIcon(iconProps);
    default:
      return null;
  }
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChannelMessageItem(props: { message: ChannelMessage }) {
  const { message } = props;
  const isUser = message.from === "user";
  const parsed = parsePlatformName(message.from);

  // Platform suffix: "@telegram" in brand color
  const platformSuffix = parsed.platform && parsed.color
    ? <span style={`color: ${parsed.color}; opacity: 0.7;`}>@{parsed.platform}</span>
    : null;

  // Reactive: re-derives agent runtime badge when wsAgents updates
  const agentBadge = computed(wsAgents, (agents) => {
    const agent = agents.find((a) => a.name === message.from || a.name === parsed.name);
    if (!agent) return null;
    const icon = runtimeIcon(agent.runtime);
    if (!icon) return null;
    return <span class={styles.runtimeBadge}>{icon}</span>;
  });

  return (
    <div class={[styles.row, isUser && styles.rowUser]}>
      <div class={styles.messageBlock}>
        <div class={styles.senderRow}>
          <span class={styles.sender}>
            <span
              class={styles.senderLabel}
              style={`color: ${colorForSender(parsed.name)}`}
            >
              {parsed.name}
            </span>
            {platformSuffix}
          </span>
          {agentBadge}
          <span class={styles.timestamp}>{formatTime(message.timestamp)}</span>
        </div>
        <div class={[styles.message, isUser && styles.messageUser]}>
          <div class={styles.content}>{message.content}</div>
        </div>
      </div>
    </div>
  );
}
