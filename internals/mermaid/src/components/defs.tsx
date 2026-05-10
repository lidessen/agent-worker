/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { arrowHead, arrowHeadClosed, dotMarker, crossMarker } from "../edge.style";
import { tokens } from "../tokens";

/**
 * Arrow markers follow xyflow conventions:
 * - viewBox "-10 -10 20 20", tip at origin (0,0)
 * - refX=0 so the arrow tip aligns with the path endpoint
 * - markerUnits="strokeWidth" for automatic scaling
 *
 * Closed arrow: polyline "-5,-4 0,0 -5,4 -5,-4" (filled triangle)
 * Open arrow:   polyline "-5,-4 0,0 -5,4"        (chevron)
 */
const ARROW_CLOSED_POINTS = "-5,-4 0,0 -5,4 -5,-4";
const ARROW_OPEN_POINTS = "-5,-4 0,0 -5,4";

/** Dot marker radius in marker coordinate space. */
const DOT_RADIUS = 4;

export function Defs(): JSXNode {
  return (
    <defs>
      {/* Grid dot background pattern */}
      <pattern
        id="mmd-grid"
        x={0}
        y={0}
        width={tokens.gridDotGap}
        height={tokens.gridDotGap}
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx={tokens.gridDotGap}
          cy={tokens.gridDotGap}
          r={tokens.gridDotRadius}
          fill={tokens.gridDotColor}
        />
      </pattern>

      {/* Arrow — filled triangle, tip at origin */}
      <marker
        id="mmd-arrow"
        viewBox="-10 -10 20 20"
        refX={0}
        refY={0}
        markerWidth={12.5}
        markerHeight={12.5}
        markerUnits="strokeWidth"
        orient="auto-start-reverse"
      >
        <polyline
          class={arrowHeadClosed}
          points={ARROW_CLOSED_POINTS}
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>

      {/* Arrow filled — identical, kept for edge-type mapping */}
      <marker
        id="mmd-arrow-filled"
        viewBox="-10 -10 20 20"
        refX={0}
        refY={0}
        markerWidth={12.5}
        markerHeight={12.5}
        markerUnits="strokeWidth"
        orient="auto-start-reverse"
      >
        <polyline
          class={arrowHeadClosed}
          points={ARROW_CLOSED_POINTS}
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>

      {/* Open arrow — chevron (unfilled), tip at origin */}
      <marker
        id="mmd-arrow-open"
        viewBox="-10 -10 20 20"
        refX={0}
        refY={0}
        markerWidth={12.5}
        markerHeight={12.5}
        markerUnits="strokeWidth"
        orient="auto-start-reverse"
      >
        <polyline
          class={arrowHead}
          points={ARROW_OPEN_POINTS}
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>

      {/* Dot endpoint — hollow circle, center at origin */}
      <marker
        id="mmd-dot"
        viewBox="-10 -10 20 20"
        refX={0}
        refY={0}
        markerWidth={8}
        markerHeight={8}
        markerUnits="strokeWidth"
        orient="auto-start-reverse"
      >
        <circle class={dotMarker} cx={0} cy={0} r={DOT_RADIUS} />
      </marker>

      {/* Cross endpoint — X mark, center at origin */}
      <marker
        id="mmd-cross"
        viewBox="-10 -10 20 20"
        refX={0}
        refY={0}
        markerWidth={10}
        markerHeight={10}
        markerUnits="strokeWidth"
        orient="auto-start-reverse"
      >
        <path class={crossMarker} d="M -4,-4 L 4,4 M -4,4 L 4,-4" />
      </marker>
    </defs>
  );
}
