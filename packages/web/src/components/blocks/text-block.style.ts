import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "code", "codeBlock", "blockquote"] as const);

export const block = rule`${c.block} {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: ${tokens.fontSizes.md};
  color: ${tokens.colors.text};
  padding: ${tokens.space.sm} 0;
}`;

export const code = rule`${c.code} {
  font-family: ${tokens.fonts.mono};
  font-size: 0.85em;
  background: ${tokens.colors.surfaceSecondary};
  padding: 2px ${tokens.space.xs};
  border-radius: ${tokens.radii.pill};
  border: 1px solid ${tokens.colors.border};
}`;

export const codeBlock = rule`${c.codeBlock} {
  display: block;
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.sm};
  background: ${tokens.colors.input};
  padding: ${tokens.space.md};
  border-radius: ${tokens.radii.xl};
  border: 1px solid ${tokens.colors.border};
  margin: ${tokens.space.sm} 0;
  overflow-x: auto;
  white-space: pre;
  line-height: 1.4;
}`;

export const blockquote = rule`${c.blockquote} {
  border-left: 3px solid ${tokens.colors.border};
  padding-left: ${tokens.space.md};
  color: ${tokens.colors.textMuted};
  margin: ${tokens.space.sm} 0;
  font-style: italic;
}`;
