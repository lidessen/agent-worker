import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

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
  border-left: 3px solid ${t.chat.toolBorder};
  padding: 0.5rem 0.75rem;
  background: ${t.chat.toolBg};
  border-radius: 0 6px 6px 0;
  margin: 0.25rem 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}`;

export const toolIcon = rule`${c.toolIcon} {
  font-size: 0.8125rem;
  flex-shrink: 0;
}`;

export const toolName = rule`${c.toolName} {
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${t.chat.assistantText};
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
  font-size: 0.75rem;
  color: ${t.chat.statusText};
  margin-left: auto;
}`;

export const args = rule`${c.args} {
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: ${t.chat.thinkingText};
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: ${t.chat.inputBg};
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
}`;

export const resultSection = rule`${c.resultSection} {
  margin-top: 0.5rem;
}`;

export const resultToggle = rule`${c.resultToggle} {
  font-size: 0.75rem;
  color: ${t.chat.statusText};
  cursor: pointer;
  background: none;
  border: none;
  padding: 0.25rem 0;
  transition: color 0.15s ease;
}
${c.resultToggle}:hover {
  color: ${t.chat.assistantText};
}`;

export const result = rule`${c.result} {
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: ${t.chat.thinkingText};
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 0.25rem;
  padding: 0.5rem;
  background: ${t.chat.inputBg};
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
}`;

export const pending = rule`${c.pending} {
  font-size: 0.75rem;
  color: ${t.chat.statusText};
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}`;

export const duration = rule`${c.duration} {
  font-size: 0.75rem;
  color: ${t.chat.statusText};
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  background: ${t.chat.inputBg};
  padding: 1px 0.25rem;
  border-radius: 6px;
}`;
