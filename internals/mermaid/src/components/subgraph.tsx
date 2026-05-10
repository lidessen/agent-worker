/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { subgraphBg, subgraphTitle } from "../subgraph.style";
import type { SubgraphRenderProps } from "../types";

export function SubgraphBox(props: SubgraphRenderProps): JSXNode {
  const { subgraph, x, y, width, height } = props.positioned;
  return (
    <g class={props.class} transform={`translate(${x}, ${y})`}>
      <rect class={subgraphBg} width={width} height={height} rx={8} />
      <text class={subgraphTitle} x={16} y={24}>
        {subgraph.label}
      </text>
    </g>
  );
}
