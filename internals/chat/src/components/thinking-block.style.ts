import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["block", "header", "label", "toggle", "content"] as const);

export const block = rule`${c.block} {
  border-left: 3px solid ${t.chat.thinkingBorder};
  padding: 0.5rem 0.75rem;
  background: ${t.chat.thinkingBg};
  border-radius: 0 6px 6px 0;
  margin: 0.25rem 0;
  opacity: 0.7;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}`;

export const label = rule`${c.label} {
  font-size: 0.8125rem;
  font-style: italic;
  color: ${t.chat.thinkingText};
}`;

export const toggle = rule`${c.toggle} {
  font-size: 0.75rem;
  color: ${t.chat.statusText};
}`;

export const content = rule`${c.content} {
  font-size: 0.8125rem;
  font-style: italic;
  color: ${t.chat.thinkingText};
  white-space: pre-wrap;
  line-height: 1.5;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: ${t.chat.inputBg};
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}`;
