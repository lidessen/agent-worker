/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function RhombusNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <polygon class={[nodeShape, nodeShapeHover]} points={`0,${-hh} ${hw},0 0,${hh} ${-hw},0`} />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
