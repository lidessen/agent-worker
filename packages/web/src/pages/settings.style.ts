import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "page",
  "section",
  "sectionTitle",
  "sectionContent",
  "form",
  "field",
  "label",
  "input",
  "actions",
  "btn",
  "btnPrimary",
  "message",
  "messageSuccess",
  "messageError",
  "info",
  "infoRow",
  "infoLabel",
  "infoValue",
  "runtimeLabel",
  "runtimeIcon",
  "statusPill",
  "statusPillSuccess",
  "statusPillMuted",
] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xl};
  max-width: 820px;
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.xxl};
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  letter-spacing: -0.02em;
  color: ${tokens.colors.text};
}`;

export const sectionContent = rule`${c.sectionContent} {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: ${tokens.space.xs};
}`;

export const form = rule`${c.form} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
}`;

export const field = rule`${c.field} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const label = rule`${c.label} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.textMuted};
}`;

export const input = rule`${c.input} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.input};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: ${tokens.space.md} ${tokens.space.lg};
  line-height: 1.5;
  box-shadow: ${tokens.shadows.inset};
  transition: border-color ${tokens.transitions.fast}, box-shadow ${tokens.transitions.fast};
}
${c.input}:focus {
  outline: none;
  border-color: ${tokens.colors.borderStrong};
  box-shadow: ${tokens.shadows.focusRing};
}
${c.input}::placeholder {
  color: ${tokens.colors.textDim};
}`;

export const actions = rule`${c.actions} {
  display: flex;
  gap: ${tokens.space.sm};
  margin-top: ${tokens.space.xs};
}
@media (max-width: 640px) {
  ${c.actions} {
    flex-direction: column;
  }
}`;

export const btn = rule`${c.btn} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.panel};
  color: ${tokens.colors.text};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, transform ${tokens.transitions.fast};
}
${c.btn}:hover {
  background: ${tokens.colors.panelHover};
  border-color: ${tokens.colors.borderHover};
  transform: translateY(-1px);
}
${c.btn}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}`;

export const btnPrimary = rule`${c.btnPrimary} {
  background: ${tokens.colors.buttonPrimary};
  color: ${tokens.colors.buttonPrimaryText};
  border-color: ${tokens.colors.buttonPrimaryBorder};
}
${c.btnPrimary}:hover {
  background: ${tokens.colors.buttonPrimaryHover};
}`;

export const message = rule`${c.message} {
  font-size: ${tokens.fontSizes.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.lg};
  border: 1px solid transparent;
}`;

export const messageSuccess = rule`${c.messageSuccess} {
  color: ${tokens.colors.successTextStrong};
  background: ${tokens.colors.successSurface};
  border-color: ${tokens.colors.successBorder};
}`;

export const messageError = rule`${c.messageError} {
  color: ${tokens.colors.danger};
  background: ${tokens.colors.dangerSurface};
  border-color: ${tokens.colors.dangerBorder};
}`;

export const info = rule`${c.info} {
  display: flex;
  flex-direction: column;
  gap: 2px;
}`;

export const infoRow = rule`${c.infoRow} {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tokens.space.lg};
  padding: 7px 0;
}
@media (max-width: 640px) {
  ${c.infoRow} {
    flex-direction: column;
    align-items: flex-start;
    gap: ${tokens.space.xs};
  }
}`;

export const infoLabel = rule`${c.infoLabel} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const infoValue = rule`${c.infoValue} {
  font-size: ${tokens.fontSizes.sm};
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.text};
}`;

export const runtimeLabel = rule`${c.runtimeLabel} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.sm};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
}`;

export const runtimeIcon = rule`${c.runtimeIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: ${tokens.colors.textMuted};
  flex: 0 0 auto;
}`;

export const statusPill = rule`${c.statusPill} {
  display: inline-flex;
  align-items: center;
  padding: 3px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
  border: 1px solid ${tokens.colors.border};
  font-size: ${tokens.fontSizes.xs};
  font-family: ${tokens.fonts.base};
  font-weight: ${tokens.fontWeights.medium};
}`;

export const statusPillSuccess = rule`${c.statusPillSuccess} {
  color: ${tokens.colors.successTextStrong};
  background: ${tokens.colors.successSurface};
  border-color: ${tokens.colors.successBorder};
}`;

export const statusPillMuted = rule`${c.statusPillMuted} {
  color: ${tokens.colors.textMuted};
  background: ${tokens.colors.surfaceOverlay};
}`;
