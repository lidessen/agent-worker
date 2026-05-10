import { classes, rule } from "@semajsx/style";
import type { StyleToken, ClassRefs } from "@semajsx/style";
import { tokens } from "./tokens";
import { textLabel, boxShape } from "./base.style";

const NODE_CLASSES = [
  "node",
  "nodeShape",
  "nodeRect",
  "nodeRound",
  "nodeCircle",
  "nodeRhombus",
  "nodeHexagon",
  "nodeCylinder",
  "nodeStadium",
  "nodeLabel",
] as const;

const c: ClassRefs<typeof NODE_CLASSES> = classes(NODE_CLASSES);

export const nodeShape: StyleToken = rule`${c.nodeShape} {
  ${boxShape(tokens.nodeFill, tokens.nodeStroke, tokens.edgeWidth)}
}`;

export const nodeShapeHover: StyleToken = rule`${c.nodeShape} {
  transition: filter 0.15s ease;
  cursor: pointer;
}
${c.nodeShape}:hover {
  filter: brightness(0.93);
}`;

export const nodeLabel: StyleToken = rule`${c.nodeLabel} {
  ${textLabel(tokens.nodeText, `${tokens.fontSize}px`)}
  pointer-events: none;
}`;

export { c };
