/**
 * Avatar component styles
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "image", "fallback", "sm", "md", "lg"] as const);

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: ${tokens.colors.surface};
  border: 1.5px solid ${tokens.colors.border};
  flex-shrink: 0;
  font-family: ${tokens.fonts.base};
  user-select: none;
}`;

export const image = rule`${c.image} {
  width: 100%;
  height: 100%;
  object-fit: cover;
}`;

export const fallback = rule`${c.fallback} {
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.02em;
}`;

export const sm = rule`${c.sm} {
  width: 32px;
  height: 32px;
  font-size: 0.75rem;
}`;

export const md = rule`${c.md} {
  width: 40px;
  height: 40px;
  font-size: ${tokens.fontSizes.sm};
}`;

export const lg = rule`${c.lg} {
  width: 48px;
  height: 48px;
  font-size: ${tokens.fontSizes.md};
}`;
