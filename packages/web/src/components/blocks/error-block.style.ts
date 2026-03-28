import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "message"] as const);

export const block = rule`${c.block} {
  padding: ${tokens.space.md} ${tokens.space.lg};
  background: ${tokens.colors.dangerSurface};
  border: 1px solid ${tokens.colors.dangerBorder};
  border-radius: ${tokens.radii.xl};
  margin: ${tokens.space.xs} 0;
  box-shadow: ${tokens.shadows.inset};
}`;

export const message = rule`${c.message} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.danger};
  white-space: pre-wrap;
  font-family: ${tokens.fonts.mono};
  line-height: 1.5;
}`;
