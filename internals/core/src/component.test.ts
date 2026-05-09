import { describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { normalizeChildrenProp, normalizeComponentResult } from "../src/component";
import { createTextVNode } from "../src/vnode";
import { Fragment } from "../src/types";

describe("component normalization", () => {
  describe("normalizeChildrenProp", () => {
    it("should return undefined for empty children array", () => {
      const result = normalizeChildrenProp([]);
      expect(result).toBeUndefined();
    });

    it("should return single child directly", () => {
      const child = createTextVNode("hello");
      const result = normalizeChildrenProp([child]);
      expect(result).toBe(child);
    });

    it("should return array for multiple children", () => {
      const child1 = createTextVNode("hello");
      const child2 = createTextVNode("world");
      const result = normalizeChildrenProp([child1, child2]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe("normalizeComponentResult", () => {
    it("should return VNode as-is", () => {
      const vnode = createTextVNode("test");
      const result = normalizeComponentResult(vnode);
      expect(result).toBe(vnode);
    });

    it("should convert string to text VNode", () => {
      const result = normalizeComponentResult("hello");
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("hello");
    });

    it("should convert number to text VNode", () => {
      const result = normalizeComponentResult(42);
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("42");
    });

    it("should convert null to empty text VNode", () => {
      const result = normalizeComponentResult(null);
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("");
    });

    it("should convert undefined to empty text VNode", () => {
      const result = normalizeComponentResult(undefined);
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("");
    });

    it("should convert boolean true to empty text VNode", () => {
      const result = normalizeComponentResult(true);
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("");
    });

    it("should convert boolean false to empty text VNode", () => {
      const result = normalizeComponentResult(false);
      expect(result.type).toBe("#text");
      expect(result.props.nodeValue).toBe("");
    });

    it("should convert array of VNodes to Fragment", () => {
      const result = normalizeComponentResult([createTextVNode("hello"), createTextVNode("world")]);
      expect(result.type).toBe(Fragment);
      expect(result.children).toHaveLength(2);
    });

    it("should filter out null and boolean from arrays", () => {
      const result = normalizeComponentResult([
        createTextVNode("a"),
        null,
        true,
        false,
        createTextVNode("b"),
      ]);
      expect(result.children).toHaveLength(2);
    });

    it("should convert signals in arrays", () => {
      const sig = signal("test");
      const result = normalizeComponentResult([sig]);
      expect(result.type).toBe(Fragment);
      expect(result.children[0]?.type).toBe("#signal");
    });

    it("should throw for invalid types", () => {
      expect(() => normalizeComponentResult(Symbol("test") as unknown as string)).toThrow(
        "Invalid component return type",
      );
    });

    it("should include component name in error when provided", () => {
      expect(() =>
        normalizeComponentResult(Symbol("test") as unknown as string, "CreateAgentDialog"),
      ).toThrow("Invalid component return type: symbol (in component 'CreateAgentDialog')");
    });

    it("should throw for function return type with specific message", () => {
      const fn = () => "hello";
      expect(() => normalizeComponentResult(fn as unknown as string)).toThrow(
        "Component returned a function 'fn' instead of JSX. " +
          "Did you mean to return JSX directly, or wrap with when() for conditional rendering?",
      );
    });

    it("should include component name in function return error", () => {
      function MyHelper() {
        return "hello";
      }
      expect(() => normalizeComponentResult(MyHelper as unknown as string, "MyComponent")).toThrow(
        "Component returned a function 'MyHelper' instead of JSX (in component 'MyComponent'). " +
          "Did you mean to return JSX directly, or wrap with when() for conditional rendering?",
      );
    });

    it("should include function name in function return error", () => {
      function renderItems() {
        return "items";
      }
      expect(() => normalizeComponentResult(renderItems as unknown as string)).toThrow(
        "Component returned a function 'renderItems' instead of JSX.",
      );
    });
  });
});
