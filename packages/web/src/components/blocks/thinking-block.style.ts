import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "header", "label", "toggle", "content"] as const);

export const block = rule`${c.block} {
  margin: 4px 0;
  border-left: 2px solid ${tokens.colors.border};
  padding: 4px 0 4px 12px;
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  color: ${tokens.colors.textDim};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-right: none;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}`;

export const label = rule`${c.label} {
  font-size: 11.5px;
  color: ${tokens.colors.textDim};
  font-style: normal;
  font-family: ${tokens.fonts.mono};
}`;

export const toggle = rule`${c.toggle} {
  font-size: 10px;
  color: ${tokens.colors.textDim};
  margin-left: auto;
}`;

export const content = rule`${c.content} {
  font-family: ${tokens.fonts.base};
  color: ${tokens.colors.textMuted};
  font-size: 12.5px;
  font-style: italic;
  line-height: 1.7;
  padding-top: 4px;
  white-space: pre-wrap;
  background: transparent;
  border-radius: 0;
  max-height: 400px;
  overflow-y: auto;
}`;
