import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "panel",
  "section",
  "sectionHeader",
  "sectionToggle",
  "sectionBody",
  "sectionBodyHidden",
  "stateBadge",
  "stateDot",
  "stateIdle",
  "stateRunning",
  "stateProcessing",
  "stateError",
  "stateCompleted",
  "itemList",
  "item",
  "itemId",
  "itemContent",
  "itemMeta",
  "emptyState",
  "chevron",
  "chevronOpen",
  "countSuffix",
  "kvList",
  "kv",
  "kvKey",
  "kvValue",
  "todoCheckbox",
] as const);

export const panel = rule`${c.panel} {
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  background: ${tokens.colors.background};
  overflow: hidden;
  display: flex;
  flex-direction: column;
}`;

export const section = rule`${c.section} {
  border-bottom: 1px solid ${tokens.colors.border};
}
${c.section}:last-child {
  border-bottom: none;
}`;

export const sectionHeader = rule`${c.sectionHeader} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${tokens.colors.textDim};
  transition: background ${tokens.transitions.fast};
}
${c.sectionHeader}:hover {
  background: ${tokens.colors.surface};
}`;

export const sectionToggle = rule`${c.sectionToggle} {
  display: inline-flex;
}`;

export const chevron = rule`${c.chevron} {
  margin-left: auto;
  transition: transform ${tokens.transitions.fast};
  transform: rotate(-90deg);
  color: ${tokens.colors.textDim};
  display: inline-flex;
  align-items: center;
}`;

export const chevronOpen = rule`${c.chevronOpen} {
  transform: rotate(0deg);
}`;

export const countSuffix = rule`${c.countSuffix} {
  color: ${tokens.colors.textDim};
  font-family: ${tokens.fonts.mono};
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 10.5px;
  margin-left: 6px;
}`;

export const sectionBody = rule`${c.sectionBody} {
  padding: 0 14px 14px;
}`;

export const sectionBodyHidden = rule`${c.sectionBodyHidden} {
  display: none;
}`;

export const stateBadge = rule`${c.stateBadge} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
}`;

export const stateDot = rule`${c.stateDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const stateIdle = rule`${c.stateIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const stateRunning = rule`${c.stateRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const stateProcessing = rule`${c.stateProcessing} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const stateError = rule`${c.stateError} {
  background: ${tokens.colors.agentError};
}`;

export const stateCompleted = rule`${c.stateCompleted} {
  background: ${tokens.colors.agentCompleted};
}`;

export const itemList = rule`${c.itemList} {
  display: flex;
  flex-direction: column;
  gap: 6px;
}`;

export const item = rule`${c.item} {
  padding: 8px 10px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 6px;
  background: ${tokens.colors.background};
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}`;

export const itemId = rule`${c.itemId} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}`;

export const itemContent = rule`${c.itemContent} {
  font-size: 12px;
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 80px;
  overflow: hidden;
  line-height: 1.45;
}`;

export const itemMeta = rule`${c.itemMeta} {
  display: flex;
  gap: 8px;
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;

export const emptyState = rule`${c.emptyState} {
  font-size: 11.5px;
  color: ${tokens.colors.textDim};
  padding: 6px 0;
}`;

export const kvList = rule`${c.kvList} {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}`;

export const kv = rule`${c.kv} {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  font-size: 12px;
  padding: 2px 0;
}`;

export const kvKey = rule`${c.kvKey} {
  color: ${tokens.colors.textDim};
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
}`;

export const kvValue = rule`${c.kvValue} {
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  overflow-wrap: anywhere;
}`;

export const todoCheckbox = rule`${c.todoCheckbox} {
  accent-color: ${tokens.colors.text};
  margin-top: 2px;
}`;
