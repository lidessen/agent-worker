import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "head", "message"] as const);

export const block = rule`${c.block} {
  margin: 6px 0;
  border: 1px solid ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
  border-radius: 9px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: none;
}`;

export const head = rule`${c.head} {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  color: ${tokens.colors.danger};
  font-weight: 500;
}`;

export const message = rule`${c.message} {
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
  font-family: ${tokens.fonts.mono};
  line-height: 1.55;
}`;
