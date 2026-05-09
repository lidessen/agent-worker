import { classes, rule } from "@semajsx/style";
import { chatTokens as t } from "../theme/tokens";

const c = classes(["container", "empty"] as const);

export const container = rule`${c.container} {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
@media (max-width: 640px) {
  ${c.container} {
    padding: 0.5rem 0.75rem;
  }
}`;

export const empty = rule`${c.empty} {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${t.chat.statusText};
  font-size: 0.8125rem;
}`;
