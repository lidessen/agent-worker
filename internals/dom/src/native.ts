import type { VNode } from "@semajsx/core";

export interface NativeProps {
  /** The native DOM element to embed in the SemaJSX tree */
  element: Element;
  /** Additional attributes to apply to the element */
  [key: string]: unknown;
}

/**
 * Embed a native DOM element in the SemaJSX render tree.
 *
 * Useful for integrating third-party libraries that return real DOM elements
 * (e.g., Lucide's createElement, D3 nodes, Canvas elements).
 *
 * Props (except `element`) are applied to the element using the same
 * property-setting logic as regular JSX elements — supports class, style,
 * event handlers, signals, and standard attributes.
 *
 * @example
 * ```tsx
 * import { Native } from "semajsx/dom";
 * import { createElement, Rocket } from "lucide";
 *
 * const App = () => (
 *   <div>
 *     <Native element={createElement(Rocket)} stroke="#007aff" />
 *   </div>
 * );
 * ```
 */
export function Native({ element, ...attrs }: NativeProps): VNode {
  return {
    type: "#native",
    props: { __nativeNode: element, ...attrs },
    children: [],
  };
}
