import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "empty",
  "emptyContent",
  "emptyIcon",
  "emptyText",
  "item",
  "itemMeta",
  "itemDot",
  "itemLabel",
  "itemTime",
  "itemBody",
] as const);

export const container = rule`${c.container} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.md} ${tokens.space.xl} ${tokens.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
  min-height: 0;
}
@media (max-width: 640px) {
  ${c.container} {
    padding: ${tokens.space.sm} ${tokens.space.md} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const empty = rule`${c.empty} {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${tokens.space.xl};
}`;

export const emptyContent = rule`${c.emptyContent} {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.space.md};
  text-align: center;
  max-width: 320px;
  padding: ${tokens.space.xl};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
}`;

export const emptyIcon = rule`${c.emptyIcon} {
  width: 56px;
  height: 56px;
  border-radius: ${tokens.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.text};
  line-height: 1;
}`;

export const emptyText = rule`${c.emptyText} {
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.5;
}`;

export const item = rule`${c.item} {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}
${c.item}:not(:first-child) {
  padding-top: ${tokens.space.md};
}
${c.item}:not(:first-child)::before {
  content: "";
  position: absolute;
  top: 0;
  left: 8px;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03) 55%, transparent);
}
@media (max-width: 640px) {
  ${c.item}:not(:first-child) {
    padding-top: ${tokens.space.sm};
  }
}`;

export const itemMeta = rule`${c.itemMeta} {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
}
@media (max-width: 640px) {
  ${c.itemMeta} {
    gap: 4px;
  }
}`;

export const itemDot = rule`${c.itemDot} {
  width: 5px;
  height: 5px;
  border-radius: ${tokens.radii.pill};
  background: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;

export const itemLabel = rule`${c.itemLabel} {
  font-size: 0.68rem;
  color: ${tokens.colors.textDim};
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
@media (max-width: 640px) {
  ${c.itemLabel} {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }
}`;

export const itemTime = rule`${c.itemTime} {
  font-size: 0.72rem;
  color: ${tokens.colors.textDim};
}
@media (max-width: 640px) {
  ${c.itemTime} {
    font-size: 0.68rem;
  }
}`;

export const itemBody = rule`${c.itemBody} {
  min-width: 0;
  padding-left: 8px;
}
@media (max-width: 640px) {
  ${c.itemBody} {
    padding-left: 4px;
  }
}`;
