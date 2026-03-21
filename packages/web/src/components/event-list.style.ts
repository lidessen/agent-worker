import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["container", "empty"] as const);

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
