import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["shell", "content", "contentInner"] as const);

export const shell = rule`${c.shell} {
  display: flex;
  flex-direction: row;
  height: 100vh;
  width: 100%;
  padding: ${tokens.space.md};
  box-sizing: border-box;
  gap: ${tokens.space.md};
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  overflow: hidden;
}
@media (max-width: 900px) {
  ${c.shell} {
    padding: ${tokens.space.sm};
    gap: ${tokens.space.sm};
  }
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}`;

export const contentInner = rule`${c.contentInner} {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${tokens.colors.backgroundElevated};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xxl};
  box-shadow: ${tokens.shadows.panel};
}
@media (max-width: 900px) {
  ${c.contentInner} {
    border-radius: ${tokens.radii.xl};
  }
}`;
