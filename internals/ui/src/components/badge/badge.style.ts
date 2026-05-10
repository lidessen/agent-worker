/**
 * Badge component styles
 *
 * Pill-shaped labels with semantic color variants.
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root"] as const);

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: ${tokens.fontWeights.semibold};
  font-family: ${tokens.fonts.base};
  padding: 0.125rem 0.5rem;
  border-radius: ${tokens.radii.pill};
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;
}`;
