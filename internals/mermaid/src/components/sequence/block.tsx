/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import {
  blockBg,
  blockLabel,
  blockLabelText,
  blockSectionLine,
  blockSectionLabel,
} from "../../sequence.style";
import type { BlockRenderProps } from "../../types";

export function Block(props: BlockRenderProps): JSXNode {
  const { block, x, y, width, height, sectionDividers } = props;
  // Type label (e.g. "alt", "loop") + condition label (e.g. "User found")
  const typeText = block.type;
  const labelText = block.label ? `${typeText} [${block.label}]` : typeText;
  // Estimate label box width from text length
  const labelWidth = Math.max(labelText.length * 7 + 10, 50);

  return (
    <g class={props.class}>
      <rect class={blockBg} x={x} y={y} width={width} height={height} rx={4} />
      <rect class={blockLabel} x={x} y={y} width={labelWidth} height={20} rx={4} />
      <text class={blockLabelText} x={x + labelWidth / 2} y={y + 10}>
        {labelText}
      </text>
      {sectionDividers?.map((div) => (
        <g>
          <line class={blockSectionLine} x1={x} y1={div.y} x2={x + width} y2={div.y} />
          {div.label && (
            <text class={blockSectionLabel} x={x + 8} y={div.y + 14} text-anchor="start">
              [{div.label}]
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
