import type { JSXNode, VNode, VNodeType } from "./types";
import type { Signal } from "@semajsx/signal";
import { Fragment } from "./types";
import { isSignal } from "@semajsx/signal";

/**
 * Create a VNode (Virtual Node)
 */
export function h(
  type: VNodeType,
  props: Record<string, any> | null,
  ...children: JSXNode[]
): VNode {
  return {
    type,
    props: props || {},
    children: normalizeChildren(children),
    key: props?.key,
  };
}

/**
 * Create a text VNode
 */
export function createTextVNode(text: string | number): VNode {
  return {
    type: "#text",
    props: { nodeValue: String(text) },
    children: [],
  };
}

/**
 * Create a signal VNode wrapper
 */
export function createSignalVNode(signal: Signal<unknown>): VNode {
  return {
    type: "#signal",
    props: { signal },
    children: [],
  };
}

/**
 * Normalize children into an array of VNodes
 */
function normalizeChildren(children: JSXNode[]): VNode[] {
  const result: VNode[] = [];

  for (const child of children) {
    if (child == null || typeof child === "boolean") {
      // Skip nullish and boolean values
      continue;
    }

    if (Array.isArray(child)) {
      // Recursively flatten arrays
      result.push(...normalizeChildren(child));
    } else if (typeof child === "string" || typeof child === "number") {
      // Convert primitives to text nodes
      result.push(createTextVNode(child));
    } else if (isSignal(child)) {
      // Wrap signals in special signal nodes
      result.push(createSignalVNode(child));
    } else if (isVNode(child)) {
      // Already a VNode
      result.push(child);
    } else if (typeof child === "function") {
      const fnName = (child as Function).name || "anonymous";
      console.warn(
        `[semajsx] Function '${fnName}' passed as child will be ignored. ` +
          `Did you mean to call it, wrap it with when(), or pass a signal instead?`,
      );
    } else {
      // Unknown type, skip
      console.warn("Unknown child type:", typeof child);
    }
  }

  return result;
}

/**
 * Check if a value is a VNode
 */
export function isVNode(value: unknown): value is VNode {
  return (
    value != null &&
    typeof value === "object" &&
    "type" in value &&
    "props" in value &&
    "children" in value
  );
}

/**
 * Create a Fragment
 */
export function createFragment(children: JSXNode[]): VNode {
  return h(Fragment, null, ...children);
}
