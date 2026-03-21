import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "card",
  "name",
  "statusRow",
  "meta",
  "badge",
  "badgeDot",
  "metaItem",
  "timeText",
  "runtimeBadge",
] as const);

export const card = rule`${c.card} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.lg};
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.025) 100%);
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  box-shadow: ${tokens.shadows.inset};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, transform ${tokens.transitions.fast};
}
${c.card}:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.04) 100%);
  border-color: ${tokens.colors.borderHover};
  transform: translateY(-1px);
}
@media (max-width: 640px) {
  ${c.card} {
    padding: ${tokens.space.md};
  }
}`;

export const name = rule`${c.name} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.bold};
  color: ${tokens.colors.text};
  line-height: 1.2;
  letter-spacing: -0.02em;
}`;

export const statusRow = rule`${c.statusRow} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.space.sm};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const timeText = rule`${c.timeText} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const meta = rule`${c.meta} {
  display: flex;
  gap: ${tokens.space.sm};
  flex-wrap: wrap;
  align-items: center;
}`;

export const metaItem = rule`${c.metaItem} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const runtimeBadge = rule`${c.runtimeBadge} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 4px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
}`;
