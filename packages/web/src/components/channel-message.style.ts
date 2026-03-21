import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "row",
  "rowUser",
  "messageBlock",
  "message",
  "messageUser",
  "senderRow",
  "sender",
  "senderLabel",
  "runtimeBadge",
  "timestamp",
  "content",
] as const);

export const row = rule`${c.row} {
  display: flex;
  justify-content: flex-start;
  margin-bottom: ${tokens.space.md};
}`;

export const rowUser = rule`${c.rowUser} {
  justify-content: flex-end;
}`;

export const messageBlock = rule`${c.messageBlock} {
  width: min(100%, 780px);
}`;

export const message = rule`${c.message} {
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const messageUser = rule`${c.messageUser} {
  background: ${tokens.colors.panelStrong};
  border-color: ${tokens.colors.borderStrong};
}`;

export const senderRow = rule`${c.senderRow} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  margin-bottom: ${tokens.space.sm};
  padding: 0 ${tokens.space.lg};
}`;

export const runtimeBadge = rule`${c.runtimeBadge} {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
  color: rgba(243, 241, 238, 0.62);
  line-height: 1;
}`;

export const sender = rule`${c.sender} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.sm};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  letter-spacing: -0.01em;
  color: ${tokens.colors.text};
}`;

export const senderLabel = rule`${c.senderLabel} {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
}`;


export const timestamp = rule`${c.timestamp} {
  font-size: ${tokens.fontSizes.xs};
  color: rgba(243, 241, 238, 0.5);
}`;

export const content = rule`${c.content} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}`;
