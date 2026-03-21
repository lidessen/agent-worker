/** @jsxImportSource semajsx/dom */

import type { ChannelMessage } from "../api/types.ts";
import * as styles from "./channel-message.style.ts";

// Deterministic color per sender name
const senderColors = [
  "#0a84ff",
  "#30d158",
  "#ff9f0a",
  "#bf5af2",
  "#ff375f",
  "#64d2ff",
  "#ffd60a",
  "#ac8e68",
];

function colorForSender(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return senderColors[Math.abs(hash) % senderColors.length];
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
  return (
    <div class={[styles.message, isUser && styles.messageUser]}>
      <div class={styles.senderRow}>
        <span
          class={styles.sender}
          style={`color: ${colorForSender(message.from)}`}
        >
          {message.from}
        </span>
        <span class={styles.timestamp}>{formatTime(message.timestamp)}</span>
      </div>
      <div class={styles.content}>{message.content}</div>
    </div>
  );
}
