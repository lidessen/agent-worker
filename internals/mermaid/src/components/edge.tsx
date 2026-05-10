/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import {
  edgeLine,
  edgeInteraction,
  edgeLabel,
  edgeLabelBg,
  edgeDotted,
  edgeThick,
} from "../edge.style";
import type { EdgeRenderProps, EdgeLineStyle } from "../types";
import { MARKER_URL } from "./markers";

const LINE_STYLE: Record<EdgeLineStyle, StyleToken | undefined> = {
  solid: undefined,
  dotted: edgeDotted,
  thick: edgeThick,
};

export function Edge(props: EdgeRenderProps): JSXNode {
  const { edge, path, labelPosition, labelSize } = props.positioned;

  const lineStyle = LINE_STYLE[edge.lineStyle];
  const markerEnd = MARKER_URL[edge.targetMarker];
  const markerStart = MARKER_URL[edge.sourceMarker];

  return (
    <g class={props.class}>
      <path
        class={[edgeLine, lineStyle]}
        d={path}
        marker-start={markerStart}
        marker-end={markerEnd}
      />
      <path class={edgeInteraction} d={path} />
      {edge.label && labelPosition && labelSize ? (
        <g>
          <rect
            class={edgeLabelBg}
            x={labelPosition.x - labelSize.width / 2 - 4}
            y={labelPosition.y - labelSize.height / 2 - 2}
            width={labelSize.width + 8}
            height={labelSize.height + 4}
            rx={4}
          />
          <text class={edgeLabel} x={labelPosition.x} y={labelPosition.y}>
            {edge.label}
          </text>
        </g>
      ) : null}
    </g>
  );
}
