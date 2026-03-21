import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "sidebar",
  "header",
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
  "itemPreview",
  "bottomBar",
  "bottomActions",
  "bottomLink",
  "statusRow",
  "statusLabel",
  "connectionDot",
  "workspaceSelect",
] as const);

export const sidebar = rule`${c.sidebar} {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background:
    linear-gradient(180deg, rgba(34, 34, 34, 0.94) 0%, rgba(22, 22, 22, 0.92) 100%);
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xxl};
  box-shadow: ${tokens.shadows.panel};
  backdrop-filter: blur(24px) saturate(140%);
  overflow: hidden;
}
@media (max-width: 900px) {
  ${c.sidebar} {
    width: 280px;
    border-radius: ${tokens.radii.xl};
  }
}`;

export const header = rule`${c.header} {
  padding: ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
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
  background: ${tokens.colors.surfaceSecondary};
  color: ${tokens.colors.text};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.lg};
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
  font-family: ${tokens.fonts.base};
  cursor: pointer;
  outline: none;
  transition: border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.workspaceSelect}:hover,
${c.workspaceSelect}:focus {
  background: ${tokens.colors.surfaceTertiary};
  border-color: ${tokens.colors.borderHover};
}`;

export const tabBar = rule`${c.tabBar} {
  display: flex;
  flex-direction: row;
  margin: ${tokens.space.md};
  margin-top: ${tokens.space.sm};
  padding: 4px;
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
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
  border-radius: ${tokens.radii.pill};
  padding: ${tokens.space.sm} ${tokens.space.md};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.tab}:hover {
  color: ${tokens.colors.text};
  background: rgba(255, 255, 255, 0.04);
}`;

export const tabActive = rule`${c.tabActive} {
  color: ${tokens.colors.text};
  background: rgba(255, 255, 255, 0.08);
}`;

export const listArea = rule`${c.listArea} {
  flex: 1;
  overflow-y: auto;
  padding: 0 ${tokens.space.md} ${tokens.space.md};
}`;

export const listWrap = rule`${c.listWrap} {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  padding: ${tokens.space.sm} ${tokens.space.md};
  cursor: pointer;
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  border: 1px solid transparent;
  border-radius: ${tokens.radii.lg};
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, color ${tokens.transitions.fast};
}
${c.listItem}:hover {
  background: ${tokens.colors.surfaceSecondary};
  border-color: rgba(255, 255, 255, 0.05);
  color: ${tokens.colors.text};
}`;

export const listItemActive = rule`${c.listItemActive} {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.04) 100%);
  border-color: ${tokens.colors.borderStrong};
  box-shadow: ${tokens.shadows.inset};
  color: ${tokens.colors.text};
}`;

export const itemDot = rule`${c.itemDot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const itemPreview = rule`${c.itemPreview} {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}`;

export const bottomBar = rule`${c.bottomBar} {
  border-top: 1px solid ${tokens.colors.border};
  padding: ${tokens.space.sm} ${tokens.space.md} ${tokens.space.md};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.015);
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
  border-radius: ${tokens.radii.lg};
  padding: 10px ${tokens.space.md};
  font-family: ${tokens.fonts.base};
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.bottomLink}:hover {
  color: ${tokens.colors.text};
  background: rgba(255, 255, 255, 0.04);
}`;

export const statusRow = rule`${c.statusRow} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  margin-top: ${tokens.space.xs};
  padding: 12px ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
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
