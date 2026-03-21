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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, transparent 100%);
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.bar} {
    padding: ${tokens.space.sm} ${tokens.space.md} ${tokens.space.md};
    padding-bottom: max(${tokens.space.sm}, env(safe-area-inset-bottom));
  }
}`;

export const composer = rule`${c.composer} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: 14px 16px 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(42, 42, 42, 0.68) 0%, rgba(28, 28, 28, 0.82) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.038), 0 10px 26px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(24px) saturate(135%);
}`;

export const textarea = rule`${c.textarea} {
  display: block;
  width: 100%;
  resize: none;
  border: none;
  background: transparent;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: 0.98rem;
  padding: 0;
  line-height: 1.4;
  min-height: 46px;
  max-height: 128px;
  overflow-y: auto;
}
${c.textarea}:focus {
  outline: none;
}
${c.textarea}::placeholder {
  color: rgba(243, 241, 238, 0.24);
  font-weight: ${tokens.fontWeights.medium};
}
${c.textarea}:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}`;

export const footer = rule`${c.footer} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.space.md};
  min-height: 26px;
}`;

export const shortcut = rule`${c.shortcut} {
  font-size: 0.72rem;
  color: rgba(243, 241, 238, 0.36);
  font-weight: ${tokens.fontWeights.medium};
}`;

export const sendBtn = rule`${c.sendBtn} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: ${tokens.radii.pill};
  background: linear-gradient(180deg, rgba(176, 176, 176, 0.94) 0%, rgba(147, 147, 147, 0.9) 100%);
  color: rgba(20, 20, 20, 0.94);
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 6px 14px rgba(0, 0, 0, 0.18);
  transition: transform ${tokens.transitions.fast}, opacity ${tokens.transitions.fast}, filter ${tokens.transitions.fast};
}
${c.sendBtn}:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}
${c.sendBtn}:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  transform: none;
  filter: none;
}`;

inject([
  rule`${c.sendBtn}:focus-visible, ${c.textarea}:focus-visible {
    outline: none;
  }`,
]);
