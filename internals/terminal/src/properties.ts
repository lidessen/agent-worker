import type { Signal } from "@semajsx/signal";
import type { TerminalNode, TerminalStyle } from "./types";
import { applyStyle } from "./operations";

/**
 * Set a property on a terminal node
 */
export function setProperty(node: TerminalNode, key: string, value: unknown): void {
  if (node.type !== "element") return;

  // Handle style properties
  if (isStyleProperty(key)) {
    const styleUpdate: Partial<TerminalStyle> = { [key]: value };
    applyStyle(node, styleUpdate);
    return;
  }

  // Store other props
  node.props[key] = value;
}

/**
 * Set a signal property on a terminal node
 */
export function setSignalProperty<T = unknown>(
  node: TerminalNode,
  key: string,
  signal: Signal<T>,
): () => void {
  // Set initial value
  setProperty(node, key, signal.value);

  // Subscribe to changes
  return signal.subscribe((value: T) => {
    setProperty(node, key, value);
  });
}

/**
 * Set of all recognized style property names (hoisted to module level for performance)
 */
const styleProps = new Set([
  "flexDirection",
  "justifyContent",
  "alignItems",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "margin",
  "marginLeft",
  "marginRight",
  "marginTop",
  "marginBottom",
  "marginInline",
  "marginBlock",
  "padding",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "paddingInline",
  "paddingBlock",
  "border",
  "borderColor",
  "color",
  "backgroundColor",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "dim",
]);

/**
 * Check if a property is a style property
 */
function isStyleProperty(key: string): boolean {
  return styleProps.has(key);
}
