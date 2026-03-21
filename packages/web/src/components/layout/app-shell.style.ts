import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["shell", "topBar", "title", "content"] as const);

export const shell = rule`${c.shell} {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
}`;

export const topBar = rule`${c.topBar} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 ${tokens.space.lg};
  border-bottom: 1px solid ${tokens.colors.border};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.topBar} {
    padding: 0 ${tokens.space.md};
  }
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
  letter-spacing: -0.01em;
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.content} {
    padding: ${tokens.space.md};
  }
}`;
