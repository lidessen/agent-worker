/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function HexagonNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  const inset = width * 0.15;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <polygon
        class={[nodeShape, nodeShapeHover]}
        points={`${-hw + inset},${-hh} ${hw - inset},${-hh} ${hw},0 ${hw - inset},${hh} ${-hw + inset},${hh} ${-hw},0`}
      />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
