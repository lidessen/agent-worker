import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["bar", "textarea", "sendBtn"] as const);

export const bar = rule`${c.bar} {
  display: flex;
  align-items: flex-end;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-top: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surface};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.bar} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    padding-bottom: max(${tokens.space.sm}, env(safe-area-inset-bottom));
  }
}`;

export const textarea = rule`${c.textarea} {
  flex: 1;
  resize: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  line-height: 1.5;
  min-height: 38px;
  max-height: 200px;
  overflow-y: auto;
  transition: border-color ${tokens.transitions.fast};
}
${c.textarea}:focus {
  outline: none;
  border-color: ${tokens.colors.primary};
}
${c.textarea}::placeholder {
  color: ${tokens.colors.textDim};
}
${c.textarea}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const sendBtn = rule`${c.sendBtn} {
  background: ${tokens.colors.primary};
  color: #fff;
  border: none;
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  cursor: pointer;
  flex-shrink: 0;
  height: 38px;
  transition: background ${tokens.transitions.fast}, opacity ${tokens.transitions.fast};
}
${c.sendBtn}:hover {
  background: ${tokens.colors.primaryHover};
}
${c.sendBtn}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`;
