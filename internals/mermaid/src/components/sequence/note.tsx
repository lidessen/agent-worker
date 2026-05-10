/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { noteBg, noteText } from "../../sequence.style";
import type { NoteRenderProps } from "../../types";

export function Note(props: NoteRenderProps): JSXNode {
  const { note, x, y, width, height } = props;
  return (
    <g class={props.class} transform={`translate(${x}, ${y})`}>
      <rect class={noteBg} x={-width / 2} y={-height / 2} width={width} height={height} rx={4} />
      <text class={noteText}>{note.text}</text>
    </g>
  );
}
