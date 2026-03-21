import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes(["block", "content"] as const);

export const block = rule`${c.block} {
  display: flex;
  justify-content: flex-end;
  padding: ${tokens.space.xs} 0;
}`;

export const content = rule`${c.content} {
  background: linear-gradient(180deg, rgba(248, 244, 240, 0.92) 0%, rgba(224, 220, 216, 0.9) 100%);
  color: #111111;
  padding: ${tokens.space.md} ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  max-width: 80%;
  font-size: ${tokens.fontSizes.md};
  line-height: 1.5;
  white-space: pre-wrap;
}`;
