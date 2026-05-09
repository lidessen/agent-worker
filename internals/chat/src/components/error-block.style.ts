import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["block", "message"] as const);

export const block = rule`${c.block} {
  border-left: 3px solid ${t.chat.errorBorder};
  padding: 0.5rem 0.75rem;
  background: ${t.chat.errorBg};
  border-radius: 0 6px 6px 0;
  margin: 0.25rem 0;
}`;

export const message = rule`${c.message} {
  font-size: 0.8125rem;
  color: ${t.chat.errorText};
  white-space: pre-wrap;
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  line-height: 1.5;
}`;
