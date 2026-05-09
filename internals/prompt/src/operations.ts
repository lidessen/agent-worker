/**
 * Tree operations for Prompt UI nodes
 *
 * Implements the low-level tree manipulation required by core's RenderStrategy.
 */

import type { PromptNode, PromptElement, PromptText, PromptRoot } from "./types";

/**
 * Create an element node
 */
export function createElement(tagName: string): PromptElement {
  return {
    type: "element",
    tagName,
    props: {},
    parent: null,
    children: [],
  };
}

/**
 * Create a text node
 */
export function createTextNode(text: string): PromptText {
  return {
    type: "text",
    content: text,
    parent: null,
    children: [],
  };
}

/**
 * Create a comment node (returns empty text node - comments are invisible in prompt output)
 */
export function createComment(_text: string): PromptText {
  return createTextNode("");
}

/**
 * Create a root node
 */
export function createRoot(): PromptRoot {
  return {
    type: "root",
    parent: null,
    children: [],
  };
}

/**
 * Append a child to a parent node
 */
export function appendChild(parent: PromptNode, child: PromptNode): void {
  if (child.parent) {
    removeChild(child);
  }
  child.parent = parent;
  parent.children.push(child);
}

/**
 * Remove a child from its parent
 */
export function removeChild(node: PromptNode): void {
  if (!node.parent) return;

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  if (index !== -1) {
    parent.children.splice(index, 1);
  }

  node.parent = null;
}

/**
 * Insert a node before another node
 */
export function insertBefore(
  parent: PromptNode,
  newNode: PromptNode,
  refNode: PromptNode | null,
): void {
  if (newNode.parent) {
    removeChild(newNode);
  }

  if (!refNode) {
    appendChild(parent, newNode);
    return;
  }

  const index = parent.children.indexOf(refNode);
  if (index !== -1) {
    newNode.parent = parent;
    parent.children.splice(index, 0, newNode);
  } else {
    // refNode not found in parent - fall back to append
    appendChild(parent, newNode);
  }
}

/**
 * Replace a node with another node
 */
export function replaceNode(oldNode: PromptNode, newNode: PromptNode): void {
  const parent = oldNode.parent;
  if (!parent) return;

  insertBefore(parent, newNode, oldNode);
  removeChild(oldNode);
}

/**
 * Get the parent of a node
 */
export function getParent(node: PromptNode): PromptNode | null {
  return node.parent;
}

/**
 * Get the next sibling of a node
 */
export function getNextSibling(node: PromptNode): PromptNode | null {
  const parent = node.parent;
  if (!parent) return null;

  const index = parent.children.indexOf(node);
  if (index === -1 || index === parent.children.length - 1) {
    return null;
  }

  return parent.children[index + 1] ?? null;
}

/**
 * Collect all text content from a node and its descendants
 */
export function collectText(node: PromptNode): string {
  if (node.type === "text") {
    return node.content;
  }

  let text = "";
  for (const child of node.children) {
    text += collectText(child);
  }
  return text;
}
