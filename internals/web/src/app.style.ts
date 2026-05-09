import { classes, rule } from "semajsx/style";
import { tokens } from "./theme/tokens.ts";

const c = classes([
  "mobileHome",
  "mobileHead",
  "mobileBrand",
  "mobileLogo",
  "mobileTitle",
  "mobileDaemon",
  "mobileDaemonDot",
  "mobileHeadRight",
  "mobileIconBtn",
  "mobileResbar",
  "mobileResTab",
  "mobileResTabActive",
  "mobileResTabCount",
  "mobileBody",
  "mList",
  "mRow",
  "mRowDot",
  "mRowDotRunning",
  "mRowDotError",
  "mRowDotIdle",
  "mRowName",
  "mRowT",
  "mRowS",
  "mRowR",
  "mTabbar",
  "mTabbarBtn",
  "mTabbarBtnActive",
  "mobileBackBar",
  "mobileBackButton",
  "mobileBackTitle",
  "contentMount",
  "eventRow",
  "eventTs",
  "eventType",
  "eventActor",
  "eventBody",
] as const);

export const mobileHome = rule`${c.mobileHome} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${tokens.colors.background};
}`;

export const mobileHead = rule`${c.mobileHead} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid ${tokens.colors.border};
  height: 48px;
  flex-shrink: 0;
}`;

export const mobileBrand = rule`${c.mobileBrand} {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}`;

export const mobileLogo = rule`${c.mobileLogo} {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: ${tokens.colors.text};
  color: ${tokens.colors.background};
  display: grid;
  place-items: center;
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  font-weight: 600;
}`;

export const mobileTitle = rule`${c.mobileTitle} {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${tokens.colors.text};
}`;

export const mobileDaemon = rule`${c.mobileDaemon} {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 6px;
  padding: 2px 8px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textMuted};
}`;

export const mobileDaemonDot = rule`${c.mobileDaemonDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}`;

export const mobileHeadRight = rule`${c.mobileHeadRight} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}`;

export const mobileIconBtn = rule`${c.mobileIconBtn} {
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
${c.mobileIconBtn}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}`;

export const mobileResbar = rule`${c.mobileResbar} {
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 1px solid ${tokens.colors.border};
  padding: 0 6px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
${c.mobileResbar}::-webkit-scrollbar {
  display: none;
}`;

export const mobileResTab = rule`${c.mobileResTab} {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 10px;
  font-size: 12.5px;
  color: ${tokens.colors.textMuted};
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  white-space: nowrap;
}`;

export const mobileResTabActive = rule`${c.mobileResTabActive} {
  color: ${tokens.colors.text};
  border-bottom-color: ${tokens.colors.text};
}`;

export const mobileResTabCount = rule`${c.mobileResTabCount} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;

export const mobileBody = rule`${c.mobileBody} {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 80px;
  background: ${tokens.colors.background};
}`;

export const mList = rule`${c.mList} {
  display: flex;
  flex-direction: column;
}`;

export const mRow = rule`${c.mRow} {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${tokens.colors.border};
  align-items: center;
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  color: inherit;
}
${c.mRow}:hover {
  background: ${tokens.colors.surface};
}`;

export const mRowDot = rule`${c.mRowDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  justify-self: center;
  flex-shrink: 0;
}`;

export const mRowDotRunning = rule`${c.mRowDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const mRowDotError = rule`${c.mRowDotError} {
  background: ${tokens.colors.agentError};
}`;

export const mRowDotIdle = rule`${c.mRowDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const mRowName = rule`${c.mRowName} {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}`;

export const mRowT = rule`${c.mRowT} {
  color: ${tokens.colors.text};
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const mRowS = rule`${c.mRowS} {
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const mRowR = rule`${c.mRowR} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;

export const mTabbar = rule`${c.mTabbar} {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: ${tokens.colors.background};
  border-top: 1px solid ${tokens.colors.border};
  padding: 6px 4px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  backdrop-filter: blur(20px) saturate(180%);
}`;

export const mTabbarBtn = rule`${c.mTabbarBtn} {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: ${tokens.colors.textDim};
  font-size: 10.5px;
  font-family: inherit;
  padding: 6px 4px;
  border-radius: 6px;
}`;

export const mTabbarBtnActive = rule`${c.mTabbarBtnActive} {
  color: ${tokens.colors.text};
}`;

export const mobileBackBar = rule`${c.mobileBackBar} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  flex-shrink: 0;
}`;

export const mobileBackButton = rule`${c.mobileBackButton} {
  border: none;
  background: transparent;
  color: ${tokens.colors.text};
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 5px;
}
${c.mobileBackButton}:hover {
  background: ${tokens.colors.surface};
}`;

export const mobileBackTitle = rule`${c.mobileBackTitle} {
  font-size: 12.5px;
  color: ${tokens.colors.textMuted};
  font-weight: 500;
}`;

export const contentMount = rule`${c.contentMount} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}`;

export const eventRow = rule`${c.eventRow} {
  display: grid;
  grid-template-columns: 62px 80px 1fr;
  gap: 10px;
  padding: 7px 14px;
  border-bottom: 1px solid ${tokens.colors.border};
  align-items: flex-start;
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
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
  font-weight: 500;
}`;

export const eventActor = rule`${c.eventActor} {
  display: none;
}`;

export const eventBody = rule`${c.eventBody} {
  color: ${tokens.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;
