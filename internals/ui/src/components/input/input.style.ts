/**
 * Input component styles
 */

import { classes, rule, rules } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "wrapper", "label", "sm", "md", "lg"] as const);

export const wrapper = rule`${c.wrapper} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  font-family: ${tokens.fonts.base};
}`;

export const label = rule`${c.label} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.text};
  letter-spacing: -0.005em;
}`;

export const root = rule`${c.root} {
  display: block;
  width: 100%;
  border: 1.5px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  background: white;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.md};
  line-height: ${tokens.lineHeights.normal};
  transition: all ${tokens.transitions.fast};
  outline: none;
}`;

export const rootStates = rules(
  rule`${c.root}:focus {
    border-color: ${tokens.colors.primary};
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
  }`,
  rule`${c.root}:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: ${tokens.colors.surface};
  }`,
  rule`${c.root}::placeholder {
    color: ${tokens.colors.textTertiary};
  }`,
);

export const sm = rule`${c.sm} {
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-size: ${tokens.fontSizes.sm};
}`;

export const md = rule`${c.md} {
  padding: ${tokens.space.md} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.md};
}`;

export const lg = rule`${c.lg} {
  padding: ${tokens.space.lg} ${tokens.space.xl};
  font-size: ${tokens.fontSizes.lg};
}`;
