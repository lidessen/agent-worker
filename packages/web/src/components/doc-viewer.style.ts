import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "viewer",
  "toolbar",
  "toolbarBtn",
  "toolbarBtnActive",
  "contentPre",
  "editArea",
] as const);

export const viewer = rule`${c.viewer} {
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  margin-top: ${tokens.space.xs};
  overflow: hidden;
}`;

export const toolbar = rule`${c.toolbar} {
  display: flex;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surfaceHover};
}`;

export const toolbarBtn = rule`${c.toolbarBtn} {
  background: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  color: ${tokens.colors.textMuted};
  padding: 2px ${tokens.space.sm};
  font-size: ${tokens.fontSizes.xs};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.toolbarBtn}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const toolbarBtnActive = rule`${c.toolbarBtnActive} {
  background: ${tokens.colors.primary};
  color: #fff;
  border-color: ${tokens.colors.primary};
}
${c.toolbarBtnActive}:hover {
  color: #fff;
}`;

export const contentPre = rule`${c.contentPre} {
  margin: 0;
  padding: ${tokens.space.md};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
}`;

export const editArea = rule`${c.editArea} {
  width: 100%;
  min-height: 200px;
  max-height: 400px;
  resize: vertical;
  border: none;
  padding: ${tokens.space.md};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  background: ${tokens.colors.background};
  line-height: 1.6;
}
${c.editArea}:focus {
  outline: none;
}`;
