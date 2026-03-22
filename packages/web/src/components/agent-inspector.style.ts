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
] as const);

export const panel = rule`${c.panel} {
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  overflow-y: auto;
  max-height: 40vh;
  flex-shrink: 0;
  box-shadow: ${tokens.shadows.inset};
}
@media (min-width: 961px) {
  ${c.panel} {
    max-height: none;
    border-bottom: 1px solid ${tokens.colors.border};
    border-left: 1px solid ${tokens.colors.border};
    overflow-y: auto;
  }
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
  justify-content: space-between;
  padding: ${tokens.space.sm} ${tokens.space.md};
  cursor: pointer;
  user-select: none;
  font-size: ${tokens.fontSizes.xs};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color ${tokens.transitions.fast};
}
${c.sectionHeader}:hover {
  color: ${tokens.colors.text};
}`;

export const sectionToggle = rule`${c.sectionToggle} {}`;

export const chevron = rule`${c.chevron} {
  display: inline-block;
  font-size: ${tokens.fontSizes.xs};
  transition: transform ${tokens.transitions.fast};
  transform: rotate(-90deg);
  color: ${tokens.colors.textDim};
}`;

export const chevronOpen = rule`${c.chevronOpen} {
  transform: rotate(0deg);
}`;

export const countSuffix = rule`${c.countSuffix} {
  color: ${tokens.colors.textDim};
  font-weight: ${tokens.fontWeights.normal};
}`;

export const sectionBody = rule`${c.sectionBody} {
  padding: 0 ${tokens.space.md} ${tokens.space.sm};
}`;

export const sectionBodyHidden = rule`${c.sectionBodyHidden} {
  display: none;
}`;

export const stateBadge = rule`${c.stateBadge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
}`;

export const stateDot = rule`${c.stateDot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const stateIdle = rule`${c.stateIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const stateRunning = rule`${c.stateRunning} {
  background: ${tokens.colors.agentRunning};
}`;

export const stateProcessing = rule`${c.stateProcessing} {
  background: ${tokens.colors.agentRunning};
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
  gap: ${tokens.space.xs};
}`;

export const item = rule`${c.item} {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${tokens.space.xs} ${tokens.space.sm};
  background: ${tokens.colors.input};
  border-radius: ${tokens.radii.lg};
  border: 1px solid ${tokens.colors.border};
}`;

export const itemId = rule`${c.itemId} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}`;

export const itemContent = rule`${c.itemContent} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60px;
  overflow: hidden;
}`;

export const itemMeta = rule`${c.itemMeta} {
  display: flex;
  gap: ${tokens.space.sm};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const emptyState = rule`${c.emptyState} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  padding: ${tokens.space.xs} 0;
}`;
