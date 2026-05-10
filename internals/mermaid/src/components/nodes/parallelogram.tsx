/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function ParallelogramNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  const skew = width * 0.15;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <polygon
        class={[nodeShape, nodeShapeHover]}
        points={`${-hw + skew},${-hh} ${hw + skew},${-hh} ${hw - skew},${hh} ${-hw - skew},${hh}`}
      />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
