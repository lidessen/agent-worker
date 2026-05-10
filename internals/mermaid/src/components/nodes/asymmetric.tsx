/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { c, nodeShape, nodeShapeHover, nodeLabel } from "../../node.style";
import type { NodeRenderProps } from "../../types";

export function AsymmetricNode(props: NodeRenderProps): JSXNode {
  const { node, x, y, width, height } = props.positioned;
  const hw = width / 2;
  const hh = height / 2;
  const notch = 10;
  return (
    <g class={[c.node, props.class]} transform={`translate(${x}, ${y})`}>
      <polygon
        class={[nodeShape, nodeShapeHover]}
        points={`${-hw},${-hh} ${hw},${-hh} ${hw},${hh} ${-hw},${hh} ${-hw + notch},0`}
      />
      <text class={nodeLabel}>{node.label}</text>
    </g>
  );
}
