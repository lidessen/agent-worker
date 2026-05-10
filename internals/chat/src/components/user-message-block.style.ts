import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["block", "content"] as const);

export const block = rule`${c.block} {
  display: flex;
  justify-content: flex-end;
  padding: 0.25rem 0;
}`;

export const content = rule`${c.content} {
  background: ${t.chat.userBg};
  color: ${t.chat.userText};
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  max-width: 80%;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
}`;
