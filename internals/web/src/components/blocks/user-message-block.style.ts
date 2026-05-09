import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "content"] as const);

export const block = rule`${c.block} {
  display: flex;
  justify-content: flex-end;
  padding: 0;
  margin: 8px 0 12px;
}`;

export const content = rule`${c.content} {
  padding: 10px 14px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  color: ${tokens.colors.text};
  max-width: 620px;
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  box-shadow: none;
}`;
