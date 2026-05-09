import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "card",
  "headerRow",
  "name",
  "statusRow",
  "meta",
  "badge",
  "badgeDot",
  "badgeDotRunning",
  "badgeDotStopped",
  "badgeDotError",
  "badgeDotCompleted",
  "metaItem",
  "timeText",
  "modeBadgeService",
  "modeBadgeTask",
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

export const headerRow = rule`${c.headerRow} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.space.sm};
}`;

export const name = rule`${c.name} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.bold};
  color: ${tokens.colors.text};
  line-height: 1.2;
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

export const badgeDotRunning = rule`${c.badgeDotRunning} { background: ${tokens.colors.agentRunning}; }`;
export const badgeDotStopped = rule`${c.badgeDotStopped} { background: ${tokens.colors.agentIdle}; }`;
export const badgeDotError = rule`${c.badgeDotError} { background: ${tokens.colors.agentError}; }`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} { background: ${tokens.colors.agentCompleted}; }`;

export const timeText = rule`${c.timeText} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
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

const modeBadgeBase = `
  font-size: ${tokens.fontSizes.xs};
  font-weight: ${tokens.fontWeights.medium};
  padding: 2px ${tokens.space.sm};
  border-radius: ${tokens.radii.sm};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const modeBadgeService = rule`${c.modeBadgeService} {
  ${modeBadgeBase}
  color: ${tokens.colors.success};
  background: ${tokens.colors.successSurface};
  border: 1px solid ${tokens.colors.successBorder};
}`;

export const modeBadgeTask = rule`${c.modeBadgeTask} {
  ${modeBadgeBase}
  color: ${tokens.colors.primary};
  background: ${tokens.colors.buttonPrimary};
  border: 1px solid ${tokens.colors.buttonPrimaryBorder};
}`;
