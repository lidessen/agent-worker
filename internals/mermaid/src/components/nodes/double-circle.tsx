/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function DoubleCircleNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width } = props.positioned;
  const outerR = width / 2;
  const innerR = outerR - 4;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <circle class={[nodeShape, nodeShapeHover]} r={outerR} />
      <circle class={nodeShape} r={innerR} />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
