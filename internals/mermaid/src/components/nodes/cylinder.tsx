/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function CylinderNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  const ry = 8;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <path
        class={[nodeShape, nodeShapeHover]}
        d={`M ${-hw} ${-hh + ry} A ${hw} ${ry} 0 0 1 ${hw} ${-hh + ry} L ${hw} ${hh - ry} A ${hw} ${ry} 0 0 1 ${-hw} ${hh - ry} Z`}
      />
      <ellipse class={nodeShape} cx={0} cy={-hh + ry} rx={hw} ry={ry} />
      <text class={nodeLabel} y={ry / 2}>
        {node.label}
      </text>
    </g>
  );
}
