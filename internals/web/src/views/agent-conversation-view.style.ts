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
  background: ${tokens.colors.background};
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: 12px 14px;
    gap: 8px;
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}`;

export const agentName = rule`${c.agentName} {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${tokens.colors.text};
  cursor: pointer;
  font-family: ${tokens.fonts.mono};
  transition: color ${tokens.transitions.fast};
}
${c.agentName}:hover {
  color: ${tokens.colors.primaryHover};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  padding: 2px 7px;
  background: ${tokens.colors.surface};
  font-family: ${tokens.fonts.mono};
  line-height: 1.5;
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const badgeDotIdle = rule`${c.badgeDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;
export const badgeDotRunning = rule`${c.badgeDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;
export const badgeDotError = rule`${c.badgeDotError} {
  background: ${tokens.colors.agentError};
}`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} {
  background: ${tokens.colors.agentCompleted};
}`;

export const wsLabel = rule`${c.wsLabel} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  padding: 2px 7px;
  background: ${tokens.colors.surface};
}`;

export const body = rule`${c.body} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}`;

export const sendErrorBar = rule`${c.sendErrorBar} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 24px ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: 9px;
  background: ${tokens.colors.dangerSurface};
  border: 1px solid ${tokens.colors.dangerBorder};
  color: ${tokens.colors.danger};
  font-size: 12.5px;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.sendErrorBar} {
    margin: 0 14px ${tokens.space.sm};
    font-size: 11.5px;
  }
}`;

export const sendErrorDismiss = rule`${c.sendErrorDismiss} {
  background: none;
  border: none;
  color: inherit;
  font-size: 16px;
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
  margin: ${tokens.space.sm} 24px 0;
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: 9px;
  background: ${tokens.colors.warningSurface};
  border: 1px solid ${tokens.colors.warningBorder};
  color: ${tokens.colors.warning};
  font-size: 12.5px;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.streamErrorBar} {
    margin: ${tokens.space.sm} 14px 0;
    font-size: 11.5px;
  }
}`;
