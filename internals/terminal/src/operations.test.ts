import { describe, it, expect } from "vitest";
import {
  createElement,
  createTextNode,
  appendChild,
  removeChild,
  replaceNode,
  setText,
  applyStyle,
} from "@semajsx/terminal";

describe("Terminal Operations", () => {
  describe("createElement", () => {
    it("should create an element with correct type", () => {
      const element = createElement("box");

      expect(element.type).toBe("element");
      expect(element.tagName).toBe("box");
      expect(element.parent).toBeNull();
      expect(element.children).toEqual([]);
    });

    it("should create element with yoga node", () => {
      const element = createElement("text");

      expect(element.yogaNode).toBeDefined();
    });

    it("should initialize empty style and props", () => {
      const element = createElement("box");

      expect(element.style).toEqual({});
      expect(element.props).toEqual({});
    });
  });

  describe("createTextNode", () => {
    it("should create a text node with correct content", () => {
      const text = createTextNode("Hello World");

      expect(text.type).toBe("text");
      expect(text.content).toBe("Hello World");
      expect(text.parent).toBeNull();
      expect(text.children).toEqual([]);
    });

    it("should create text node without yoga node", () => {
      const text = createTextNode("test");

      // Text nodes don't have yoga nodes - they are pure data containers
      expect(text.yogaNode).toBeUndefined();
    });
  });

  describe("appendChild", () => {
    it("should append child to parent", () => {
      const parent = createElement("box");
      const child = createElement("text");

      appendChild(parent, child);

      expect(parent.children).toContain(child);
      expect(child.parent).toBe(parent);
    });

    it("should append multiple children", () => {
      const parent = createElement("box");
      const child1 = createElement("text");
      const child2 = createElement("text");

      appendChild(parent, child1);
      appendChild(parent, child2);

      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(child2);
    });

    it("should update yoga node hierarchy", () => {
      const parent = createElement("box");
      const child = createElement("text");

      appendChild(parent, child);

      expect(parent.yogaNode?.getChildCount()).toBe(1);
    });

    it("should remove child from previous parent", () => {
      const parent1 = createElement("box");
      const parent2 = createElement("box");
      const child = createElement("text");

      appendChild(parent1, child);
      appendChild(parent2, child);

      expect(parent1.children).not.toContain(child);
      expect(parent2.children).toContain(child);
      expect(child.parent).toBe(parent2);
    });
  });

  describe("removeChild", () => {
    it("should remove child from parent", () => {
      const parent = createElement("box");
      const child = createElement("text");

      appendChild(parent, child);
      removeChild(child);

      expect(parent.children).not.toContain(child);
      expect(child.parent).toBeNull();
    });

    it("should handle removing child with no parent", () => {
      const child = createElement("text");

      expect(() => removeChild(child)).not.toThrow();
    });

    it("should update yoga node hierarchy", () => {
      const parent = createElement("box");
      const child = createElement("text");

      appendChild(parent, child);
      removeChild(child);

      expect(parent.yogaNode?.getChildCount()).toBe(0);
    });
  });

  describe("replaceNode", () => {
    it("should replace old node with new node", () => {
      const parent = createElement("box");
      const oldNode = createElement("text");
      const newNode = createElement("text");

      appendChild(parent, oldNode);
      replaceNode(oldNode, newNode);

      expect(parent.children).toContain(newNode);
      expect(parent.children).not.toContain(oldNode);
      expect(oldNode.parent).toBeNull();
      expect(newNode.parent).toBe(parent);
    });

    it("should maintain order when replacing", () => {
      const parent = createElement("box");
      const child1 = createElement("text");
      const child2 = createElement("text");
      const child3 = createElement("text");
      const newChild = createElement("text");

      appendChild(parent, child1);
      appendChild(parent, child2);
      appendChild(parent, child3);

      replaceNode(child2, newChild);

      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(newChild);
      expect(parent.children[2]).toBe(child3);
    });
  });

  describe("setText", () => {
    it("should set text content on text node", () => {
      const text = createTextNode("initial");

      setText(text, "updated");

      expect(text.content).toBe("updated");
    });

    it("should not affect element nodes", () => {
      const element = createElement("box");

      setText(element, "test");

      // Should not throw or change element
      expect(element.type).toBe("element");
    });
  });

  describe("applyStyle", () => {
    it("should apply flexDirection style", () => {
      const element = createElement("box");

      applyStyle(element, { flexDirection: "column" });

      expect(element.style.flexDirection).toBe("column");
    });

    it("should apply multiple styles", () => {
      const element = createElement("box");

      applyStyle(element, {
        flexDirection: "row",
        padding: 2,
        margin: 1,
        border: "round",
      });

      expect(element.style.flexDirection).toBe("row");
      expect(element.style.padding).toBe(2);
      expect(element.style.margin).toBe(1);
      expect(element.style.border).toBe("round");
    });

    it("should apply width and height", () => {
      const element = createElement("box");

      applyStyle(element, {
        width: 100,
        height: 50,
      });

      expect(element.style.width).toBe(100);
      expect(element.style.height).toBe(50);
    });

    it("should merge with existing styles", () => {
      const element = createElement("box");

      applyStyle(element, { padding: 2 });
      applyStyle(element, { margin: 1 });

      expect(element.style.padding).toBe(2);
      expect(element.style.margin).toBe(1);
    });

    it("should apply color styles", () => {
      const element = createElement("text");

      applyStyle(element, {
        color: "green",
        backgroundColor: "blue",
        bold: true,
      });

      expect(element.style.color).toBe("green");
      expect(element.style.backgroundColor).toBe("blue");
      expect(element.style.bold).toBe(true);
    });
  });
});
