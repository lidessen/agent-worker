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
}
@media (max-width: 640px) {
  ${c.row} {
    margin-bottom: ${tokens.space.sm};
  }
}`;

export const rowUser = rule`${c.rowUser} {
  justify-content: flex-end;
}`;

export const messageBlock = rule`${c.messageBlock} {
  width: min(100%, 780px);
}`;

export const message = rule`${c.message} {
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
}
@media (max-width: 640px) {
  ${c.message} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    border-radius: ${tokens.radii.md};
  }
}`;

export const messageUser = rule`${c.messageUser} {
  background: ${tokens.colors.surface};
  border-color: ${tokens.colors.borderStrong};
}`;

export const senderRow = rule`${c.senderRow} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  margin-bottom: ${tokens.space.sm};
  padding: 0 ${tokens.space.lg};
}
@media (max-width: 640px) {
  ${c.senderRow} {
    gap: ${tokens.space.xs};
    margin-bottom: 6px;
    padding: 0 ${tokens.space.md};
  }
}`;

export const runtimeBadge = rule`${c.runtimeBadge} {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
  color: ${tokens.colors.textDim};
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
}
@media (max-width: 640px) {
  ${c.sender} {
    font-size: ${tokens.fontSizes.xs};
  }
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
  color: ${tokens.colors.textDim};
}
@media (max-width: 640px) {
  ${c.timestamp} {
    font-size: 0.68rem;
  }
}`;

export const content = rule`${c.content} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
@media (max-width: 640px) {
  ${c.content} {
    font-size: ${tokens.fontSizes.xs};
    line-height: 1.55;
  }
}`;
