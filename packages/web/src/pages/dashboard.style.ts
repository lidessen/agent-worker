import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "page",
  "section",
  "sectionHeader",
  "sectionTitle",
  "count",
  "grid",
  "empty",
  "newBtn",
] as const);

export const page = rule`${c.page} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xxl};
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
}`;

export const sectionHeader = rule`${c.sectionHeader} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.sm};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const count = rule`${c.count} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const grid = rule`${c.grid} {
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tokens.space.md};
}
@media (min-width: 640px) {
  ${c.grid} {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  ${c.grid} {
    grid-template-columns: repeat(3, 1fr);
  }
}`;

export const empty = rule`${c.empty} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  padding: ${tokens.space.xl} 0;
}`;

export const newBtn = rule`${c.newBtn} {
  margin-left: auto;
  background: ${tokens.colors.primary};
  color: #fff;
  border: none;
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.xs} ${tokens.space.md};
  font-size: ${tokens.fontSizes.xs};
  font-weight: ${tokens.fontWeights.medium};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
}
${c.newBtn}:hover {
  background: ${tokens.colors.primaryHover};
}`;
