import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "overlay",
  "card",
  "title",
  "message",
  "actions",
  "btnConfirm",
  "btnConfirmDanger",
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
  background: ${tokens.colors.overlayScrim};
  backdrop-filter: blur(4px);
}`;

export const card = rule`${c.card} {
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.lg};
  padding: ${tokens.space.xl};
  width: 90vw;
  max-width: 400px;
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

export const message = rule`${c.message} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  line-height: 1.5;
}`;

export const actions = rule`${c.actions} {
  display: flex;
  justify-content: flex-end;
  gap: ${tokens.space.sm};
}`;

export const btnConfirm = rule`${c.btnConfirm} {
  background: ${tokens.colors.buttonPrimary};
  color: ${tokens.colors.buttonPrimaryText};
  border: 1px solid ${tokens.colors.buttonPrimaryBorder};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, opacity ${tokens.transitions.fast};
}
${c.btnConfirm}:hover {
  background: ${tokens.colors.buttonPrimaryHover};
}
${c.btnConfirm}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const btnConfirmDanger = rule`${c.btnConfirmDanger} {
  background: ${tokens.colors.danger};
}
${c.btnConfirmDanger}:hover {
  filter: brightness(1.05);
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
  background: ${tokens.colors.dangerSurface};
  border-radius: ${tokens.radii.sm};
}`;
