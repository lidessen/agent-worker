import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes(["container", "header", "docName"] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.headerSheen};
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const docName = rule`${c.docName} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
}`;
