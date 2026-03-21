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
  background:
    radial-gradient(circle at top left, rgba(255, 140, 92, 0.045), transparent 22%),
    radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.025), transparent 26%),
    linear-gradient(180deg, #0b0b0c 0%, #090909 100%);
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
  background: linear-gradient(180deg, rgba(18, 18, 18, 0.9) 0%, rgba(13, 13, 13, 0.84) 100%);
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xxl};
  box-shadow: ${tokens.shadows.panel};
  backdrop-filter: blur(24px) saturate(140%);
}
@media (max-width: 900px) {
  ${c.contentInner} {
    border-radius: ${tokens.radii.xl};
  }
}`;
