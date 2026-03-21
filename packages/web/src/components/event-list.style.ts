import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["container", "empty", "emptyContent", "emptyIcon", "emptyText"] as const);

export const container = rule`${c.container} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.md} ${tokens.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}
@media (max-width: 640px) {
  ${c.container} {
    padding: ${tokens.space.sm} ${tokens.space.md};
  }
}`;

export const empty = rule`${c.empty} {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tokens.colors.textDim};
  font-size: ${tokens.fontSizes.sm};
}`;

export const emptyContent = rule`${c.emptyContent} {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.space.md};
  text-align: center;
  max-width: 280px;
}`;

export const emptyIcon = rule`${c.emptyIcon} {
  font-size: 2rem;
  line-height: 1;
}`;

export const emptyText = rule`${c.emptyText} {
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.5;
}`;
