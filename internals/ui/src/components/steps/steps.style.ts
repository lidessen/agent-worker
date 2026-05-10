/**
 * Steps component styles
 *
 * Numbered step indicators for tutorials and guides.
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "item", "number", "content", "title", "body"] as const);

export const root = rule`${c.root} {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 1.5rem 0;
  font-family: ${tokens.fonts.base};
}`;

export const item = rule`${c.item} {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 0;
  border-bottom: 0.5px solid ${tokens.colors.border};
}`;

export const number = rule`${c.number} {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.125rem;
}`;

export const content = rule`${c.content} {
  flex: 1;
  min-width: 0;
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
  margin: 0 0 0.375rem;
  letter-spacing: -0.005em;
}`;

export const body = rule`${c.body} {
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.sm};
  line-height: ${tokens.lineHeights.normal};
}`;
