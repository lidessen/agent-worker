import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "wsName",
  "badge",
  "badgeDot",
  "badgeDotIdle",
  "badgeDotRunning",
  "badgeDotError",
  "badgeDotCompleted",
  "modeTag",
  "content",
  "hero",
  "heroCopy",
  "heroEyebrow",
  "heroTitle",
  "heroText",
  "statGrid",
  "statCard",
  "statLabel",
  "statValue",
  "statValueSmall",
  "section",
  "sectionHeader",
  "sectionTitle",
  "count",
  "agentList",
  "agentItem",
  "agentLabel",
  "agentRuntimeIcon",
  "agentDot",
  "agentDotIdle",
  "agentDotRunning",
  "agentDotError",
  "agentDotCompleted",
  "channelList",
  "channelItem",
  "configBlock",
  "configRow",
  "configLabel",
  "configValue",
  "errorBanner",
  "emptyStateText",
  "loopDotIdle",
  "loopDotRunning",
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
  padding: 20px 28px 16px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: 14px 16px;
    gap: 8px;
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}`;

export const wsName = rule`${c.wsName} {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${tokens.colors.text};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  padding: 2px 7px;
  background: ${tokens.colors.surface};
  font-family: ${tokens.fonts.mono};
  line-height: 1.5;
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const badgeDotIdle = rule`${c.badgeDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;
export const badgeDotRunning = rule`${c.badgeDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;
export const badgeDotError = rule`${c.badgeDotError} {
  background: ${tokens.colors.agentError};
}`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} {
  background: ${tokens.colors.agentCompleted};
}`;

export const modeTag = rule`${c.modeTag} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textMuted};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  padding: 2px 7px;
  border-radius: 999px;
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1240px;
  margin: 0 auto;
  width: 100%;
}
@media (max-width: 640px) {
  ${c.content} {
    padding: 14px 14px 80px;
  }
}`;

/* The hero is kept for backward compatibility but rendered as a slim
   overview strip, not a big card. */
export const hero = rule`${c.hero} {
  display: none;
}`;

export const heroCopy = rule`${c.heroCopy} {
  display: none;
}`;

export const heroEyebrow = rule`${c.heroEyebrow} {
  display: none;
}`;

export const heroTitle = rule`${c.heroTitle} {
  display: none;
}`;

export const heroText = rule`${c.heroText} {
  display: none;
}`;

export const statGrid = rule`${c.statGrid} {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 0;
}
@media (max-width: 640px) {
  ${c.statGrid} {
    grid-template-columns: 1fr;
  }
}`;

export const statCard = rule`${c.statCard} {
  padding: 14px 16px;
  background: ${tokens.colors.background};
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex-shrink: 0;
}`;

export const statLabel = rule`${c.statLabel} {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
  color: ${tokens.colors.textDim};
}`;

export const statValue = rule`${c.statValue} {
  font-family: ${tokens.fonts.mono};
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: ${tokens.colors.text};
  line-height: 1;
}`;

export const statValueSmall = rule`${c.statValueSmall} {
  font-size: 13px;
  line-height: 1.3;
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.text};
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  border-radius: 9px;
  background: ${tokens.colors.background};
  border: 1px solid ${tokens.colors.border};
  overflow: hidden;
  flex-shrink: 0;
}`;

export const sectionHeader = rule`${c.sectionHeader} {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid ${tokens.colors.border};
  font-size: 12px;
  font-weight: 500;
  color: ${tokens.colors.text};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: 12px;
  font-weight: 500;
  color: ${tokens.colors.text};
  letter-spacing: -0.005em;
}`;

export const count = rule`${c.count} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
  padding: 1px 6px;
  border-radius: 999px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  line-height: 1.4;
}`;

export const agentList = rule`${c.agentList} {
  display: flex;
  flex-direction: column;
}`;

export const agentItem = rule`${c.agentItem} {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  font-size: 12.5px;
  color: ${tokens.colors.text};
  cursor: pointer;
  border-bottom: 1px solid ${tokens.colors.border};
  transition: background ${tokens.transitions.fast};
}
${c.agentItem}:last-child {
  border-bottom: none;
}
${c.agentItem}:hover {
  background: ${tokens.colors.surface};
}`;

export const agentLabel = rule`${c.agentLabel} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}`;

export const agentRuntimeIcon = rule`${c.agentRuntimeIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: ${tokens.colors.textDim};
  flex: 0 0 auto;
}`;

export const agentDot = rule`${c.agentDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const agentDotIdle = rule`${c.agentDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;
export const agentDotRunning = rule`${c.agentDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;
export const agentDotError = rule`${c.agentDotError} {
  background: ${tokens.colors.agentError};
}`;
export const agentDotCompleted = rule`${c.agentDotCompleted} {
  background: ${tokens.colors.agentCompleted};
}`;

export const channelList = rule`${c.channelList} {
  display: flex;
  flex-direction: column;
}`;

export const channelItem = rule`${c.channelItem} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-family: ${tokens.fonts.mono};
  font-size: 12.5px;
  color: ${tokens.colors.text};
  cursor: pointer;
  border-bottom: 1px solid ${tokens.colors.border};
  transition: background ${tokens.transitions.fast};
}
${c.channelItem}:last-child {
  border-bottom: none;
}
${c.channelItem}:hover {
  background: ${tokens.colors.surface};
}`;

export const configBlock = rule`${c.configBlock} {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
}`;

export const configRow = rule`${c.configRow} {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  font-size: 12px;
  padding: 2px 0;
}`;

export const configLabel = rule`${c.configLabel} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
}`;

export const configValue = rule`${c.configValue} {
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  color: ${tokens.colors.text};
  overflow-wrap: anywhere;
}`;

export const errorBanner = rule`${c.errorBanner} {
  font-size: 12.5px;
  color: ${tokens.colors.danger};
  padding: 10px 12px;
  border: 1px solid ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
  border-radius: 9px;
}`;

export const emptyStateText = rule`${c.emptyStateText} {
  font-size: 12.5px;
  color: ${tokens.colors.textDim};
  padding: 14px;
}`;

export const loopDotIdle = rule`${c.loopDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;
export const loopDotRunning = rule`${c.loopDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

/* ── Danger Zone ────────────────────────────────────────────────────── */

const d = classes([
  "dangerSection",
  "dangerBtn",
  "loopList",
  "loopItem",
  "loopDot",
  "loopName",
  "eventList",
  "eventItem",
  "eventTime",
  "eventType",
  "eventDetail",
] as const);

export const dangerSection = rule`${d.dangerSection} {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 9px;
  background: ${tokens.colors.background};
  border: 1px solid ${tokens.colors.dangerBorder};
  flex-shrink: 0;
}`;

export const dangerBtn = rule`${d.dangerBtn} {
  border: 1px solid ${tokens.colors.dangerBorder};
  border-radius: 6px;
  background: transparent;
  color: ${tokens.colors.danger};
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  align-self: flex-start;
  font-family: inherit;
}
${d.dangerBtn}:hover {
  background: ${tokens.colors.dangerSurface};
}`;

export const loopList = rule`${d.loopList} {
  display: flex;
  flex-direction: column;
}`;

export const loopItem = rule`${d.loopItem} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-family: ${tokens.fonts.mono};
  font-size: 12px;
  color: ${tokens.colors.text};
  border-bottom: 1px solid ${tokens.colors.border};
}
${d.loopItem}:last-child {
  border-bottom: none;
}`;

export const loopDot = rule`${d.loopDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const loopName = rule`${d.loopName} {
  font-family: ${tokens.fonts.mono};
  font-size: 12px;
}`;

export const eventList = rule`${d.eventList} {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow-y: auto;
  font-family: ${tokens.fonts.mono};
}`;

export const eventItem = rule`${d.eventItem} {
  display: grid;
  grid-template-columns: 100px 140px 1fr;
  align-items: baseline;
  gap: 12px;
  padding: 6px 14px;
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
  border-bottom: 1px solid ${tokens.colors.border};
}
${d.eventItem}:last-child {
  border-bottom: none;
}
${d.eventItem}:hover {
  background: ${tokens.colors.surface};
}`;

export const eventTime = rule`${d.eventTime} {
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;

export const eventType = rule`${d.eventType} {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${tokens.colors.textMuted};
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`;

export const eventDetail = rule`${d.eventDetail} {
  color: ${tokens.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}`;
