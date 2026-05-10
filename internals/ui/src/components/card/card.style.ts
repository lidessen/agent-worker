/**
 * Card component styles
 *
 * Two variants matching the docs site design:
 * - feature: Large card with icon, heading, description
 * - link: Smaller clickable card for navigation
 */

import { classes, rule, rules } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "feature", "link", "icon", "heading", "desc"] as const);

// --- Base ---

export const root = rule`${c.root} {
  background: white;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  font-family: ${tokens.fonts.base};
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}`;

// --- Feature variant ---

export const feature = rule`${c.feature} {
  border-radius: ${tokens.radii.xl};
  padding: 2.5rem;
  box-shadow: ${tokens.shadows.md};
}`;

export const featureStates = rule`${c.feature}:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: ${tokens.shadows.lg};
}`;

// --- Link variant ---

export const link = rule`${c.link} {
  display: block;
  border-radius: ${tokens.radii.lg};
  padding: 1.75rem;
  box-shadow: ${tokens.shadows.sm};
  text-decoration: none;
  cursor: pointer;
}`;

export const linkStates = rules(
  rule`${c.link}:hover {
    border-color: rgba(0, 113, 227, 0.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    transform: translateY(-2px);
  }`,
);

// --- Slots ---

export const icon = rule`${c.icon} {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tokens.colors.surface};
  border-radius: ${tokens.radii.md};
  margin-bottom: 1.25rem;
}`;

export const heading = rule`${c.heading} {
  font-size: 1.375rem;
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
  margin: 0 0 0.5rem;
  letter-spacing: -0.01em;
}`;

export const headingLink = rule`${c.link} ${c.heading} {
  font-size: ${tokens.fontSizes.lg};
  margin-bottom: 0.25rem;
}`;

export const desc = rule`${c.desc} {
  color: ${tokens.colors.textMuted};
  line-height: ${tokens.lineHeights.normal};
  font-size: 0.9375rem;
  margin: 0;
}`;

export const descLink = rule`${c.link} ${c.desc} {
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.5;
}`;
