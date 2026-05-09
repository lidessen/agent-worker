/**
 * CodeBlock component styles
 *
 * Dark-themed code display with optional language header.
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "header", "lang", "pre", "inline"] as const);

// --- Block ---

export const root = rule`${c.root} {
  margin: 1.5rem 0;
  border-radius: ${tokens.radii.md};
  overflow: hidden;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  font-family: ${tokens.fonts.mono};
}`;

export const header = rule`${c.header} {
  background: #161617;
  padding: 0.5rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}`;

export const lang = rule`${c.lang} {
  color: #86868b;
  font-size: 0.6875rem;
  text-transform: uppercase;
  font-weight: ${tokens.fontWeights.semibold};
  letter-spacing: 0.04em;
  font-family: ${tokens.fonts.mono};
}`;

export const pre = rule`${c.pre} {
  background: #1d1d1f;
  color: #e5e5ea;
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  margin: 0;
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.65;
  font-family: ${tokens.fonts.mono};
}`;

// --- Inline code ---

export const inline = rule`${c.inline} {
  background: rgba(0, 0, 0, 0.04);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  font-size: 0.875em;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  font-family: ${tokens.fonts.mono};
}`;
