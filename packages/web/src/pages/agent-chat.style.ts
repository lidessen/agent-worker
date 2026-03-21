import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "page",
  "header",
  "backBtn",
  "headerInfo",
  "headerSpacer",
  "inspectorToggle",
  "inspectorToggleActive",
  "agentName",
  "badge",
  "badgeDot",
  "body",
  "mainCol",
  "inspectorCol",
  "inspectorColHidden",
  "sendErrorBar",
  "sendErrorDismiss",
  "streamErrorBar",
] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.page} {
    margin: -${tokens.space.md};
  }
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const backBtn = rule`${c.backBtn} {
  background: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  color: ${tokens.colors.textMuted};
  padding: ${tokens.space.xs} ${tokens.space.sm};
  font-size: ${tokens.fontSizes.sm};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.backBtn}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const agentName = rule`${c.agentName} {
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

export const headerSpacer = rule`${c.headerSpacer} {
  flex: 1;
}`;

export const inspectorToggle = rule`${c.inspectorToggle} {
  background: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  color: ${tokens.colors.textMuted};
  padding: ${tokens.space.xs} ${tokens.space.sm};
  font-size: ${tokens.fontSizes.xs};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.inspectorToggle}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const inspectorToggleActive = rule`${c.inspectorToggleActive} {
  background: ${tokens.colors.surfaceActive};
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const body = rule`${c.body} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
@media (min-width: 961px) {
  ${c.body} {
    flex-direction: row;
  }
}`;

export const mainCol = rule`${c.mainCol} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-width: 0;
}`;

export const inspectorCol = rule`${c.inspectorCol} {
  width: 100%;
  flex-shrink: 0;
}
@media (min-width: 961px) {
  ${c.inspectorCol} {
    width: 300px;
  }
}`;

export const inspectorColHidden = rule`${c.inspectorColHidden} {
  display: none;
}`;

export const sendErrorBar = rule`${c.sendErrorBar} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tokens.space.sm} ${tokens.space.lg};
  background: ${tokens.colors.danger};
  color: #fff;
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
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
  padding: ${tokens.space.xs} ${tokens.space.lg};
  background: rgba(255, 214, 10, 0.15);
  color: ${tokens.colors.warning};
  font-size: ${tokens.fontSizes.xs};
  flex-shrink: 0;
}`;
