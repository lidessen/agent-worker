import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["block", "divider", "label", "detail"] as const);

export const block = rule`${c.block} {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}`;

export const divider = rule`${c.divider} {
  flex: 1;
  height: 1px;
  background: ${t.chat.runDivider};
}`;

export const label = rule`${c.label} {
  font-size: 0.75rem;
  color: ${t.chat.runText};
  white-space: nowrap;
}`;

export const detail = rule`${c.detail} {
  font-size: 0.75rem;
  color: ${t.chat.thinkingText};
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  white-space: nowrap;
}`;
