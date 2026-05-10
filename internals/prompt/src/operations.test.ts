import { describe, it, expect } from "vitest";
import {
  createElement,
  createTextNode,
  createComment,
  createRoot,
  appendChild,
  removeChild,
  insertBefore,
  replaceNode,
  getParent,
  getNextSibling,
  collectText,
} from "./operations";

describe("Prompt UI Operations", () => {
  describe("createElement", () => {
    it("should create an element with correct type and tagName", () => {
      const el = createElement("section");
      expect(el.type).toBe("element");
      expect(el.tagName).toBe("section");
      expect(el.parent).toBeNull();
      expect(el.children).toEqual([]);
      expect(el.props).toEqual({});
    });
  });

  describe("createTextNode", () => {
    it("should create a text node with content", () => {
      const text = createTextNode("hello");
      expect(text.type).toBe("text");
      expect(text.content).toBe("hello");
      expect(text.parent).toBeNull();
      expect(text.children).toEqual([]);
    });
  });

  describe("createComment", () => {
    it("should create an empty text node", () => {
      const comment = createComment("marker");
      expect(comment.type).toBe("text");
      expect(comment.content).toBe("");
    });
  });

  describe("createRoot", () => {
    it("should create a root node", () => {
      const root = createRoot();
      expect(root.type).toBe("root");
      expect(root.parent).toBeNull();
      expect(root.children).toEqual([]);
    });
  });

  describe("appendChild", () => {
    it("should append child to parent", () => {
      const root = createRoot();
      const child = createElement("section");
      appendChild(root, child);

      expect(root.children).toHaveLength(1);
      expect(root.children[0]).toBe(child);
      expect(child.parent).toBe(root);
    });

    it("should remove from previous parent when re-appending", () => {
      const parent1 = createRoot();
      const parent2 = createRoot();
      const child = createElement("line");

      appendChild(parent1, child);
      appendChild(parent2, child);

      expect(parent1.children).toHaveLength(0);
      expect(parent2.children).toHaveLength(1);
      expect(child.parent).toBe(parent2);
    });
  });

  describe("removeChild", () => {
    it("should remove child from parent", () => {
      const root = createRoot();
      const child = createElement("section");
      appendChild(root, child);
      removeChild(child);

      expect(root.children).toHaveLength(0);
      expect(child.parent).toBeNull();
    });

    it("should be a no-op for orphan nodes", () => {
      const child = createElement("section");
      removeChild(child); // should not throw
    });
  });

  describe("insertBefore", () => {
    it("should insert before a reference node", () => {
      const root = createRoot();
      const a = createElement("line");
      const b = createElement("line");
      const c = createElement("line");

      appendChild(root, a);
      appendChild(root, c);
      insertBefore(root, b, c);

      expect(root.children).toEqual([a, b, c]);
      expect(b.parent).toBe(root);
    });

    it("should append if refNode is null", () => {
      const root = createRoot();
      const a = createElement("line");
      insertBefore(root, a, null);

      expect(root.children).toHaveLength(1);
    });

    it("should fall back to append when refNode is not in parent", () => {
      const root = createRoot();
      const a = createElement("line");
      const orphan = createElement("line"); // not a child of root
      const newNode = createElement("item");

      appendChild(root, a);
      insertBefore(root, newNode, orphan);

      // Should append instead of leaving node in limbo
      expect(root.children).toEqual([a, newNode]);
      expect(newNode.parent).toBe(root);
    });

    it("should not leave inconsistent parent pointer on failed insert", () => {
      const root = createRoot();
      const orphan = createElement("line");
      const newNode = createElement("item");

      // Before the fix, newNode.parent would be set to root
      // but newNode would not actually be in root.children
      insertBefore(root, newNode, orphan);

      // Now it falls back to append, so parent and children are consistent
      expect(newNode.parent).toBe(root);
      expect(root.children).toContain(newNode);
    });
  });

  describe("replaceNode", () => {
    it("should replace a node in the tree", () => {
      const root = createRoot();
      const old = createElement("line");
      const replacement = createElement("item");

      appendChild(root, old);
      replaceNode(old, replacement);

      expect(root.children).toHaveLength(1);
      expect(root.children[0]).toBe(replacement);
      expect(old.parent).toBeNull();
    });
  });

  describe("getParent / getNextSibling", () => {
    it("should return parent", () => {
      const root = createRoot();
      const child = createElement("section");
      appendChild(root, child);

      expect(getParent(child)).toBe(root);
    });

    it("should return next sibling", () => {
      const root = createRoot();
      const a = createElement("line");
      const b = createElement("line");
      appendChild(root, a);
      appendChild(root, b);

      expect(getNextSibling(a)).toBe(b);
      expect(getNextSibling(b)).toBeNull();
    });
  });

  describe("collectText", () => {
    it("should collect text from text nodes", () => {
      const text = createTextNode("hello");
      expect(collectText(text)).toBe("hello");
    });

    it("should collect text recursively from elements", () => {
      const el = createElement("line");
      appendChild(el, createTextNode("hello "));
      appendChild(el, createTextNode("world"));
      expect(collectText(el)).toBe("hello world");
    });
  });
});
