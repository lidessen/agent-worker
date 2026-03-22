import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "content"] as const);

export const block = rule`${c.block} {
  display: flex;
  justify-content: flex-end;
  padding: ${tokens.space.xs} 0;
}`;

export const content = rule`${c.content} {
  background: ${tokens.colors.buttonPrimary};
  color: ${tokens.colors.buttonPrimaryText};
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  border: 1px solid ${tokens.colors.buttonPrimaryBorder};
  box-shadow: ${tokens.shadows.panel};
  max-width: 80%;
  font-size: ${tokens.fontSizes.md};
  line-height: 1.5;
  white-space: pre-wrap;
}`;
