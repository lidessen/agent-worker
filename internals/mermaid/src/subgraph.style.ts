import { classes, rule } from "@semajsx/style";
import type { StyleToken, ClassRefs } from "@semajsx/style";
import { tokens } from "./tokens";
import { boxShape } from "./base.style";

const SUBGRAPH_CLASSES = ["subgraphBg", "subgraphTitle"] as const;

const c: ClassRefs<typeof SUBGRAPH_CLASSES> = classes(SUBGRAPH_CLASSES);

export const subgraphBg: StyleToken = rule`${c.subgraphBg} {
  ${boxShape(tokens.subgraphFill, tokens.subgraphStroke, 1)}
}`;

export const subgraphTitle: StyleToken = rule`${c.subgraphTitle} {
  fill: ${tokens.subgraphTitleText};
  font-family: ${tokens.fontFamily};
  font-size: 12px;
  font-weight: 600;
}`;

export { c };
