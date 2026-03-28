import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "card",
  "name",
  "statusRow",
  "meta",
  "badge",
  "badgeDot",
  "badgeDotIdle",
  "badgeDotRunning",
  "badgeDotProcessing",
  "badgeDotError",
  "badgeDotCompleted",
  "metaItem",
  "timeText",
  "runtimeBadge",
  "runtimeIcon",
] as const);

export const card = rule`${c.card} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.lg};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  box-shadow: ${tokens.shadows.inset};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, transform ${tokens.transitions.fast};
}
${c.card}:hover {
  background: ${tokens.colors.surfaceSecondary};
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

export const badgeDotIdle = rule`${c.badgeDotIdle} { background: ${tokens.colors.agentIdle}; }`;
export const badgeDotRunning = rule`${c.badgeDotRunning} { background: ${tokens.colors.agentRunning}; }`;
export const badgeDotProcessing = rule`${c.badgeDotProcessing} { background: ${tokens.colors.agentProcessing}; }`;
export const badgeDotError = rule`${c.badgeDotError} { background: ${tokens.colors.agentError}; }`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} { background: ${tokens.colors.agentCompleted}; }`;

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
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  background: ${tokens.colors.surfaceOverlay};
  border: 1px solid ${tokens.colors.border};
  padding: 4px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
}`;

export const runtimeIcon = rule`${c.runtimeIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;
