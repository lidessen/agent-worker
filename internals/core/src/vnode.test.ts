import { describe, it, expect, vi } from "vitest";
import { h, createTextVNode, createSignalVNode, isVNode, createFragment } from "../src/vnode";
import { Fragment } from "../src/types";
import { signal } from "@semajsx/signal";

describe("vnode", () => {
  describe("h()", () => {
    it("should create a basic element VNode", () => {
      const vnode = h("div", null);
      expect(vnode.type).toBe("div");
      expect(vnode.props).toEqual({});
      expect(vnode.children).toEqual([]);
    });

    it("should create a VNode with props", () => {
      const vnode = h("div", { id: "test", className: "container" });
      expect(vnode.type).toBe("div");
      expect(vnode.props).toEqual({ id: "test", className: "container" });
    });

    it("should handle key prop", () => {
      const vnode = h("div", { key: "my-key" });
      expect(vnode.key).toBe("my-key");
    });

    it("should normalize string children to text nodes", () => {
      const vnode = h("div", null, "Hello");
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].type).toBe("#text");
      expect(vnode.children[0].props.nodeValue).toBe("Hello");
    });

    it("should normalize number children to text nodes", () => {
      const vnode = h("div", null, 42);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].type).toBe("#text");
      expect(vnode.children[0].props.nodeValue).toBe("42");
    });

    it("should skip null and undefined children", () => {
      const vnode = h("div", null, null, "text", undefined);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].type).toBe("#text");
    });

    it("should skip boolean children", () => {
      const vnode = h("div", null, true, "text", false);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].type).toBe("#text");
    });

    it("should flatten array children", () => {
      const vnode = h("div", null, ["a", "b"], "c");
      expect(vnode.children.length).toBe(3);
      expect(vnode.children[0].props.nodeValue).toBe("a");
      expect(vnode.children[1].props.nodeValue).toBe("b");
      expect(vnode.children[2].props.nodeValue).toBe("c");
    });

    it("should handle nested array children", () => {
      const vnode = h("div", null, [["nested"]]);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].props.nodeValue).toBe("nested");
    });

    it("should wrap signals in signal nodes", () => {
      const s = signal("test");
      const vnode = h("div", null, s);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0].type).toBe("#signal");
      expect(vnode.children[0].props.signal).toBe(s);
    });

    it("should keep VNode children as-is", () => {
      const child = h("span", null);
      const vnode = h("div", null, child);
      expect(vnode.children.length).toBe(1);
      expect(vnode.children[0]).toBe(child);
    });

    it("should handle component type", () => {
      const MyComponent = () => h("div", null);
      const vnode = h(MyComponent, { title: "test" });
      expect(vnode.type).toBe(MyComponent);
      expect(vnode.props.title).toBe("test");
    });

    it("should handle Fragment type", () => {
      const vnode = h(Fragment, null, "a", "b");
      expect(vnode.type).toBe(Fragment);
      expect(vnode.children.length).toBe(2);
    });

    it("should warn on unknown child types", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const unknownObj = { unknown: true };
      h("div", null, unknownObj as any);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("createTextVNode()", () => {
    it("should create a text VNode from string", () => {
      const vnode = createTextVNode("Hello World");
      expect(vnode.type).toBe("#text");
      expect(vnode.props.nodeValue).toBe("Hello World");
      expect(vnode.children).toEqual([]);
    });

    it("should create a text VNode from number", () => {
      const vnode = createTextVNode(123);
      expect(vnode.type).toBe("#text");
      expect(vnode.props.nodeValue).toBe("123");
    });
  });

  describe("createSignalVNode()", () => {
    it("should create a signal VNode", () => {
      const s = signal("test");
      const vnode = createSignalVNode(s);
      expect(vnode.type).toBe("#signal");
      expect(vnode.props.signal).toBe(s);
      expect(vnode.children).toEqual([]);
    });
  });

  describe("isVNode()", () => {
    it("should return true for valid VNodes", () => {
      const vnode = h("div", null);
      expect(isVNode(vnode)).toBe(true);
    });

    it("should return true for text VNodes", () => {
      const vnode = createTextVNode("test");
      expect(isVNode(vnode)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isVNode(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isVNode(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isVNode("string")).toBe(false);
      expect(isVNode(42)).toBe(false);
      expect(isVNode(true)).toBe(false);
    });

    it("should return false for objects without required properties", () => {
      expect(isVNode({ type: "div" })).toBe(false);
      expect(isVNode({ type: "div", props: {} })).toBe(false);
      expect(isVNode({ props: {}, children: [] })).toBe(false);
    });

    it("should return true for objects with all required properties", () => {
      expect(isVNode({ type: "div", props: {}, children: [] })).toBe(true);
    });
  });

  describe("createFragment()", () => {
    it("should create a fragment VNode", () => {
      const vnode = createFragment(["a", "b"]);
      expect(vnode.type).toBe(Fragment);
      expect(vnode.children.length).toBe(2);
    });

    it("should create empty fragment", () => {
      const vnode = createFragment([]);
      expect(vnode.type).toBe(Fragment);
      expect(vnode.children).toEqual([]);
    });
  });
});
