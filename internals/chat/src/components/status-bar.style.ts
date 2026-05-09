import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["bar", "dot", "text"] as const);

export const bar = rule`${c.bar} {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  border-bottom: 1px solid ${t.chat.inputBorder};
  background: ${t.chat.toolBg};
  flex-shrink: 0;
}`;

export const dot = rule`${c.dot} {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.25s ease;
}`;

export const text = rule`${c.text} {
  color: ${t.chat.statusText};
  font-size: 0.75rem;
}`;
