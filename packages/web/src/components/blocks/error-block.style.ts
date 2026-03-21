import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "message"] as const);

export const block = rule`${c.block} {
  border-left: 3px solid ${tokens.colors.danger};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border-radius: 0 ${tokens.radii.sm} ${tokens.radii.sm} 0;
  margin: ${tokens.space.xs} 0;
}`;

export const message = rule`${c.message} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.danger};
  white-space: pre-wrap;
  font-family: ${tokens.fonts.mono};
  line-height: 1.5;
}`;
