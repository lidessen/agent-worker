/**
 * Separator component styles
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "vertical"] as const);

export const root = rule`${c.root} {
  border: none;
  background: ${tokens.colors.border};
  flex-shrink: 0;
}`;

export const horizontal = rule`${c.root}:not(${c.vertical}) {
  height: 0.5px;
  width: 100%;
  margin: ${tokens.space.lg} 0;
}`;

export const vertical = rule`${c.vertical} {
  width: 0.5px;
  height: auto;
  align-self: stretch;
  margin: 0 ${tokens.space.lg};
}`;
