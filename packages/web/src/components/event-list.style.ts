import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "inner",
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
  padding: 24px 0 120px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${tokens.colors.background};
}
@media (max-width: 640px) {
  ${c.container} {
    padding: 14px 0 96px;
  }
}`;

export const inner = rule`${c.inner} {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
@media (max-width: 640px) {
  ${c.inner} {
    padding: 0 14px;
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
  border-radius: 9px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
}`;

export const emptyIcon = rule`${c.emptyIcon} {
  width: 48px;
  height: 48px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tokens.colors.backgroundElevated};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  line-height: 1;
}`;

export const emptyText = rule`${c.emptyText} {
  color: ${tokens.colors.textMuted};
  font-size: 12.5px;
  line-height: 1.5;
}`;

export const item = rule`${c.item} {
  position: relative;
  display: flex;
  flex-direction: column;
}`;

/* Event labels/meta are visually hidden in the new design — the blocks
   themselves carry their type. The slots are kept so the component logic
   stays intact for screen readers. */
export const itemMeta = rule`${c.itemMeta} {
  display: none;
}`;

export const itemDot = rule`${c.itemDot} {
  display: none;
}`;

export const itemLabel = rule`${c.itemLabel} {
  display: none;
}`;

export const itemTime = rule`${c.itemTime} {
  display: none;
}`;

export const itemBody = rule`${c.itemBody} {
  min-width: 0;
}`;
