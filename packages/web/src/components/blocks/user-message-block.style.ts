import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "content"] as const);

export const block = rule`${c.block} {
  display: flex;
  justify-content: flex-end;
  padding: ${tokens.space.xs} 0;
}`;

export const content = rule`${c.content} {
  background: ${tokens.colors.primary};
  color: #fff;
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-radius: ${tokens.radii.md};
  max-width: 80%;
  font-size: ${tokens.fontSizes.md};
  line-height: 1.5;
  white-space: pre-wrap;
}`;
