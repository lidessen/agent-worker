import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "page",
  "section",
  "sectionTitle",
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
] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xxl};
  max-width: 560px;
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const form = rule`${c.form} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
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
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  line-height: 1.5;
  transition: border-color ${tokens.transitions.fast};
}
${c.input}:focus {
  outline: none;
  border-color: ${tokens.colors.primary};
}
${c.input}::placeholder {
  color: ${tokens.colors.textDim};
}`;

export const actions = rule`${c.actions} {
  display: flex;
  gap: ${tokens.space.sm};
}
@media (max-width: 640px) {
  ${c.actions} {
    flex-direction: column;
  }
}`;

export const btn = rule`${c.btn} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.btn}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}
${c.btn}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const btnPrimary = rule`${c.btnPrimary} {
  background: ${tokens.colors.primary};
  color: #fff;
  border-color: ${tokens.colors.primary};
}
${c.btnPrimary}:hover {
  background: ${tokens.colors.primaryHover};
  border-color: ${tokens.colors.primaryHover};
}`;

export const message = rule`${c.message} {
  font-size: ${tokens.fontSizes.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.sm};
}`;

export const messageSuccess = rule`${c.messageSuccess} {
  color: ${tokens.colors.success};
  background: rgba(48, 209, 88, 0.1);
}`;

export const messageError = rule`${c.messageError} {
  color: ${tokens.colors.danger};
  background: rgba(255, 69, 58, 0.1);
}`;

export const info = rule`${c.info} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.lg};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
}`;

export const infoRow = rule`${c.infoRow} {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
