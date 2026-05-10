/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { lifeline } from "../../sequence.style";
import type { LifelineRenderProps } from "../../types";

export function Lifeline(props: LifelineRenderProps): JSXNode {
  return (
    <line class={[lifeline, props.class]} x1={props.x} y1={props.y1} x2={props.x} y2={props.y2} />
  );
}
