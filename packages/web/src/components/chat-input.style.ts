import { classes, rule, inject } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "bar",
  "composer",
  "textarea",
  "footer",
  "shortcut",
  "sendBtn",
] as const);

export const bar = rule`${c.bar} {
  padding: ${tokens.space.sm} ${tokens.space.xl} ${tokens.space.lg};
  background: ${tokens.colors.backgroundElevated};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.bar} {
    padding: ${tokens.space.xs} ${tokens.space.sm} ${tokens.space.sm};
    padding-bottom: max(${tokens.space.sm}, env(safe-area-inset-bottom));
  }
}`;

export const composer = rule`${c.composer} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: 10px 12px 9px;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.surfaceSecondary};
  box-shadow: ${tokens.shadows.inset};
}
@media (max-width: 640px) {
  ${c.composer} {
    gap: ${tokens.space.xs};
    padding: 9px 11px 8px;
    border-radius: ${tokens.radii.lg};
  }
}`;

export const textarea = rule`${c.textarea} {
  display: block;
  width: 100%;
  resize: none;
  border: none;
  background: transparent;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: 0;
  line-height: 1.4;
  min-height: 36px;
  max-height: 120px;
  overflow-y: auto;
}
${c.textarea}:focus {
  outline: none;
}
${c.textarea}::placeholder {
  color: ${tokens.colors.textDim};
  font-weight: ${tokens.fontWeights.medium};
}
${c.textarea}:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  ${c.textarea} {
    font-size: ${tokens.fontSizes.sm};
    min-height: 32px;
    max-height: 96px;
  }
}`;

export const footer = rule`${c.footer} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.space.md};
  min-height: 26px;
}
@media (max-width: 640px) {
  ${c.footer} {
    min-height: 22px;
  }
}`;

export const shortcut = rule`${c.shortcut} {
  font-size: ${tokens.fontSizes.xxs};
  color: ${tokens.colors.textDim};
  font-weight: ${tokens.fontWeights.medium};
}
@media (max-width: 640px) {
  ${c.shortcut} {
    font-size: ${tokens.fontSizes.xxs};
  }
}`;

export const sendBtn = rule`${c.sendBtn} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid ${tokens.colors.borderStrong};
  border-radius: ${tokens.radii.pill};
  background: ${tokens.colors.surfaceActive};
  color: ${tokens.colors.text};
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
  transition: transform ${tokens.transitions.fast}, opacity ${tokens.transitions.fast}, filter ${tokens.transitions.fast};
}
${c.sendBtn}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}
${c.sendBtn}:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  ${c.sendBtn} {
    width: 28px;
    height: 28px;
  }
}`;

inject([
  rule`${c.sendBtn}:focus-visible, ${c.textarea}:focus-visible {
    outline: none;
  }`,
]);
