import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "overlay",
  "card",
  "title",
  "field",
  "label",
  "input",
  "select",
  "actions",
  "btnPrimary",
  "btnCancel",
  "error",
] as const);

export const overlay = rule`${c.overlay} {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}`;

export const card = rule`${c.card} {
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.lg};
  padding: ${tokens.space.xl};
  width: 90vw;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
  margin: 0;
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
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  transition: border-color ${tokens.transitions.fast};
}
${c.input}:focus {
  outline: none;
  border-color: ${tokens.colors.primary};
}
${c.input}::placeholder {
  color: ${tokens.colors.textDim};
}`;

export const select = rule`${c.select} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  transition: border-color ${tokens.transitions.fast};
}
${c.select}:focus {
  outline: none;
  border-color: ${tokens.colors.primary};
}`;

export const actions = rule`${c.actions} {
  display: flex;
  justify-content: flex-end;
  gap: ${tokens.space.sm};
}`;

export const btnPrimary = rule`${c.btnPrimary} {
  background: ${tokens.colors.primary};
  color: #fff;
  border: none;
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, opacity ${tokens.transitions.fast};
}
${c.btnPrimary}:hover {
  background: ${tokens.colors.primaryHover};
}
${c.btnPrimary}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const btnCancel = rule`${c.btnCancel} {
  background: transparent;
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.btnCancel}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}`;

export const error = rule`${c.error} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.danger};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: rgba(255, 69, 58, 0.1);
  border-radius: ${tokens.radii.sm};
}`;
