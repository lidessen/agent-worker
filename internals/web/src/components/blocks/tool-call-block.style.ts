import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "card",
  "cardOpen",
  "head",
  "icon",
  "name",
  "args",
  "duration",
  "chev",
  "body",
  "panel",
  "lbl",
  "pre",
  "preError",
  "statusDot",
  "statusDotPending",
  "statusDotSuccess",
  "statusDotError",
  "statusDotProcessing",
  "pending",
] as const);

export const card = rule`${c.card} {
  margin: 6px 0;
  border: 1px solid ${tokens.colors.border};
  border-radius: 9px;
  background: ${tokens.colors.background};
  overflow: hidden;
  transition: border-color ${tokens.transitions.fast};
}
${c.card}:hover {
  border-color: ${tokens.colors.borderStrong};
}`;

export const cardOpen = rule`${c.cardOpen} {
  border-color: ${tokens.colors.borderStrong};
}`;

export const head = rule`${c.head} {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  user-select: none;
}`;

export const icon = rule`${c.icon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${tokens.colors.textMuted};
  flex-shrink: 0;
}`;

export const name = rule`${c.name} {
  color: ${tokens.colors.text};
  font-weight: 500;
  flex-shrink: 0;
}`;

export const args = rule`${c.args} {
  color: ${tokens.colors.textDim};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}`;

export const duration = rule`${c.duration} {
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;

export const chev = rule`${c.chev} {
  color: ${tokens.colors.textDim};
  transition: transform 120ms;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}
${c.cardOpen} ${c.chev} {
  transform: rotate(90deg);
}`;

export const body = rule`${c.body} {
  padding: 10px 12px 12px;
  border-top: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.backgroundElevated};
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 900px) {
  ${c.body} {
    grid-template-columns: 1fr;
  }
}`;

export const panel = rule`${c.panel} {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}`;

export const lbl = rule`${c.lbl} {
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${tokens.colors.textDim};
}`;

export const pre = rule`${c.pre} {
  margin: 0;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  padding: 8px 10px;
  border-radius: 6px;
  font-family: ${tokens.fonts.mono};
  font-size: 11.5px;
  color: ${tokens.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 220px;
  overflow-y: auto;
}`;

export const preError = rule`${c.preError} {
  color: ${tokens.colors.danger};
}`;

export const statusDot = rule`${c.statusDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
@keyframes aw-fade-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}`;

export const statusDotPending = rule`${c.statusDotPending} {
  background: ${tokens.colors.agentIdle};
}`;

export const statusDotSuccess = rule`${c.statusDotSuccess} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
}`;

export const statusDotError = rule`${c.statusDotError} {
  background: ${tokens.colors.agentError};
}`;

export const statusDotProcessing = rule`${c.statusDotProcessing} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const pending = rule`${c.pending} {
  padding: 8px 12px;
  border-top: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.backgroundElevated};
  font-family: ${tokens.fonts.mono};
  font-size: 11px;
  color: ${tokens.colors.textDim};
  display: flex;
  align-items: center;
  gap: 6px;
}`;
