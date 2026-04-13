import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "page",
  "header",
  "backBtn",
  "headerInfo",
  "wsName",
  "badge",
  "badgeDot",
  "badgeDotRunning",
  "badgeDotStopped",
  "badgeDotError",
  "badgeDotCompleted",
  "content",
  "section",
  "sectionHeader",
  "sectionTitle",
  "count",
  "agentList",
  "agentItem",
  "agentDot",
  "channelList",
  "channelItem",
  "docList",
  "docItem",
  "docItemName",
  "docItemActions",
  "modeTag",
  "errorBanner",
  "emptyStateText",
  "taskList",
  "taskItem",
  "taskHeader",
  "taskTitle",
  "taskStatusBadge",
  "taskMeta",
  "taskGoal",
  "taskDetail",
  "taskDetailLoading",
  "taskDetailSection",
  "taskDetailHeader",
  "taskDetailItem",
  "taskDetailText",
  "taskDetailBadge",
] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.page} {
    margin: -${tokens.space.md};
  }
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const backBtn = rule`${c.backBtn} {
  background: none;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  color: ${tokens.colors.textMuted};
  padding: ${tokens.space.xs} ${tokens.space.sm};
  font-size: ${tokens.fontSizes.sm};
  cursor: pointer;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.backBtn}:hover {
  color: ${tokens.colors.text};
  border-color: ${tokens.colors.borderHover};
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const wsName = rule`${c.wsName} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const badgeDotRunning = rule`${c.badgeDotRunning} { background: ${tokens.colors.agentRunning}; }`;
export const badgeDotStopped = rule`${c.badgeDotStopped} { background: ${tokens.colors.agentIdle}; }`;
export const badgeDotError = rule`${c.badgeDotError} { background: ${tokens.colors.agentError}; }`;
export const badgeDotCompleted = rule`${c.badgeDotCompleted} { background: ${tokens.colors.agentCompleted}; }`;

export const modeTag = rule`${c.modeTag} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  background: ${tokens.colors.surfaceHover};
  padding: 2px ${tokens.space.sm};
  border-radius: ${tokens.radii.sm};
}`;

export const errorBanner = rule`${c.errorBanner} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.danger};
}`;

export const emptyStateText = rule`${c.emptyStateText} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.content} {
    padding: ${tokens.space.md};
  }
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
}`;

export const sectionHeader = rule`${c.sectionHeader} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.sm};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const count = rule`${c.count} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const agentList = rule`${c.agentList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const agentItem = rule`${c.agentItem} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
}`;

export const agentDot = rule`${c.agentDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
  background: ${tokens.colors.agentIdle};
}`;

export const channelList = rule`${c.channelList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const channelItem = rule`${c.channelItem} {
  display: flex;
  align-items: center;
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.primary};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.channelItem}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}`;

export const docList = rule`${c.docList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const docItem = rule`${c.docItem} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
}
${c.docItem}:hover {
  background: ${tokens.colors.surfaceHover};
  border-color: ${tokens.colors.borderHover};
}`;

export const docItemName = rule`${c.docItemName} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
}`;

export const docItemActions = rule`${c.docItemActions} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const taskList = rule`${c.taskList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
}`;

export const taskItem = rule`${c.taskItem} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
}`;

export const taskHeader = rule`${c.taskHeader} {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tokens.space.sm};
}`;

export const taskTitle = rule`${c.taskTitle} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const taskStatusBadge = rule`${c.taskStatusBadge} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  background: ${tokens.colors.surfaceHover};
  padding: 2px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
  font-family: ${tokens.fonts.mono};
}`;

export const taskMeta = rule`${c.taskMeta} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  display: flex;
  gap: ${tokens.space.md};
}`;

export const taskGoal = rule`${c.taskGoal} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
}`;

export const taskHeaderClickable = rule`${c.taskHeader} {
  cursor: pointer;
}
${c.taskHeader}:hover ${c.taskTitle} {
  color: ${tokens.colors.primary};
}`;

export const taskDetail = rule`${c.taskDetail} {
  margin-top: ${tokens.space.sm};
  padding-top: ${tokens.space.sm};
  border-top: 1px dashed ${tokens.colors.border};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
}`;

export const taskDetailLoading = rule`${c.taskDetailLoading} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  font-style: italic;
}`;

export const taskDetailSection = rule`${c.taskDetailSection} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const taskDetailHeader = rule`${c.taskDetailHeader} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`;

export const taskDetailItem = rule`${c.taskDetailItem} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  padding: ${tokens.space.xs} 0;
}
${c.taskDetailItem} code {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const taskDetailText = rule`${c.taskDetailText} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  margin-top: 2px;
  white-space: pre-wrap;
}`;

export const taskDetailBadge = rule`${c.taskDetailBadge} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  background: ${tokens.colors.surfaceHover};
  padding: 1px 6px;
  border-radius: ${tokens.radii.pill};
  font-family: ${tokens.fonts.mono};
}`;
