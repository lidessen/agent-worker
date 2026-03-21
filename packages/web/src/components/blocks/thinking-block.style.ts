import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "header", "label", "toggle", "content"] as const);

export const block = rule`${c.block} {
  padding: ${tokens.space.md} ${tokens.space.lg};
  background: ${tokens.colors.warningSurface};
  border: 1px solid rgba(255, 214, 10, 0.18);
  border-radius: ${tokens.radii.xl};
  margin: ${tokens.space.xs} 0;
  box-shadow: ${tokens.shadows.inset};
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
  background: ${tokens.colors.input};
  border-radius: ${tokens.radii.lg};
  max-height: 400px;
  overflow-y: auto;
}`;
