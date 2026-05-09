/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { activation } from "../../sequence.style";
import type { ActivationRenderProps } from "../../types";

export function Activation(props: ActivationRenderProps): JSXNode {
  return (
    <rect
      class={[activation, props.class]}
      x={props.x - props.width / 2}
      y={props.y}
      width={props.width}
      height={props.height}
    />
  );
}
