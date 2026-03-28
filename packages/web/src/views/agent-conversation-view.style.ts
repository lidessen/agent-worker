import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "agentName",
  "badge",
  "badgeDot",
  "badgeDotIdle",
  "badgeDotRunning",
  "badgeDotError",
  "badgeDotCompleted",
  "wsLabel",
  "body",
  "sendErrorBar",
  "sendErrorDismiss",
  "streamErrorBar",
] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.md} ${tokens.space.xl};
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.headerSheen};
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  flex-wrap: wrap;
}`;

export const agentName = rule`${c.agentName} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
  cursor: pointer;
  transition: color ${tokens.transitions.fast};
}
${c.agentName}:hover {
  color: ${tokens.colors.primaryHover};
}
@media (max-width: 640px) {
  ${c.agentName} {
    font-size: ${tokens.fontSizes.lg};
  }
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 3px ${tokens.space.sm};
  background: ${tokens.colors.badge};
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const badgeDotIdle = rule`${c.badgeDotIdle} { background: ${tokens.colors.agentIdle}; }`;
export const badgeDotRunning = rule`${c.badgeDotRunning} { background: ${tokens.colors.agentRunning}; }`;
export const badgeDotError = rule`${c.badgeDotError} { background: ${tokens.colors.agentError}; }`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} { background: ${tokens.colors.agentCompleted}; }`;

export const wsLabel = rule`${c.wsLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 3px ${tokens.space.sm};
  background: ${tokens.colors.badge};
}`;

export const body = rule`${c.body} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}`;

export const sendErrorBar = rule`${c.sendErrorBar} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 ${tokens.space.xl};
  margin-bottom: ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.dangerSurface};
  border: 1px solid ${tokens.colors.dangerBorder};
  color: ${tokens.colors.danger};
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
}
@media (max-width: 640px) {
  ${c.sendErrorBar} {
    margin: 0 ${tokens.space.md} ${tokens.space.sm};
    font-size: ${tokens.fontSizes.xs};
  }
}`;

export const sendErrorDismiss = rule`${c.sendErrorDismiss} {
  background: none;
  border: none;
  color: inherit;
  font-size: ${tokens.fontSizes.md};
  cursor: pointer;
  padding: 0 ${tokens.space.xs};
  opacity: 0.8;
  transition: opacity ${tokens.transitions.fast};
}
${c.sendErrorDismiss}:hover {
  opacity: 1;
}`;

export const streamErrorBar = rule`${c.streamErrorBar} {
  display: flex;
  align-items: center;
  margin: ${tokens.space.sm} ${tokens.space.xl} 0;
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.warningSurface};
  border: 1px solid ${tokens.colors.warningBorder};
  color: ${tokens.colors.warning};
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
}
@media (max-width: 640px) {
  ${c.streamErrorBar} {
    margin: ${tokens.space.sm} ${tokens.space.md} 0;
    font-size: ${tokens.fontSizes.xs};
  }
}`;
