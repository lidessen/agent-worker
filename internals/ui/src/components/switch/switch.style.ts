/**
 * Switch component styles
 */

import { classes, rule } from "@semajsx/style";
import { tokens } from "../../theme/tokens";

const c = classes(["root", "track", "trackOn", "thumb", "thumbOn", "label"] as const);

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.md};
  cursor: pointer;
  font-family: ${tokens.fonts.base};
  user-select: none;
}`;

export const rootDisabled = rule`${c.root}[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}`;

export const track = rule`${c.track} {
  position: relative;
  width: 44px;
  height: 24px;
  background: ${tokens.colors.border};
  border-radius: 12px;
  transition: background ${tokens.transitions.fast};
  flex-shrink: 0;
}`;

export const trackOn = rule`${c.trackOn} {
  background: ${tokens.colors.primary};
}`;

export const thumb = rule`${c.thumb} {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform ${tokens.transitions.fast};
}`;

export const thumbOn = rule`${c.thumbOn} {
  transform: translateX(20px);
}`;

export const label = rule`${c.label} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.text};
  letter-spacing: -0.005em;
}`;
