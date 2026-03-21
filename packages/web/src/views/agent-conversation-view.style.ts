import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "agentName",
  "badge",
  "badgeDot",
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
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
  backdrop-filter: blur(18px);
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
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 4px ${tokens.space.sm};
  background: ${tokens.colors.surfaceSecondary};
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const wsLabel = rule`${c.wsLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 4px ${tokens.space.sm};
  background: ${tokens.colors.surfaceSecondary};
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
  margin-bottom: ${tokens.space.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.dangerSurface};
  border: 1px solid rgba(255, 69, 58, 0.26);
  color: #ffd9d7;
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
}`;

export const sendErrorDismiss = rule`${c.sendErrorDismiss} {
  background: none;
  border: none;
  color: #fff;
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
  margin: ${tokens.space.md} ${tokens.space.xl} 0;
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.warningSurface};
  border: 1px solid rgba(255, 214, 10, 0.16);
  color: ${tokens.colors.warning};
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
}`;
