import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "channelName",
  "wsLabel",
  "headerActions",
  "clearBtn",
] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${tokens.colors.background};
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: 12px 14px;
    gap: 8px;
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}`;

export const channelName = rule`${c.channelName} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${tokens.colors.text};
}`;

export const wsLabel = rule`${c.wsLabel} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  padding: 2px 7px;
  background: ${tokens.colors.surface};
}`;

export const headerActions = rule`${c.headerActions} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}`;

export const clearBtn = rule`${c.clearBtn} {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: ${tokens.colors.textMuted};
  font-size: 11.5px;
  font-weight: 500;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.clearBtn}:hover {
  color: ${tokens.colors.danger};
  border-color: ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
}`;
