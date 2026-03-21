import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "divider", "label", "detail"] as const);

export const block = rule`${c.block} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.pill};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
}`;

export const divider = rule`${c.divider} {
  flex: 1;
  height: 1px;
  background: ${tokens.colors.border};
}`;

export const label = rule`${c.label} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  white-space: nowrap;
}`;

export const detail = rule`${c.detail} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
  white-space: nowrap;
}`;
