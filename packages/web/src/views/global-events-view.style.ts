import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerRow",
  "title",
  "subtitle",
  "headerRight",
  "livePill",
  "liveDot",
  "cursor",
  "filters",
  "chip",
  "chipActive",
  "spacer",
  "search",
  "searchInput",
  "content",
  "eventList",
  "eventRow",
  "eventTs",
  "eventType",
  "eventTypeMsg",
  "eventTypeTool",
  "eventTypeRun",
  "eventTypeErr",
  "eventTypeWarn",
  "eventActor",
  "eventBody",
  "emptyState",
] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${tokens.colors.background};
}`;

export const header = rule`${c.header} {
  padding: 20px 28px 16px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: 14px 14px 12px;
  }
}`;

export const headerRow = rule`${c.headerRow} {
  display: flex;
  align-items: center;
  gap: 12px;
}`;

export const title = rule`${c.title} {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${tokens.colors.text};
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}`;

export const subtitle = rule`${c.subtitle} {
  font-size: 12.5px;
  color: ${tokens.colors.textDim};
  margin-top: 4px;
  font-family: ${tokens.fonts.mono};
}`;

export const headerRight = rule`${c.headerRight} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}`;

export const livePill = rule`${c.livePill} {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.agentRunning};
  border: 1px solid ${tokens.colors.successBorder};
  background: ${tokens.colors.successSurface};
  line-height: 1.5;
}`;

export const liveDot = rule`${c.liveDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}`;

export const cursor = rule`${c.cursor} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
}`;

export const filters = rule`${c.filters} {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  ${c.filters} {
    padding: 8px 14px;
  }
}`;

export const chip = rule`${c.chip} {
  background: ${tokens.colors.background};
  border: 1px solid ${tokens.colors.border};
  border-radius: 5px;
  padding: 3px 9px;
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${tokens.fonts.mono};
  transition: border-color ${tokens.transitions.fast}, color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.chip}:hover {
  border-color: ${tokens.colors.borderStrong};
  color: ${tokens.colors.text};
}`;

export const chipActive = rule`${c.chipActive} {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderStrong};
}`;

export const spacer = rule`${c.spacer} {
  flex: 1;
}`;

export const search = rule`${c.search} {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
  background: transparent;
}
${c.search}:focus-within {
  border-color: ${tokens.colors.borderStrong};
}`;

export const searchInput = rule`${c.searchInput} {
  background: transparent;
  border: none;
  outline: none;
  color: ${tokens.colors.text};
  font-size: 11.5px;
  width: 180px;
  font-family: ${tokens.fonts.base};
}
${c.searchInput}::placeholder {
  color: ${tokens.colors.textDim};
}
@media (max-width: 640px) {
  ${c.searchInput} {
    width: 120px;
  }
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: ${tokens.colors.background};
}`;

export const eventList = rule`${c.eventList} {
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
}`;

export const eventRow = rule`${c.eventRow} {
  display: grid;
  grid-template-columns: 76px 110px 110px 1fr;
  gap: 12px;
  padding: 6px 24px;
  border-bottom: 1px solid ${tokens.colors.border};
  align-items: flex-start;
}
${c.eventRow}:last-child {
  border-bottom: none;
}
${c.eventRow}:hover {
  background: ${tokens.colors.surface};
}
@media (max-width: 640px) {
  ${c.eventRow} {
    grid-template-columns: 60px 88px 1fr;
    padding: 6px 14px;
  }
}`;

export const eventTs = rule`${c.eventTs} {
  color: ${tokens.colors.textDim};
}`;

export const eventType = rule`${c.eventType} {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: 4px;
  color: ${tokens.colors.textMuted};
  width: fit-content;
  height: fit-content;
  font-weight: 500;
}`;

export const eventTypeMsg = rule`${c.eventTypeMsg} {
  color: oklch(0.55 0.14 240);
  border-color: oklch(0.55 0.14 240 / 0.3);
  background: oklch(0.55 0.14 240 / 0.06);
}`;

export const eventTypeTool = rule`${c.eventTypeTool} {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderStrong};
}`;

export const eventTypeRun = rule`${c.eventTypeRun} {
  color: ${tokens.colors.agentRunning};
  border-color: ${tokens.colors.successBorder};
  background: ${tokens.colors.successSurface};
}`;

export const eventTypeErr = rule`${c.eventTypeErr} {
  color: ${tokens.colors.danger};
  border-color: ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
}`;

export const eventTypeWarn = rule`${c.eventTypeWarn} {
  color: ${tokens.colors.warning};
  border-color: ${tokens.colors.warningBorder};
  background: ${tokens.colors.warningSurface};
}`;

export const eventActor = rule`${c.eventActor} {
  color: ${tokens.colors.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  ${c.eventActor} {
    display: none;
  }
}`;

export const eventBody = rule`${c.eventBody} {
  color: ${tokens.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const emptyState = rule`${c.emptyState} {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${tokens.colors.textDim};
  font-size: 13px;
}`;
