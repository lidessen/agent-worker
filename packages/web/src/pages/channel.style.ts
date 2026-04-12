import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["page", "header", "backBtn", "headerInfo", "channelName", "wsLabel"] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.page} {
    margin: -${tokens.space.md};
  }
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const backBtn = rule`${c.backBtn} {
  background: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  color: ${tokens.colors.textMuted};
  padding: ${tokens.space.xs} ${tokens.space.sm};
  font-size: ${tokens.fontSizes.sm};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.backBtn}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const channelName = rule`${c.channelName} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const wsLabel = rule`${c.wsLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;
