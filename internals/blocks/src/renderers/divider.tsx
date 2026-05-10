/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { classes, rule } from "@semajsx/style";
import type { ClassValue } from "../types";

const c = classes(["root"] as const);

export const dividerStyles = {
  root: rule`${c.root} {
    border: none;
    border-top: 1px solid currentColor;
    opacity: 0.2;
    margin: 16px 0;
  }`,
};

export interface DividerBlockData {
  /** Optional — ignored, present for Block<"divider", D> conformance. */
  [key: string]: unknown;
}

/** Horizontal rule / divider renderer. */
export function DividerRenderer(props: { data: DividerBlockData; class?: ClassValue }): JSXNode {
  return <hr class={[dividerStyles.root, props.class]} />;
}
