/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function StadiumNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <rect
        class={[nodeShape, nodeShapeHover]}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={height / 2}
        ry={height / 2}
      />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
