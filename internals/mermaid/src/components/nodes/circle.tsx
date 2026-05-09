/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function CircleNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width } = props.positioned;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <circle class={[nodeShape, nodeShapeHover]} r={width / 2} />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
