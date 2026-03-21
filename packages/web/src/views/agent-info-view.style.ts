import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "backLink",
  "agentName",
  "content",
  "section",
  "sectionTitle",
  "statusRow",
  "statusDot",
  "statusText",
  "infoGrid",
  "infoLabel",
  "infoValue",
  "instructions",
  "actionBar",
  "actionBtn",
  "actionBtnDanger",
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
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const backLink = rule`${c.backLink} {
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.md};
  cursor: pointer;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: ${tokens.radii.pill};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.backLink}:hover {
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceTertiary};
  border-color: ${tokens.colors.borderHover};
}`;

export const agentName = rule`${c.agentName} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.content} {
    padding: ${tokens.space.md};
  }
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
  padding: ${tokens.space.xl};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const statusRow = rule`${c.statusRow} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const statusDot = rule`${c.statusDot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const statusText = rule`${c.statusText} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  text-transform: capitalize;
}`;

export const infoGrid = rule`${c.infoGrid} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.md};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
}`;

export const infoLabel = rule`${c.infoLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const infoValue = rule`${c.infoValue} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
}`;

export const instructions = rule`${c.instructions} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
  word-break: break-word;
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  padding: ${tokens.space.md};
  font-family: ${tokens.fonts.mono};
  max-height: 200px;
  overflow-y: auto;
}`;

export const actionBar = rule`${c.actionBar} {
  display: flex;
  gap: ${tokens.space.sm};
}`;

export const actionBtn = rule`${c.actionBtn} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  color: ${tokens.colors.text};
  font-size: ${tokens.fontSizes.sm};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, transform ${tokens.transitions.fast};
}
${c.actionBtn}:hover {
  background: ${tokens.colors.panelHover};
  border-color: ${tokens.colors.borderHover};
  transform: translateY(-1px);
}`;

export const actionBtnDanger = rule`${c.actionBtnDanger} {
  color: ${tokens.colors.danger};
  border-color: ${tokens.colors.danger};
}
${c.actionBtnDanger}:hover {
  background: rgba(255, 69, 58, 0.1);
}`;
