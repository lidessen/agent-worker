import Yoga from "yoga-layout-prebuilt";

export type YogaNodeType = ReturnType<typeof Yoga.Node.create>;

/**
 * Terminal node types
 */
export type TerminalNodeType = "element" | "text" | "root";

/**
 * Style properties for terminal elements
 */
export interface TerminalStyle {
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  margin?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginInline?: number; // Left + Right (horizontal)
  marginBlock?: number; // Top + Bottom (vertical)
  padding?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingInline?: number; // Left + Right (horizontal)
  paddingBlock?: number; // Top + Bottom (vertical)
  border?: "single" | "double" | "round" | "bold" | "none";
  borderColor?: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dim?: boolean;
}

/**
 * Terminal node base
 */
export interface TerminalNodeBase {
  type: TerminalNodeType;
  yogaNode?: YogaNodeType;
  parent: TerminalNode | null;
  children: TerminalNode[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Terminal element node
 */
export interface TerminalElement extends TerminalNodeBase {
  type: "element";
  tagName: string;
  style: TerminalStyle;
  props: Record<string, unknown>;
}

/**
 * Terminal text node
 */
export interface TerminalText extends TerminalNodeBase {
  type: "text";
  content: string;
}

/**
 * Terminal root node
 */
export interface TerminalRoot extends TerminalNodeBase {
  type: "root";
  stream: NodeJS.WriteStream;
}

/**
 * Union type for all terminal nodes
 */
export type TerminalNode = TerminalElement | TerminalText | TerminalRoot;
