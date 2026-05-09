import { classes, rule } from "@semajsx/style";
import type { StyleToken, ClassRefs } from "@semajsx/style";

const ROOT_CLASSES = ["svgRoot"] as const;

const c: ClassRefs<typeof ROOT_CLASSES> = classes(ROOT_CLASSES);

export const svgRoot: StyleToken = rule`${c.svgRoot} {
  width: 100%;
  height: auto;
  font-family: inherit;
}`;

export { c };
