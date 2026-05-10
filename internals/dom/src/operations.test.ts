import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createElement,
  createTextNode,
  createComment,
  appendChild,
  removeChild,
  insertBefore,
  replaceNode,
  setText,
  getParent,
  getNextSibling,
} from "../src/operations";

describe("operations", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("createElement()", () => {
    it("should create an element with given tag name", () => {
      const div = createElement("div");
      expect(div.tagName).toBe("DIV");
    });

    it("should create different element types", () => {
      const span = createElement("span");
      const button = createElement("button");
      const input = createElement("input");

      expect(span.tagName).toBe("SPAN");
      expect(button.tagName).toBe("BUTTON");
      expect(input.tagName).toBe("INPUT");
    });
  });

  describe("createTextNode()", () => {
    it("should create a text node with given text", () => {
      const text = createTextNode("Hello World");
      expect(text.nodeType).toBe(Node.TEXT_NODE);
      expect(text.textContent).toBe("Hello World");
    });

    it("should create empty text node", () => {
      const text = createTextNode("");
      expect(text.textContent).toBe("");
    });
  });

  describe("createComment()", () => {
    it("should create a comment node with given text", () => {
      const comment = createComment("marker");
      expect(comment.nodeType).toBe(Node.COMMENT_NODE);
      expect(comment.textContent).toBe("marker");
    });
  });

  describe("appendChild()", () => {
    it("should append child to parent", () => {
      const child = createElement("span");
      appendChild(container, child);

      expect(container.children.length).toBe(1);
      expect(container.firstChild).toBe(child);
    });

    it("should append multiple children in order", () => {
      const child1 = createElement("span");
      const child2 = createElement("div");

      appendChild(container, child1);
      appendChild(container, child2);

      expect(container.children.length).toBe(2);
      expect(container.firstChild).toBe(child1);
      expect(container.lastChild).toBe(child2);
    });

    it("should append text nodes", () => {
      const text = createTextNode("Hello");
      appendChild(container, text);

      expect(container.textContent).toBe("Hello");
    });
  });

  describe("removeChild()", () => {
    it("should remove child from its parent", () => {
      const child = createElement("span");
      appendChild(container, child);
      expect(container.children.length).toBe(1);

      removeChild(child);
      expect(container.children.length).toBe(0);
    });

    it("should handle node without parent gracefully", () => {
      const orphan = createElement("span");
      // Should not throw
      expect(() => removeChild(orphan)).not.toThrow();
    });
  });

  describe("insertBefore()", () => {
    it("should insert node before reference node", () => {
      const existing = createElement("span");
      appendChild(container, existing);

      const newNode = createElement("div");
      insertBefore(container, newNode, existing);

      expect(container.firstChild).toBe(newNode);
      expect(container.lastChild).toBe(existing);
    });

    it("should append when reference is null", () => {
      const child1 = createElement("span");
      appendChild(container, child1);

      const child2 = createElement("div");
      insertBefore(container, child2, null);

      expect(container.lastChild).toBe(child2);
    });
  });

  describe("replaceNode()", () => {
    it("should replace old node with new node", () => {
      const oldNode = createElement("span");
      appendChild(container, oldNode);

      const newNode = createElement("div");
      replaceNode(oldNode, newNode);

      expect(container.children.length).toBe(1);
      expect(container.firstChild).toBe(newNode);
      expect(oldNode.parentNode).toBeNull();
    });

    it("should handle node without parent gracefully", () => {
      const orphan = createElement("span");
      const newNode = createElement("div");

      // Should not throw
      expect(() => replaceNode(orphan, newNode)).not.toThrow();
    });
  });

  describe("setText()", () => {
    it("should set text content of node", () => {
      const div = createElement("div");
      setText(div, "Hello World");

      expect(div.textContent).toBe("Hello World");
    });

    it("should overwrite existing content", () => {
      const div = createElement("div");
      div.textContent = "Old content";
      setText(div, "New content");

      expect(div.textContent).toBe("New content");
    });

    it("should work with text nodes", () => {
      const text = createTextNode("Original");
      setText(text, "Updated");

      expect(text.textContent).toBe("Updated");
    });
  });

  describe("getParent()", () => {
    it("should return parent node", () => {
      const child = createElement("span");
      appendChild(container, child);

      expect(getParent(child)).toBe(container);
    });

    it("should return null for orphan node", () => {
      const orphan = createElement("span");
      expect(getParent(orphan)).toBeNull();
    });
  });

  describe("getNextSibling()", () => {
    it("should return next sibling", () => {
      const child1 = createElement("span");
      const child2 = createElement("div");
      appendChild(container, child1);
      appendChild(container, child2);

      expect(getNextSibling(child1)).toBe(child2);
    });

    it("should return null for last child", () => {
      const child = createElement("span");
      appendChild(container, child);

      expect(getNextSibling(child)).toBeNull();
    });
  });
});
