import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "code", "codeBlock", "blockquote"] as const);

export const block = rule`${c.block} {
  white-space: pre-wrap;
  line-height: 1.7;
  font-size: 14px;
  color: ${tokens.colors.text};
  padding: 2px 0;
  margin: 0 0 10px;
}
${c.block}:last-child {
  margin-bottom: 0;
}`;

export const code = rule`${c.code} {
  font-family: ${tokens.fonts.mono};
  font-size: 12.5px;
  background: ${tokens.colors.surface};
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid ${tokens.colors.border};
}`;

export const codeBlock = rule`${c.codeBlock} {
  display: block;
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.sm};
  background: ${tokens.colors.surface};
  padding: ${tokens.space.md};
  border-radius: 9px;
  border: 1px solid ${tokens.colors.border};
  margin: ${tokens.space.sm} 0;
  overflow-x: auto;
  white-space: pre;
  line-height: 1.5;
}`;

export const blockquote = rule`${c.blockquote} {
  border-left: 2px solid ${tokens.colors.border};
  padding-left: ${tokens.space.md};
  color: ${tokens.colors.textMuted};
  margin: ${tokens.space.sm} 0;
  font-style: italic;
}`;
