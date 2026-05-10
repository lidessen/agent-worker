/**
 * Kbd (keyboard) component styles
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root"] as const);

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;
  padding: 0.15rem 0.4rem;
  background: ${tokens.colors.surface};
  border: 0.5px solid ${tokens.colors.border};
  border-bottom-width: 2px;
  border-radius: 6px;
  font-family: ${tokens.fonts.base};
  font-size: 0.8125rem;
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.text};
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
}`;
