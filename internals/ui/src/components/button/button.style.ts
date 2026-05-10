/**
 * Button component styles
 *
 * All styles reference theme tokens via CSS custom properties,
 * so they respond to theme changes automatically.
 */

import { classes, rule, rules } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes([
  "root",
  "solid",
  "outline",
  "ghost",
  "sm",
  "md",
  "lg",
  "danger",
  "icon",
] as const);

// --- Base ---

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tokens.space.sm};
  border: 1.5px solid transparent;
  border-radius: ${tokens.radii.pill};
  font-family: ${tokens.fonts.base};
  font-weight: ${tokens.fontWeights.medium};
  line-height: ${tokens.lineHeights.tight};
  letter-spacing: -0.005em;
  cursor: pointer;
  user-select: none;
  transition: all ${tokens.transitions.normal};
}`;

export const rootStates = rules(
  rule`${c.root}:focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: 2px;
  }`,
  rule`${c.root}:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }`,
);

// --- Variants ---

export const solid = rule`${c.solid} {
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
  border-color: ${tokens.colors.primary};
}`;

export const solidStates = rules(
  rule`${c.solid}:hover:not(:disabled) {
    background: ${tokens.colors.primaryHover};
    border-color: ${tokens.colors.primaryHover};
    transform: scale(1.02);
    box-shadow: ${tokens.shadows.primaryGlow};
  }`,
  rule`${c.solid}:active:not(:disabled) {
    background: ${tokens.colors.primaryActive};
    border-color: ${tokens.colors.primaryActive};
    transform: scale(0.98);
    box-shadow: none;
  }`,
);

export const outline = rule`${c.outline} {
  background: transparent;
  color: ${tokens.colors.primary};
  border-color: ${tokens.colors.primary};
}`;

export const outlineStates = rules(
  rule`${c.outline}:hover:not(:disabled) {
    background: ${tokens.colors.primary};
    color: ${tokens.colors.onPrimary};
    transform: scale(1.02);
  }`,
  rule`${c.outline}:active:not(:disabled) {
    background: ${tokens.colors.primaryActive};
    color: ${tokens.colors.onPrimary};
    transform: scale(0.98);
  }`,
);

export const ghost = rule`${c.ghost} {
  background: transparent;
  color: ${tokens.colors.text};
  border-color: transparent;
}`;

export const ghostStates = rules(
  rule`${c.ghost}:hover:not(:disabled) {
    background: ${tokens.colors.surface};
  }`,
  rule`${c.ghost}:active:not(:disabled) {
    background: ${tokens.colors.border};
  }`,
);

// --- Danger ---

export const danger = rule`${c.danger} {
  background: ${tokens.colors.danger};
  color: ${tokens.colors.onDanger};
  border-color: ${tokens.colors.danger};
}`;

export const dangerStates = rules(
  rule`${c.danger}:hover:not(:disabled) {
    background: ${tokens.colors.dangerHover};
    border-color: ${tokens.colors.dangerHover};
    transform: scale(1.02);
  }`,
  rule`${c.danger}:focus-visible {
    outline-color: ${tokens.colors.danger};
  }`,
);

// --- Sizes ---

export const sm = rule`${c.sm} {
  padding: ${tokens.space.sm} ${tokens.space.lg};
  font-size: ${tokens.fontSizes.sm};
}`;

export const md = rule`${c.md} {
  padding: ${tokens.space.md} ${tokens.space.xl};
  font-size: ${tokens.fontSizes.md};
}`;

export const lg = rule`${c.lg} {
  padding: 0.875rem 1.75rem;
  font-size: ${tokens.fontSizes.lg};
}`;

// --- Icon slot ---

export const icon = rule`${c.icon} {
  display: inline-flex;
  flex-shrink: 0;
}`;
