/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function SubroutineNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  const inset = 8;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <rect
        class={[nodeShape, nodeShapeHover]}
        x={-hw}
        y={-hh}
        width={width}
        height={height}
        rx={0}
      />
      <line class={nodeShape} x1={-hw + inset} y1={-hh} x2={-hw + inset} y2={hh} />
      <line class={nodeShape} x1={hw - inset} y1={-hh} x2={hw - inset} y2={hh} />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
