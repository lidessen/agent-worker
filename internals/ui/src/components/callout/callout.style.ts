/**
 * Callout component styles
 *
 * Five semantic variants: info, warning, success, error, tip
 * Matching the docs site callout design.
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "title", "icon", "content"] as const);

// --- Base ---

export const root = rule`${c.root} {
  padding: 1.25rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 14px;
  border: 0.5px solid rgba(0, 0, 0, 0.04);
  font-family: ${tokens.fonts.base};
}`;

export const title = rule`${c.title} {
  font-weight: ${tokens.fontWeights.semibold};
  font-size: 0.9375rem;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  letter-spacing: -0.005em;
}`;

export const icon = rule`${c.icon} {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}`;

export const content = rule`${c.content} {
  color: ${tokens.colors.text};
  font-size: 0.9375rem;
  line-height: ${tokens.lineHeights.normal};
}`;
