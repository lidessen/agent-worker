import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "viewer",
  "header",
  "title",
  "toolbar",
  "toolbarBtn",
  "toolbarBtnActive",
  "contentPre",
  "editArea",
] as const);

export const viewer = rule`${c.viewer} {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.space.md};
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
  }
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
}`;

export const toolbar = rule`${c.toolbar} {
  display: flex;
  gap: ${tokens.space.sm};
  flex-shrink: 0;
}`;

export const toolbarBtn = rule`${c.toolbarBtn} {
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  color: ${tokens.colors.textMuted};
  padding: 6px ${tokens.space.md};
  font-size: ${tokens.fontSizes.xs};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.toolbarBtn}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const toolbarBtnActive = rule`${c.toolbarBtnActive} {
  background: linear-gradient(180deg, rgba(248, 244, 240, 0.92) 0%, rgba(224, 220, 216, 0.9) 100%);
  color: #111111;
  border-color: rgba(255, 255, 255, 0.28);
}
${c.toolbarBtnActive}:hover {
  color: #111111;
}`;

export const contentPre = rule`${c.contentPre} {
  margin: 0;
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.xl};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  line-height: 1.6;
}`;

export const editArea = rule`${c.editArea} {
  width: 100%;
  flex: 1;
  min-height: 0;
  resize: none;
  border: none;
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.xl};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  background: transparent;
  line-height: 1.6;
}
${c.editArea}:focus {
  outline: none;
}`;
