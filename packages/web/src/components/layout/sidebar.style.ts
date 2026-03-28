import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "sidebar",
  "header",
  "headerRow",
  "eyebrow",
  "headerMeta",
  "tabBar",
  "tab",
  "tabActive",
  "listArea",
  "listWrap",
  "sectionLabel",
  "listItem",
  "listItemActive",
  "itemDot",
  "itemDotIdle",
  "itemDotRunning",
  "itemDotProcessing",
  "itemDotError",
  "itemDotCompleted",
  "itemPreview",
  "itemMeta",
  "itemIcon",
  "bottomBar",
  "bottomActions",
  "bottomLink",
  "statusRow",
  "statusLabel",
  "connectionDot",
  "connectionDotConnected",
  "connectionDotConnecting",
  "connectionDotError",
  "workspaceSelect",
  "sectionLabelRow",
  "sectionAction",
  "displayContents",
  "tabPane",
  "tabPaneHidden",
] as const);

export const sidebar = rule`${c.sidebar} {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${tokens.colors.backgroundElevated};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xxl};
  box-shadow: ${tokens.shadows.panel};
  overflow: hidden;
}
@media (max-width: 900px) {
  ${c.sidebar} {
    display: none;
  }
}`;

export const header = rule`${c.header} {
  padding: ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
}`;

export const headerRow = rule`${c.headerRow} {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tokens.space.md};
}`;

export const eyebrow = rule`${c.eyebrow} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
}`;

export const headerMeta = rule`${c.headerMeta} {
  font-size: ${tokens.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${tokens.colors.textDim};
}`;

export const workspaceSelect = rule`${c.workspaceSelect} {
  width: 100%;
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
  font-family: ${tokens.fonts.base};
  cursor: pointer;
  outline: none;
  transition: border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.workspaceSelect}:hover,
${c.workspaceSelect}:focus {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}`;

export const tabBar = rule`${c.tabBar} {
  display: flex;
  flex-direction: row;
  margin: ${tokens.space.md};
  margin-top: ${tokens.space.sm};
  padding: 2px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  gap: 4px;
  flex-shrink: 0;
}`;

export const tab = rule`${c.tab} {
  flex: 1;
  background: none;
  border: none;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xs};
  font-family: ${tokens.fonts.base};
  font-weight: ${tokens.fontWeights.medium};
  border-radius: ${tokens.radii.sm};
  padding: 7px ${tokens.space.md};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.tab}:hover {
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceHover};
}`;

export const tabActive = rule`${c.tabActive} {
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceActive};
}`;

export const listArea = rule`${c.listArea} {
  flex: 1;
  overflow-y: auto;
  padding: 0 ${tokens.space.md} ${tokens.space.md};
}`;

export const listWrap = rule`${c.listWrap} {
  display: flex;
  flex-direction: column;
  gap: 1px;
}`;

export const sectionLabel = rule`${c.sectionLabel} {
  padding: ${tokens.space.sm} ${tokens.space.sm} ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${tokens.colors.textDim};
}`;

export const listItem = rule`${c.listItem} {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${tokens.space.sm};
  padding: 9px ${tokens.space.md};
  cursor: pointer;
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  border: 1px solid transparent;
  border-radius: ${tokens.radii.md};
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, color ${tokens.transitions.fast};
}
${c.listItem}:hover {
  background: ${tokens.colors.surface};
  border-color: ${tokens.colors.border};
  color: ${tokens.colors.text};
}`;

export const listItemActive = rule`${c.listItemActive} {
  background: ${tokens.colors.surfaceActive};
  border-color: ${tokens.colors.borderStrong};
  color: ${tokens.colors.text};
}`;

export const itemDot = rule`${c.itemDot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const itemDotIdle = rule`${c.itemDotIdle} { background: ${tokens.colors.agentIdle}; }`;
export const itemDotRunning = rule`${c.itemDotRunning} { background: ${tokens.colors.agentRunning}; }`;
export const itemDotProcessing = rule`${c.itemDotProcessing} { background: ${tokens.colors.agentProcessing}; }`;
export const itemDotError = rule`${c.itemDotError} { background: ${tokens.colors.agentError}; }`;
export const itemDotCompleted = rule`${c.itemDotCompleted} { background: ${tokens.colors.agentCompleted}; }`;

export const itemPreview = rule`${c.itemPreview} {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}`;

export const itemMeta = rule`${c.itemMeta} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const itemIcon = rule`${c.itemIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: ${tokens.colors.textDim};
  flex: 0 0 auto;
}`;

export const bottomBar = rule`${c.bottomBar} {
  border-top: 1px solid ${tokens.colors.border};
  padding: ${tokens.space.sm} ${tokens.space.md} ${tokens.space.md};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  flex-shrink: 0;
  background: ${tokens.colors.surfaceSecondary};
}`;

export const bottomActions = rule`${c.bottomActions} {
  display: flex;
  flex-direction: column;
  gap: 2px;
}`;

export const bottomLink = rule`${c.bottomLink} {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${tokens.space.sm};
  cursor: pointer;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xs};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${tokens.radii.md};
  padding: 10px ${tokens.space.md};
  font-family: ${tokens.fonts.base};
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.bottomLink}:hover {
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceHover};
}`;

export const statusRow = rule`${c.statusRow} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  margin-top: ${tokens.space.xs};
  padding: 12px ${tokens.space.md};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
}`;

export const statusLabel = rule`${c.statusLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-weight: ${tokens.fontWeights.medium};
}`;

export const connectionDot = rule`${c.connectionDot} {
  width: 10px;
  height: 10px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};
  box-shadow: 0 0 10px currentColor;
}`;

export const connectionDotConnected = rule`${c.connectionDotConnected} { background: ${tokens.colors.success}; }`;
export const connectionDotConnecting = rule`${c.connectionDotConnecting} { background: ${tokens.colors.warning}; }`;
export const connectionDotError = rule`${c.connectionDotError} { background: ${tokens.colors.danger}; }`;

export const sectionLabelRow = rule`${c.sectionLabelRow} {
  display: flex;
  align-items: center;
  justify-content: space-between;
}`;

export const sectionAction = rule`${c.sectionAction} {
  cursor: pointer;
  font-size: ${tokens.fontSizes.md};
  color: ${tokens.colors.textMuted};
  padding: 0 4px;
}`;

export const displayContents = rule`${c.displayContents} {
  display: contents;
}`;

export const tabPane = rule`${c.tabPane} {
  display: block;
}`;

export const tabPaneHidden = rule`${c.tabPaneHidden} {
  display: none;
}`;
