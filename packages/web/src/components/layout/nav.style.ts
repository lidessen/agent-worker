import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["nav", "links", "link", "linkActive", "dot"] as const);

export const nav = rule`${c.nav} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.lg};
  height: 100%;
}
@media (max-width: 640px) {
  ${c.nav} {
    gap: ${tokens.space.sm};
  }
}`;

export const links = rule`${c.links} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
}`;

export const link = rule`${c.link} {
  color: ${tokens.colors.textMuted};
  text-decoration: none;
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  padding: ${tokens.space.xs} ${tokens.space.md};
  border-radius: ${tokens.radii.sm};
  transition: color ${tokens.transitions.fast}, background ${tokens.transitions.fast};
}
@media (max-width: 640px) {
  ${c.link} {
    font-size: ${tokens.fontSizes.xs};
    padding: ${tokens.space.xs} ${tokens.space.sm};
  }
}`;

export const linkActive = rule`${c.linkActive} {
  color: ${tokens.colors.text};
  background: ${tokens.colors.surface};
}`;

export const dot = rule`${c.dot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};
}`;
