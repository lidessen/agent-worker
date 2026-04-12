/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
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

export function ChannelMessageItem(props: { message: ChannelMessage }) {
  const { message } = props;
  const isUser = message.from === "user";
  const parsed = parsePlatformName(message.from);

  // Platform suffix: "@telegram" in brand color
  const platformSuffix = parsed.platform ? (
    <span class={styles.platformSuffix}>@{parsed.platform}</span>
  ) : null;

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
            <span class={styles.senderLabel}>{parsed.name}</span>
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
