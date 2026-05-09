import Yoga from "yoga-layout-prebuilt";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import type { TerminalNode, TerminalElement, TerminalText, TerminalStyle } from "./types";

/**
 * Create a terminal element
 */
export function createElement(tagName: string): TerminalElement {
  const yogaNode = Yoga.Node.create();

  const element: TerminalElement = {
    type: "element",
    tagName,
    style: {},
    props: {},
    yogaNode,
    parent: null,
    children: [],
  };

  // Set measure function for text containers
  // Text elements need to measure their text content
  if (tagName === "text") {
    yogaNode.setMeasureFunc(measureTextNode.bind(null, element));
  }

  // row and column are box shortcuts with preset flexDirection
  if (tagName === "row") {
    yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
    element.style.flexDirection = "row";
  } else if (tagName === "column") {
    yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
    element.style.flexDirection = "column";
  }

  return element;
}

/**
 * Create a terminal text node
 * Text nodes don't have yoga nodes - they are pure data containers
 */
export function createTextNode(text: string): TerminalText {
  return {
    type: "text",
    content: text,
    yogaNode: undefined,
    parent: null,
    children: [],
  };
}

/**
 * Create a comment (no-op in terminal, returns text node)
 */
export function createComment(_text: string): TerminalText {
  return createTextNode("");
}

/**
 * Append a child to a parent node
 */
export function appendChild(parent: TerminalNode, child: TerminalNode): void {
  if (child.parent) {
    removeChild(child);
  }

  child.parent = parent;
  parent.children.push(child);

  if (parent.yogaNode && child.yogaNode) {
    parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount());
  }
}

/**
 * Remove a child from its parent
 */
export function removeChild(node: TerminalNode): void {
  if (!node.parent) return;

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  if (index !== -1) {
    parent.children.splice(index, 1);

    if (parent.yogaNode && node.yogaNode) {
      parent.yogaNode.removeChild(node.yogaNode);
    }
  }

  node.parent = null;
}

/**
 * Insert a node before another node
 */
export function insertBefore(
  parent: TerminalNode,
  newNode: TerminalNode,
  refNode: TerminalNode | null,
): void {
  if (newNode.parent) {
    removeChild(newNode);
  }

  newNode.parent = parent;

  if (!refNode) {
    appendChild(parent, newNode);
    return;
  }

  const index = parent.children.indexOf(refNode);
  if (index !== -1) {
    parent.children.splice(index, 0, newNode);

    if (parent.yogaNode && newNode.yogaNode) {
      parent.yogaNode.insertChild(newNode.yogaNode, index);
    }
  }
}

/**
 * Replace a node with another node
 */
export function replaceNode(oldNode: TerminalNode, newNode: TerminalNode): void {
  const parent = oldNode.parent;
  if (!parent) return;

  insertBefore(parent, newNode, oldNode);
  removeChild(oldNode);
}

/**
 * Set text content of a text node
 */
export function setText(node: TerminalNode, text: string): void {
  if (node.type === "text") {
    if (node.content === text) {
      return;
    }

    node.content = text;

    // Text nodes don't have yoga nodes, mark parent as dirty
    if (node.parent) {
      markNodeAsDirty(node.parent);
    }
  }
}

/**
 * Apply yoga layout styles
 */
