/**
 * Low-level DOM operations
 */

export function createElement(tagName: string): Element {
  return document.createElement(tagName);
}

export function createTextNode(text: string): Text {
  return document.createTextNode(text);
}

export function createComment(text: string): Comment {
  return document.createComment(text);
}

export function appendChild(parent: Node, child: Node): void {
  parent.appendChild(child);
}

export function removeChild(node: Node): void {
  node.parentNode?.removeChild(node);
}

export function insertBefore(parent: Node, newNode: Node, refNode: Node | null): void {
  parent.insertBefore(newNode, refNode);
}

export function replaceNode(oldNode: Node, newNode: Node): void {
  oldNode.parentNode?.replaceChild(newNode, oldNode);
}

export function setText(node: Node, text: string): void {
  node.textContent = text;
}

export function getParent(node: Node): Node | null {
  return node.parentNode;
}

export function getNextSibling(node: Node): Node | null {
  return node.nextSibling;
}
