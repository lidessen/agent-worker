import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["block", "code", "codeBlock", "blockquote"] as const);

export const block = rule`${c.block} {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.875rem;
  color: ${t.chat.assistantText};
  padding: 0.5rem 0;
}`;

export const code = rule`${c.code} {
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.85em;
  background: ${t.chat.toolBg};
  padding: 1px 0.25rem;
  border-radius: 3px;
  border: 1px solid ${t.chat.toolBorder};
}`;

export const codeBlock = rule`${c.codeBlock} {
  display: block;
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  background: ${t.chat.toolBg};
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid ${t.chat.toolBorder};
  margin: 0.5rem 0;
  overflow-x: auto;
  white-space: pre;
  line-height: 1.4;
}`;

export const blockquote = rule`${c.blockquote} {
  border-left: 3px solid ${t.chat.toolBorder};
  padding-left: 0.75rem;
  color: ${t.chat.thinkingText};
  margin: 0.5rem 0;
  font-style: italic;
}`;
