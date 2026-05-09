import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "view",
  "wrap",
  "header",
  "title",
  "subtitle",
  "statGrid",
  "stat",
  "statLabel",
  "statValue",
  "statMeta",
  "section",
  "sectionLabel",
  "sectionCount",
  "sectionRight",
  "btnSmGhost",
  "resList",
  "resRow",
  "resDot",
  "dotRunning",
  "dotError",
  "dotIdle",
  "resName",
  "resNameT",
  "resNameS",
  "chans",
  "chan",
  "resMeta",
  "pill",
  "pillRunning",
  "pillError",
  "pillIdle",
  "moreH",
  "eventCard",
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
] as const);

export const view = rule`${c.view} {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: ${tokens.colors.background};
}`;

export const wrap = rule`${c.wrap} {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 28px 80px;
}
@media (max-width: 640px) {
  ${c.wrap} {
    padding: 18px 14px 80px;
  }
}`;

export const header = rule`${c.header} {
  margin-bottom: 20px;
}`;

export const title = rule`${c.title} {
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.015em;
  color: ${tokens.colors.text};
  margin: 0;
}`;

export const subtitle = rule`${c.subtitle} {
  color: ${tokens.colors.textDim};
  margin-top: 6px;
  font-size: 13px;
}`;

export const statGrid = rule`${c.statGrid} {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}
@media (max-width: 640px) {
  ${c.statGrid} {
    grid-template-columns: 1fr;
  }
}`;

export const stat = rule`${c.stat} {
  padding: 14px 16px;
  background: ${tokens.colors.background};
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}`;

export const statLabel = rule`${c.statLabel} {
  font-size: 11px;
  color: ${tokens.colors.textDim};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
}`;

export const statValue = rule`${c.statValue} {
  font-family: ${tokens.fonts.mono};
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: ${tokens.colors.text};
  line-height: 1;
}`;

export const statMeta = rule`${c.statMeta} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
  display: flex;
  align-items: center;
  gap: 6px;
}`;

export const section = rule`${c.section} {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 24px 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: ${tokens.colors.text};
  letter-spacing: -0.005em;
}`;

export const sectionLabel = rule`${c.sectionLabel} {
  color: inherit;
}`;

export const sectionCount = rule`${c.sectionCount} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;

export const sectionRight = rule`${c.sectionRight} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}`;

export const btnSmGhost = rule`${c.btnSmGhost} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: ${tokens.colors.text};
  cursor: pointer;
  font-family: inherit;
  transition: border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
${c.btnSmGhost}:hover {
  background: ${tokens.colors.surface};
  border-color: ${tokens.colors.border};
}`;

export const resList = rule`${c.resList} {
  display: flex;
  flex-direction: column;
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  overflow: hidden;
  background: ${tokens.colors.background};
}`;

export const resRow = rule`${c.resRow} {
  display: grid;
  grid-template-columns: 20px 1.2fr 1fr 0.8fr 24px;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid ${tokens.colors.border};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  color: inherit;
}
${c.resRow}:last-child {
  border-bottom: none;
}
${c.resRow}:hover {
  background: ${tokens.colors.surface};
}
@media (max-width: 640px) {
  ${c.resRow} {
    grid-template-columns: 20px 1fr 24px;
    gap: 10px;
  }
}`;

export const resDot = rule`${c.resDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  justify-self: center;
  flex-shrink: 0;
}`;

export const dotRunning = rule`${c.dotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const dotError = rule`${c.dotError} {
  background: ${tokens.colors.agentError};
}`;

export const dotIdle = rule`${c.dotIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const resName = rule`${c.resName} {
  font-size: 13px;
  color: ${tokens.colors.text};
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}`;

export const resNameT = rule`${c.resNameT} {
  font-weight: 500;
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const resNameS = rule`${c.resNameS} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const chans = rule`${c.chans} {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textMuted};
}
@media (max-width: 640px) {
  ${c.chans} {
    display: none;
  }
}`;

export const chan = rule`${c.chan} {
  padding: 1px 6px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: 4px;
}`;

export const resMeta = rule`${c.resMeta} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
@media (max-width: 640px) {
  ${c.resMeta} {
    display: none;
  }
}`;

export const pill = rule`${c.pill} {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
  line-height: 1.5;
}`;

export const pillRunning = rule`${c.pillRunning} {
  color: ${tokens.colors.agentRunning};
  border-color: ${tokens.colors.successBorder};
  background: ${tokens.colors.successSurface};
}`;

export const pillError = rule`${c.pillError} {
  color: ${tokens.colors.agentError};
  border-color: ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
}`;

export const pillIdle = rule`${c.pillIdle} {
  color: ${tokens.colors.textMuted};
}`;

export const moreH = rule`${c.moreH} {
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tokens.colors.textMuted};
  padding: 6px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  font-family: inherit;
}
${c.moreH}:hover {
  background: ${tokens.colors.surfaceHover};
  color: ${tokens.colors.text};
}`;

export const eventCard = rule`${c.eventCard} {
  overflow: hidden;
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  background: ${tokens.colors.background};
}`;

export const eventList = rule`${c.eventList} {
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
}`;

export const eventRow = rule`${c.eventRow} {
  display: grid;
  grid-template-columns: 76px 110px 70px 1fr;
  gap: 12px;
  padding: 6px 14px;
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
