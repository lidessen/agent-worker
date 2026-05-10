import type { JSXNode, VNode } from "@semajsx/core";
import { Forward, h } from "@semajsx/core";

/**
 * Forward props interface
 */
export interface ForwardProps {
  children: JSXNode;
  [key: string]: unknown;
}

/**
 * Forward component - merges props onto its single child element
 *
 * Forward is a renderless primitive that injects props into its child
 * without producing an extra DOM node. Think of it as declarative
 * prop spreading from parent to child.
 *
 * Props merging behavior:
 * - `class`/`className`: concatenated (both applied)
 * - `style`: merged objects (Forward overrides per-property)
 * - Event handlers (`on*`): chained (both run)
 * - Other props: Forward overrides child
 *
 * @example
 * ```tsx
 * <Forward onClick={handler} class="extra">
 *   <button class="btn">Click me</button>
 * </Forward>
 * // renders: <button class="btn extra" onClick={handler}>Click me</button>
 * ```
 */
export function ForwardComponent(props: ForwardProps): VNode {
  const { children, ...rest } = props;
  return h(Forward, rest, children);
}