export function applyStyle(element: TerminalElement, style: Partial<TerminalStyle>): void {
  const { yogaNode } = element;
  if (!yogaNode) return;

  element.style = { ...element.style, ...style };

  // Flexbox
  if (style.flexDirection) {
    const direction = {
      row: Yoga.FLEX_DIRECTION_ROW,
      column: Yoga.FLEX_DIRECTION_COLUMN,
      "row-reverse": Yoga.FLEX_DIRECTION_ROW_REVERSE,
      "column-reverse": Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
    }[style.flexDirection];
    yogaNode.setFlexDirection(direction);
  }

  if (style.justifyContent) {
    const justify = {
      "flex-start": Yoga.JUSTIFY_FLEX_START,
      center: Yoga.JUSTIFY_CENTER,
      "flex-end": Yoga.JUSTIFY_FLEX_END,
      "space-between": Yoga.JUSTIFY_SPACE_BETWEEN,
      "space-around": Yoga.JUSTIFY_SPACE_AROUND,
    }[style.justifyContent];
    yogaNode.setJustifyContent(justify);
  }

  if (style.alignItems) {
    const align = {
      "flex-start": Yoga.ALIGN_FLEX_START,
      center: Yoga.ALIGN_CENTER,
      "flex-end": Yoga.ALIGN_FLEX_END,
      stretch: Yoga.ALIGN_STRETCH,
    }[style.alignItems];
    yogaNode.setAlignItems(align);
  }

  // Flex grow/shrink
  if (style.flexGrow !== undefined) {
    yogaNode.setFlexGrow(style.flexGrow);
  }
  if (style.flexShrink !== undefined) {
    yogaNode.setFlexShrink(style.flexShrink);
  }

  // Dimensions
  if (style.width !== undefined) {
    if (typeof style.width === "number") {
      yogaNode.setWidth(style.width);
    } else if (style.width === "auto") {
      yogaNode.setWidthAuto();
    } else if (style.width.endsWith("%")) {
      yogaNode.setWidthPercent(parseFloat(style.width));
    }
  }

  if (style.height !== undefined) {
    if (typeof style.height === "number") {
      yogaNode.setHeight(style.height);
    } else if (style.height === "auto") {
      yogaNode.setHeightAuto();
    } else if (style.height.endsWith("%")) {
      yogaNode.setHeightPercent(parseFloat(style.height));
    }
  }

  // Min/Max dimensions
  if (style.minWidth !== undefined) yogaNode.setMinWidth(style.minWidth);
  if (style.minHeight !== undefined) yogaNode.setMinHeight(style.minHeight);
  if (style.maxWidth !== undefined) yogaNode.setMaxWidth(style.maxWidth);
  if (style.maxHeight !== undefined) yogaNode.setMaxHeight(style.maxHeight);

  // Margin
  if (style.margin !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_ALL, style.margin);
  }
  // Logical properties (applied before specific edges so they can be overridden)
  if (style.marginInline !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_LEFT, style.marginInline);
    yogaNode.setMargin(Yoga.EDGE_RIGHT, style.marginInline);
  }
  if (style.marginBlock !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_TOP, style.marginBlock);
    yogaNode.setMargin(Yoga.EDGE_BOTTOM, style.marginBlock);
  }
  // Specific edges (override logical properties)
  if (style.marginLeft !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_LEFT, style.marginLeft);
  }
  if (style.marginRight !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_RIGHT, style.marginRight);
  }
  if (style.marginTop !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_TOP, style.marginTop);
  }
  if (style.marginBottom !== undefined) {
    yogaNode.setMargin(Yoga.EDGE_BOTTOM, style.marginBottom);
  }

  // Padding
  if (style.padding !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_ALL, style.padding);
  }
  // Logical properties (applied before specific edges so they can be overridden)
  if (style.paddingInline !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_LEFT, style.paddingInline);
    yogaNode.setPadding(Yoga.EDGE_RIGHT, style.paddingInline);
  }
  if (style.paddingBlock !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_TOP, style.paddingBlock);
    yogaNode.setPadding(Yoga.EDGE_BOTTOM, style.paddingBlock);
  }
  // Specific edges (override logical properties)
  if (style.paddingLeft !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_LEFT, style.paddingLeft);
  }
  if (style.paddingRight !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_RIGHT, style.paddingRight);
  }
  if (style.paddingTop !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_TOP, style.paddingTop);
  }
  if (style.paddingBottom !== undefined) {
    yogaNode.setPadding(Yoga.EDGE_BOTTOM, style.paddingBottom);
  }
}

/**
 * Recursively collect all text content from a node's children
 * Similar to Ink's squashTextNodes
 */
export function collectText(node: TerminalNode): string {
  if (node.type === "text") {
    return node.content;
  }

  let text = "";
  for (const child of node.children) {
    text += collectText(child);
  }

  return text;
}

/**
 * Measure text node for Yoga layout.
 * Called by Yoga during layout calculation.
 *
 * Yoga passes (width, widthMode, height, heightMode) but we only use
 * width. In MEASURE_MODE_UNDEFINED, width is NaN — return natural size.
 */
function measureTextNode(node: TerminalElement, width: number): { width: number; height: number } {
  const text = collectText(node);

  if (text.length === 0) {
    return { width: 0, height: 0 };
  }

  const textWidth = stringWidth(text);
  const lines = text.split("\n");
  const height = lines.length;

  // When width is NaN (MEASURE_MODE_UNDEFINED) or Infinity, or text fits,
  // return the natural text size without wrapping
  if (!Number.isFinite(width) || width < 1 || textWidth <= width) {
    return { width: textWidth, height };
  }

  // Wrap text if it exceeds the available width
  const wrappedText = wrapAnsi(text, Math.floor(width), {
    hard: true,
    trim: false,
  });
  const wrappedLines = wrappedText.split("\n");
  const wrappedWidth = Math.max(...wrappedLines.map((line) => stringWidth(line)));

  return { width: wrappedWidth, height: wrappedLines.length };
}

/**
 * Mark a node and its ancestors as dirty for relayout
 */
export function markNodeAsDirty(node: TerminalNode): void {
  if (node.yogaNode) {
    node.yogaNode.markDirty();
    return;
  }

  // Walk up to find a yoga node
  if (node.parent) {
    markNodeAsDirty(node.parent);
  }
}

/**
 * Get the parent node of a node
 */
export function getParent(node: TerminalNode): TerminalNode | null {
  return node.parent;
}

/**
 * Get the next sibling of a node
 */
export function getNextSibling(node: TerminalNode): TerminalNode | null {
  const parent = node.parent;
  if (!parent) return null;

  const index = parent.children.indexOf(node);
  if (index === -1 || index === parent.children.length - 1) {
    return null;
  }

  return parent.children[index + 1] || null;
}
