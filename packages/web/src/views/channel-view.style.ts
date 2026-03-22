import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "channelName",
  "wsLabel",
] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.backgroundElevated};
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  flex-wrap: wrap;
}`;

export const channelName = rule`${c.channelName} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.sm};
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
}`;

export const wsLabel = rule`${c.wsLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 4px ${tokens.space.sm};
  background: ${tokens.colors.badge};
}`;

const d = classes(["headerActions", "clearBtn"] as const);

export const headerActions = rule`${d.headerActions} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const clearBtn = rule`${d.clearBtn} {
  background: transparent;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xs};
  padding: 4px ${tokens.space.sm};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${d.clearBtn}:hover {
  color: ${tokens.colors.danger};
  border-color: ${tokens.colors.danger};
  background: rgba(255, 69, 58, 0.08);
}`;
