import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "message",
  "messageUser",
  "senderRow",
  "sender",
  "timestamp",
  "content",
] as const);

export const message = rule`${c.message} {
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
}`;

export const messageUser = rule`${c.messageUser} {
  background: ${tokens.colors.surfaceActive};
}`;

export const senderRow = rule`${c.senderRow} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.sm};
  margin-bottom: ${tokens.space.xs};
}`;

export const sender = rule`${c.sender} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.primary};
}`;

export const timestamp = rule`${c.timestamp} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const content = rule`${c.content} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}`;
