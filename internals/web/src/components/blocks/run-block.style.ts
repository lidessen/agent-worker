import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "rail",
  "railRunning",
  "dot",
  "label",
  "detail",
  "detailInline",
  "detailIcon",
  "divider",
] as const);

export const rail = rule`${c.rail} {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 4px;
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
}`;

export const railRunning = rule`${c.railRunning} {
  color: ${tokens.colors.textDim};
}`;

export const dot = rule`${c.dot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${tokens.colors.agentIdle};
  flex-shrink: 0;
}
${c.railRunning} ${c.dot} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const label = rule`${c.label} {
  white-space: nowrap;
  color: ${tokens.colors.textDim};
}`;

export const divider = rule`${c.divider} {
  flex: 1;
  height: 1px;
  background: ${tokens.colors.border};
}`;

export const detail = rule`${c.detail} {
  color: ${tokens.colors.textDim};
  white-space: nowrap;
}`;

export const detailInline = rule`${c.detailInline} {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}`;

export const detailIcon = rule`${c.detailIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}`;
