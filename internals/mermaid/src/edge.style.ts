import { classes, rule } from "@semajsx/style";
import type { StyleToken, ClassRefs } from "@semajsx/style";
import { tokens } from "./tokens";
import { textLabel } from "./base.style";

const EDGE_CLASSES = [
  "edgeLine",
  "edgeInteraction",
  "edgeArrow",
  "edgeDotted",
  "edgeThick",
  "edgeAnimated",
  "edgeLabel",
  "edgeLabelBg",
  "arrowHead",
  "arrowHeadClosed",
  "dotMarker",
  "crossMarker",
] as const;

const c: ClassRefs<typeof EDGE_CLASSES> = classes(EDGE_CLASSES);

export const edgeLine: StyleToken = rule`${c.edgeLine} {
  fill: none;
  stroke: ${tokens.edgeStroke};
  stroke-width: ${tokens.edgeWidth};
  stroke-linecap: round;
  stroke-linejoin: round;
}`;

export const edgeInteraction: StyleToken = rule`${c.edgeInteraction} {
  fill: none;
  stroke-opacity: 0;
  stroke-width: 20;
}`;

export const edgeDotted: StyleToken = rule`${c.edgeDotted} {
  stroke-dasharray: 6, 4;
}`;

export const edgeAnimated: StyleToken = rule`${c.edgeAnimated} {
  stroke-dasharray: ${tokens.animatedDashArray};
  animation: mmd-dash-flow ${tokens.animatedDuration} linear infinite;
}`;

export const edgeAnimatedKeyframes: StyleToken = rule`
@keyframes mmd-dash-flow {
  from {
    stroke-dashoffset: ${tokens.animatedDashOffset};
  }
}
`;

export const edgeThick: StyleToken = rule`${c.edgeThick} {
  stroke-width: 3;
}`;

export const edgeLabel: StyleToken = rule`${c.edgeLabel} {
  ${textLabel(tokens.edgeLabelText, "12px")}
}`;

export const edgeLabelBg: StyleToken = rule`${c.edgeLabelBg} {
  fill: ${tokens.edgeLabelBg};
  stroke: none;
}`;

export const arrowHead: StyleToken = rule`${c.arrowHead} {
  fill: none;
  stroke: ${tokens.arrowFill};
  stroke-width: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
}`;

export const arrowHeadClosed: StyleToken = rule`${c.arrowHeadClosed} {
  fill: ${tokens.arrowFill};
  stroke: ${tokens.arrowFill};
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}`;

export const dotMarker: StyleToken = rule`${c.dotMarker} {
  fill: ${tokens.bgColor};
  stroke: ${tokens.edgeStroke};
  stroke-width: 1.5;
}`;

export const crossMarker: StyleToken = rule`${c.crossMarker} {
  fill: none;
  stroke: ${tokens.edgeStroke};
  stroke-width: 2;
  stroke-linecap: round;
}`;

export { c };
