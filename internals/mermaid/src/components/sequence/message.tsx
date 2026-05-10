/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { messageLine, messageDotted, messageText } from "../../sequence.style";
import type { MessageRenderProps } from "../../types";
import { sequenceMarker, isDottedArrow } from "../markers";

export function Message(props: MessageRenderProps): JSXNode {
  const { message, fromX, toX, y } = props;
  const isDotted = isDottedArrow(message.arrow);
  const markerEnd = sequenceMarker(message.arrow);
  const isSelf = message.from === message.to;

  if (isSelf) {
    // Self-message: loop exits right, goes down, and returns left with arrow
    const loopWidth = toX - fromX; // typically 40
    const loopHeight = 30;
    // Draw right, down, then left — arrow points left at the end
    const path = [
      `M ${fromX} ${y}`,
      `L ${fromX + loopWidth} ${y}`,
      `L ${fromX + loopWidth} ${y + loopHeight}`,
      `L ${fromX} ${y + loopHeight}`,
    ].join(" ");

    return (
      <g class={props.class}>
        <path
          class={[messageLine, isDotted ? messageDotted : undefined]}
          d={path}
          fill="none"
          marker-end={markerEnd}
        />
        <text
          class={messageText}
          x={fromX + loopWidth / 2 + loopWidth / 2 + 6}
          y={y + loopHeight / 2}
          text-anchor="start"
        >
          {message.text}
        </text>
      </g>
    );
  }

  const midX = (fromX + toX) / 2;

  return (
    <g class={props.class}>
      <line
        class={[messageLine, isDotted ? messageDotted : undefined]}
        x1={fromX}
        y1={y}
        x2={toX}
        y2={y}
        marker-end={markerEnd}
      />
      <text class={messageText} x={midX} y={y - 8}>
        {message.text}
      </text>
    </g>
  );
}
