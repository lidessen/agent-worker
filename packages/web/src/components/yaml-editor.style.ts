import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["wrapper", "gutter", "textarea"] as const);

export const wrapper = rule`${c.wrapper} {
  display: flex;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.background};
  overflow: hidden;
  transition: border-color ${tokens.transitions.fast};
}
${c.wrapper}:focus-within {
  border-color: ${tokens.colors.primary};
}`;

export const gutter = rule`${c.gutter} {
  padding: ${tokens.space.md};
  background: ${tokens.colors.surface};
  color: ${tokens.colors.textDim};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.6;
  text-align: right;
  user-select: none;
  white-space: pre;
  min-width: 3ch;
  border-right: 1px solid ${tokens.colors.border};
}`;

export const textarea = rule`${c.textarea} {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.6;
  padding: ${tokens.space.md};
  tab-size: 2;
  white-space: pre;
  overflow-x: auto;
  min-height: 200px;
}
${c.textarea}::placeholder {
  color: ${tokens.colors.textDim};
}`;
