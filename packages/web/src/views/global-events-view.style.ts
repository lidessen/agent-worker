import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "title",
  "badge",
  "content",
  "eventList",
  "eventItem",
  "eventTime",
  "eventType",
  "eventAgent",
  "eventDetail",
  "emptyState",
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  flex-shrink: 0;
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 4px ${tokens.space.sm};
  background: ${tokens.colors.surfaceSecondary};
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.xl};
}`;

export const eventList = rule`${c.eventList} {
  display: flex;
  flex-direction: column;
  gap: 1px;
}`;

export const eventItem = rule`${c.eventItem} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  border-radius: ${tokens.radii.md};
  transition: background ${tokens.transitions.fast};
}
${c.eventItem}:hover {
  background: rgba(255, 255, 255, 0.03);
}`;

export const eventTime = rule`${c.eventTime} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
  min-width: 80px;
}`;

export const eventType = rule`${c.eventType} {
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.text};
  flex-shrink: 0;
  min-width: 120px;
}`;

export const eventAgent = rule`${c.eventAgent} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.primary};
  flex-shrink: 0;
}`;

export const eventDetail = rule`${c.eventDetail} {
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}`;

export const emptyState = rule`${c.emptyState} {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${tokens.colors.textDim};
  font-size: ${tokens.fontSizes.sm};
}`;
