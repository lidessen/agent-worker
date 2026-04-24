import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "row",
  "rowUser",
  "rowSys",
  "avatar",
  "avatarSys",
  "messageBlock",
  "message",
  "messageUser",
  "senderRow",
  "sender",
  "senderLabel",
  "platformSuffix",
  "runtimeBadge",
  "timestamp",
  "content",
] as const);

export const row = rule`${c.row} {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 6px 0;
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
  padding-left: 24px;
  padding-right: 24px;
}
${c.row} + ${c.row} {
  margin-top: 4px;
}
@media (max-width: 640px) {
  ${c.row} {
    padding-left: 14px;
    padding-right: 14px;
    gap: 8px;
  }
}`;

/* User messages still get the grid, just with muted alignment */
export const rowUser = rule`${c.rowUser} {
  /* same grid */
}`;

export const rowSys = rule`${c.rowSys} {
  color: ${tokens.colors.textDim};
}`;

export const avatar = rule`${c.avatar} {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  display: grid;
  place-items: center;
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textMuted};
  font-weight: 500;
  text-transform: uppercase;
}`;

export const avatarSys = rule`${c.avatarSys} {
  color: ${tokens.colors.textDim};
}`;

export const messageBlock = rule`${c.messageBlock} {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}`;

export const message = rule`${c.message} {
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
}`;

export const messageUser = rule`${c.messageUser} {
  /* same flat rendering for user */
}`;

export const senderRow = rule`${c.senderRow} {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0;
  font-size: 12.5px;
}
@media (max-width: 640px) {
  ${c.senderRow} {
    gap: 6px;
  }
}`;

export const runtimeBadge = rule`${c.runtimeBadge} {
  display: inline-flex;
  align-items: center;
  color: ${tokens.colors.textDim};
  line-height: 1;
}`;

export const sender = rule`${c.sender} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${tokens.colors.text};
}`;

export const senderLabel = rule`${c.senderLabel} {
  display: inline-flex;
  align-items: center;
}`;

export const platformSuffix = rule`${c.platformSuffix} {
  color: ${tokens.colors.textDim};
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
}`;

export const timestamp = rule`${c.timestamp} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;

export const content = rule`${c.content} {
  font-size: 13.5px;
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
@media (max-width: 640px) {
  ${c.content} {
    font-size: 13px;
    line-height: 1.55;
  }
}`;
