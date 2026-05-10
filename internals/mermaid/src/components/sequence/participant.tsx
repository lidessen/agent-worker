/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { participantBox, participantLabel } from "../../sequence.style";
import type { ParticipantRenderProps } from "../../types";

export function Participant(props: ParticipantRenderProps): JSXNode {
  const { participant, x, y, width, height } = props;
  return (
    <g class={props.class} transform={`translate(${x}, ${y})`}>
      <rect
        class={participantBox}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={6}
      />
      <text class={participantLabel}>{participant.label}</text>
    </g>
  );
}
