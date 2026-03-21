import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "header", "label", "toggle", "content"] as const);

export const block = rule`${c.block} {
  border-left: 3px solid ${tokens.colors.warning};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border-radius: 0 ${tokens.radii.sm} ${tokens.radii.sm} 0;
  margin: ${tokens.space.xs} 0;
  opacity: 0.7;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  cursor: pointer;
  user-select: none;
}`;

export const label = rule`${c.label} {
  font-size: ${tokens.fontSizes.sm};
  font-style: italic;
  color: ${tokens.colors.textMuted};
}`;

export const toggle = rule`${c.toggle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const content = rule`${c.content} {
  font-size: ${tokens.fontSizes.sm};
  font-style: italic;
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
  line-height: 1.5;
  margin-top: ${tokens.space.sm};
  padding: ${tokens.space.sm};
  background: ${tokens.colors.background};
  border-radius: ${tokens.radii.sm};
  max-height: 400px;
  overflow-y: auto;
}`;
