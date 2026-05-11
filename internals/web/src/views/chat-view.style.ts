import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "view",
  "header",
  "title",
  "subtitle",
  "transcript",
  "turn",
  "turnUser",
  "turnAssistant",
  "turnRow",
  "turnRoleLabel",
  "turnContent",
  "turnError",
  "thinking",
  "thinkingDot",
  "footer",
  "input",
  "inputHint",
  "submit",
  "empty",
  "activities",
  "activity",
  "activityRunning",
  "activityDone",
  "activityError",
  "activityName",
  "activitySummary",
  "activityTime",
]);

export const view = rule`${c.view} {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}`;

export const header = rule`${c.header} {
  padding: ${tokens.space.lg} ${tokens.space.xl};
  border-bottom: 1px solid ${tokens.colors.border};
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const subtitle = rule`${c.subtitle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  margin-top: 2px;
}`;

export const transcript = rule`${c.transcript} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.lg} ${tokens.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
}`;

export const turn = rule`${c.turn} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
  max-width: 80%;
}`;

export const turnUser = rule`${c.turnUser} {
  align-self: flex-end;
  align-items: flex-end;
}`;

export const turnAssistant = rule`${c.turnAssistant} {
  align-self: flex-start;
  align-items: flex-start;
}`;

export const turnRoleLabel = rule`${c.turnRoleLabel} {
  font-size: ${tokens.fontSizes.xxs};
  color: ${tokens.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`;

export const turnContent = rule`${c.turnContent} {
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.md} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}`;

export const turnError = rule`${c.turnError} {
  border-color: ${tokens.colors.dangerBorder};
  background: ${tokens.colors.dangerSurface};
  color: ${tokens.colors.danger};
}`;

export const thinking = rule`${c.thinking} {
  align-self: flex-start;
  display: inline-flex;
  gap: ${tokens.space.xs};
  align-items: center;
  padding: ${tokens.space.md} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const thinkingDot = rule`${c.thinkingDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  background: ${tokens.colors.textMuted};
  animation: chat-thinking 1.2s infinite ease-in-out;
}`;

export const footer = rule`${c.footer} {
  border-top: 1px solid ${tokens.colors.border};
  padding: ${tokens.space.md} ${tokens.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const input = rule`${c.input} {
  width: 100%;
  resize: none;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
  font-family: ${tokens.fonts.base};
  color: ${tokens.colors.text};
  min-height: 60px;
}`;

export const inputHint = rule`${c.inputHint} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  display: flex;
  justify-content: space-between;
}`;

export const submit = rule`${c.submit} {
  align-self: flex-end;
  padding: ${tokens.space.xs} ${tokens.space.lg};
  background: ${tokens.colors.buttonPrimary};
  color: ${tokens.colors.buttonPrimaryText};
  border: 1px solid ${tokens.colors.buttonPrimaryBorder};
  border-radius: ${tokens.radii.sm};
  font-size: ${tokens.fontSizes.sm};
  cursor: pointer;
}`;

export const activities = rule`${c.activities} {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: ${tokens.space.xs} 0;
  margin-bottom: ${tokens.space.xs};
}`;

export const activity = rule`${c.activity} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.sm};
  font-size: ${tokens.fontSizes.xs};
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.textMuted};
  padding: 2px ${tokens.space.sm};
  border-left: 2px solid ${tokens.colors.border};
}`;

export const activityRunning = rule`${c.activityRunning} {
  border-left-color: ${tokens.colors.accent};
  color: ${tokens.colors.text};
}`;

export const activityDone = rule`${c.activityDone} {
  border-left-color: ${tokens.colors.border};
}`;

export const activityError = rule`${c.activityError} {
  border-left-color: ${tokens.colors.dangerBorder};
  color: ${tokens.colors.danger};
}`;

export const activityName = rule`${c.activityName} {
  font-weight: ${tokens.fontWeights.semibold};
  color: inherit;
}`;

export const activitySummary = rule`${c.activitySummary} {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}`;

export const activityTime = rule`${c.activityTime} {
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xxs};
}`;

export const empty = rule`${c.empty} {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.sm};
}`;
