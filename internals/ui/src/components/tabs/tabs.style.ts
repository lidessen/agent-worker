/**
 * Tabs component styles
 *
 * A tab bar with active indicator and content panels.
 */

import { classes, rule, rules } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "list", "trigger", "active", "panel"] as const);

// --- Container ---

export const root = rule`${c.root} {
  margin: 1.5rem 0;
  font-family: ${tokens.fonts.base};
}`;

// --- Tab List ---

export const list = rule`${c.list} {
  display: flex;
  gap: 0;
  border-bottom: 1px solid ${tokens.colors.border};
  margin-bottom: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}`;

// --- Trigger ---

export const trigger = rule`${c.trigger} {
  padding: 0.625rem 1rem;
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  font-family: ${tokens.fonts.base};
  color: ${tokens.colors.textMuted};
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};
  margin-bottom: -1px;
}`;

export const triggerStates = rules(
  rule`${c.trigger}:hover {
    color: ${tokens.colors.text};
  }`,
  rule`${c.trigger}:focus-visible {
    outline: 2px solid ${tokens.colors.primary};
    outline-offset: -2px;
  }`,
);

// --- Active Trigger ---

export const active = rule`${c.active} {
  color: ${tokens.colors.primary};
  border-bottom-color: ${tokens.colors.primary};
}`;

// --- Panel ---

export const panel = rule`${c.panel} {
  padding: 1rem 0;
}`;
