/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { nodeLabel } from "../node.style";
import type { LabelRenderProps } from "../types";

export function Label(props: LabelRenderProps): JSXNode {
  return (
    <text class={[nodeLabel, props.class]} x={props.x} y={props.y}>
      {props.text}
    </text>
  );
}
