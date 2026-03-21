import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "block",
  "header",
  "toolIcon",
  "toolName",
  "statusDot",
  "toggle",
  "args",
  "result",
  "resultSection",
  "resultToggle",
  "pending",
  "duration",
] as const);

export const block = rule`${c.block} {
  border-left: 3px solid ${tokens.colors.border};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surface};
  border-radius: 0 ${tokens.radii.sm} ${tokens.radii.sm} 0;
  margin: ${tokens.space.xs} 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  cursor: pointer;
  user-select: none;
}`;

export const toolIcon = rule`${c.toolIcon} {
  font-size: ${tokens.fontSizes.sm};
  flex-shrink: 0;
}`;

export const toolName = rule`${c.toolName} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const statusDot = rule`${c.statusDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}`;

export const toggle = rule`${c.toggle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  margin-left: auto;
}`;

export const args = rule`${c.args} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: ${tokens.space.sm};
  padding: ${tokens.space.sm};
  background: ${tokens.colors.background};
  border-radius: ${tokens.radii.sm};
  max-height: 300px;
  overflow-y: auto;
}`;

export const resultSection = rule`${c.resultSection} {
  margin-top: ${tokens.space.sm};
}`;

export const resultToggle = rule`${c.resultToggle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  cursor: pointer;
  background: none;
  border: none;
  padding: ${tokens.space.xs} 0;
  transition: color ${tokens.transitions.fast};
}
${c.resultToggle}:hover {
  color: ${tokens.colors.text};
}`;

export const result = rule`${c.result} {
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: ${tokens.space.xs};
  padding: ${tokens.space.sm};
  background: ${tokens.colors.background};
  border-radius: ${tokens.radii.sm};
  max-height: 300px;
  overflow-y: auto;
}`;

export const pending = rule`${c.pending} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  margin-top: ${tokens.space.sm};
  display: flex;
  align-items: center;
  gap: ${tokens.space.xs};
}`;

export const duration = rule`${c.duration} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  font-family: ${tokens.fonts.mono};
  background: ${tokens.colors.background};
  padding: 1px ${tokens.space.xs};
  border-radius: ${tokens.radii.sm};
}`;
