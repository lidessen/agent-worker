/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { Icon, Settings } from "semajsx/icons";
import type { ChannelMessage } from "../api/types.ts";
import type { VNode } from "semajsx";
import { wsAgents } from "../stores/workspace-data.ts";
import { formatDateTime } from "../utils/time.ts";
import {
  ClaudeIcon,
  CursorIcon,
  OpenAIIcon,
  VercelIcon,
  parsePlatformName,
} from "./brand-icons.tsx";
import * as styles from "./channel-message.style.ts";

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

function avatarLabel(name: string): string {
  // Take up to two initials from the display name
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function ChannelMessageItem(props: { message: ChannelMessage }) {
  const { message } = props;
  const isUser = message.from === "user";
  const isSys = message.from === "sys" || message.from === "system";
  const parsed = parsePlatformName(message.from);

  const platformSuffix = parsed.platform ? (
    <span class={styles.platformSuffix}>@{parsed.platform}</span>
  ) : null;

  const agentBadge = computed(wsAgents, (agents) => {
    const agent = agents.find((a) => a.name === message.from || a.name === parsed.name);
    if (!agent) return null;
    const icon = runtimeIcon(agent.runtime);
    if (!icon) return null;
    return <span class={styles.runtimeBadge}>{icon}</span>;
  });

  const whoLabel = isSys ? "system" : parsed.name;
  const rowClass = [
    styles.row,
    isUser && styles.rowUser,
    isSys && styles.rowSys,
  ];
  const avClass = isSys ? [styles.avatar, styles.avatarSys] : styles.avatar;

  return (
    <div class={rowClass}>
      <div class={avClass}>
        {isSys ? <Icon icon={Settings} size={12} /> : avatarLabel(parsed.name)}
      </div>
      <div class={styles.messageBlock}>
        <div class={styles.senderRow}>
          <span class={styles.sender}>
            <span class={styles.senderLabel}>{whoLabel}</span>
            {platformSuffix}
          </span>
          {agentBadge}
          <span class={styles.timestamp}>{formatDateTime(message.timestamp)}</span>
        </div>
        <div class={[styles.message, isUser && styles.messageUser]}>
          <div class={styles.content}>{message.content}</div>
        </div>
      </div>
    </div>
  );
}
