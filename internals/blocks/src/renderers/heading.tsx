/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { classes, rule } from "@semajsx/style";
import type { ClassValue } from "../types";

const c = classes(["root"] as const);

export const headingStyles = {
  root: rule`${c.root} {
    margin: 16px 0 8px;
    line-height: 1.3;
    font-weight: 600;
  }`,
};

export interface HeadingBlockData {
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Heading renderer (h1-h6 based on level). */
export function HeadingRenderer(props: { data: HeadingBlockData; class?: ClassValue }): JSXNode {
  const { text, level = 2 } = props.data;

  switch (level) {
    case 1:
      return <h1 class={[headingStyles.root, props.class]}>{text}</h1>;
    case 2:
      return <h2 class={[headingStyles.root, props.class]}>{text}</h2>;
    case 3:
      return <h3 class={[headingStyles.root, props.class]}>{text}</h3>;
    case 4:
      return <h4 class={[headingStyles.root, props.class]}>{text}</h4>;
    case 5:
      return <h5 class={[headingStyles.root, props.class]}>{text}</h5>;
    case 6:
      return <h6 class={[headingStyles.root, props.class]}>{text}</h6>;
  }
}
