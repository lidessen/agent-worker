import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "card",
  "name",
  "meta",
  "badge",
  "badgeDot",
  "metaItem",
] as const);

export const card = rule`${c.card} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.lg};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.card}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}
@media (max-width: 640px) {
  ${c.card} {
    padding: ${tokens.space.md};
  }
}`;

export const name = rule`${c.name} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
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

export const meta = rule`${c.meta} {
  display: flex;
  gap: ${tokens.space.md};
  flex-wrap: wrap;
}`;

export const metaItem = rule`${c.metaItem} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;
