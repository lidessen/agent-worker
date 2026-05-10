/** @jsxImportSource @semajsx/prompt */

import type { JSXNode } from "@semajsx/core";
import type { ReadableSignal } from "@semajsx/signal";
import { computed } from "@semajsx/signal";

export interface EachProps<T> {
  /**
   * Signal containing the array of items to render
   */
  of: ReadableSignal<T[]>;
  /**
   * Render function called for each item
   */
  render: (item: T, index: number) => JSXNode;
}

/**
 * Each component - reactive list rendering from a signal
 *
 * Automatically re-renders when the signal updates.
 *
 * @example
 * const items = signal(["Alice", "Bob"]);
 * <Each of={items} render={(name, i) => <item key={i}>{name}</item>} />
 */
export function Each<T>(props: EachProps<T>): JSXNode {
  const { of: source, render: renderItem } = props;
  return computed(source, (items) => items.map(renderItem));
}
