/**
 * Property management for Prompt UI nodes
 */

import type { Signal } from "@semajsx/signal";
import type { PromptNode } from "./types";

/**
 * Set a property on a prompt node
 */
export function setProperty(node: PromptNode, key: string, value: unknown): void {
  if (node.type !== "element") return;
  node.props[key] = value;
}

/**
 * Set a signal property on a prompt node
 * Returns an unsubscribe function
 */
export function setSignalProperty<T = unknown>(
  node: PromptNode,
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
