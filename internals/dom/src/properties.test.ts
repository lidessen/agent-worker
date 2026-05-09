import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setProperty, setSignalProperty, setRef } from "../src/properties";
import { signal } from "@semajsx/signal";

describe("properties", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("setProperty()", () => {
    it("should skip internal props", () => {
      const div = document.createElement("div");
      setProperty(div, "key", "test-key");
      setProperty(div, "ref", () => {});
      setProperty(div, "children", []);

      expect(div.getAttribute("key")).toBeNull();
      expect(div.getAttribute("ref")).toBeNull();
      expect(div.getAttribute("children")).toBeNull();
    });

    describe("event handlers", () => {
      it("should add event listener for onclick", () => {
        const div = document.createElement("div");
        const handler = vi.fn();
        setProperty(div, "onclick", handler);

        div.click();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should replace existing event listener", () => {
        const div = document.createElement("div");
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        setProperty(div, "onclick", handler1);
        setProperty(div, "onclick", handler2);

        div.click();
        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledTimes(1);
      });
    });

    describe("className/class", () => {
      it("should set className via class attribute", () => {
        const div = document.createElement("div");
        setProperty(div, "className", "my-class");

        expect(div.getAttribute("class")).toBe("my-class");
      });

      it("should set class attribute", () => {
        const div = document.createElement("div");
        setProperty(div, "class", "another-class");

        expect(div.getAttribute("class")).toBe("another-class");
      });

      it("should remove class when value is null", () => {
        const div = document.createElement("div");
        div.className = "old-class";
        setProperty(div, "className", null);

        expect(div.getAttribute("class")).toBeNull();
      });
    });

    describe("style", () => {
      it("should set style from string", () => {
        const div = document.createElement("div");
        setProperty(div, "style", "color: red; font-size: 16px;");

        expect(div.style.cssText).toContain("color");
      });

      it("should set style from object", () => {
        const div = document.createElement("div");
        setProperty(div, "style", { color: "blue", fontSize: "14px" });

        expect(div.style.color).toBe("blue");
        expect(div.style.fontSize).toBe("14px");
      });
    });

    describe("boolean attributes", () => {
      it("should set attribute when true", () => {
        const input = document.createElement("input");
        setProperty(input, "disabled", true);

        expect(input.hasAttribute("disabled")).toBe(true);
      });

      it("should remove attribute when false", () => {
        const input = document.createElement("input");
        input.setAttribute("disabled", "");
        setProperty(input, "disabled", false);

        expect(input.hasAttribute("disabled")).toBe(false);
      });
    });

    describe("value property", () => {
      it("should set value on input element", () => {
        const input = document.createElement("input");
        setProperty(input, "value", "test value");

        expect(input.value).toBe("test value");
      });

      it("should set value on textarea", () => {
        const textarea = document.createElement("textarea");
        setProperty(textarea, "value", "textarea content");

        expect(textarea.value).toBe("textarea content");
      });

      it("should set value on select", () => {
        const select = document.createElement("select");
        const option = document.createElement("option");
        option.value = "opt1";
        select.appendChild(option);
        setProperty(select, "value", "opt1");

        expect(select.value).toBe("opt1");
      });
    });

    describe("checked property", () => {
      it("should set checked on checkbox", () => {
        const input = document.createElement("input");
        input.type = "checkbox";
        setProperty(input, "checked", true);

        expect(input.checked).toBe(true);
      });

      it("should remove checked attribute when false", () => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("checked", "");
        setProperty(input, "checked", false);

        // Boolean false removes the attribute
        expect(input.hasAttribute("checked")).toBe(false);
      });
    });

    describe("default attribute handling", () => {
      it("should set attribute with string value", () => {
        const div = document.createElement("div");
        setProperty(div, "data-testid", "my-test");

        expect(div.getAttribute("data-testid")).toBe("my-test");
      });

      it("should convert number to string", () => {
        const div = document.createElement("div");
        setProperty(div, "tabindex", 5);

        expect(div.getAttribute("tabindex")).toBe("5");
      });

      it("should remove attribute when null", () => {
        const div = document.createElement("div");
        div.setAttribute("id", "old-id");
        setProperty(div, "id", null);

        expect(div.getAttribute("id")).toBeNull();
      });

      it("should remove attribute when undefined", () => {
        const div = document.createElement("div");
        div.setAttribute("id", "old-id");
        setProperty(div, "id", undefined);

        expect(div.getAttribute("id")).toBeNull();
      });
    });
  });

  describe("setSignalProperty()", () => {
    it("should set initial value from signal", () => {
      const div = document.createElement("div");
      const className = signal("initial");

      setSignalProperty(div, "class", className);

      expect(div.getAttribute("class")).toBe("initial");
    });

    it("should update on signal change", async () => {
      const div = document.createElement("div");
      const className = signal("initial");

      setSignalProperty(div, "class", className);
      className.value = "updated";

      await new Promise((r) => queueMicrotask(r));
      expect(div.getAttribute("class")).toBe("updated");
    });

    it("should return unsubscribe function", async () => {
      const div = document.createElement("div");
      const className = signal("initial");

      const unsubscribe = setSignalProperty(div, "class", className);
      unsubscribe();

      className.value = "updated";
      await new Promise((r) => queueMicrotask(r));

      // Should still be initial after unsubscribe
      expect(div.getAttribute("class")).toBe("initial");
    });
  });

  describe("setRef()", () => {
    it("should call callback ref with element", () => {
      const div = document.createElement("div");
      const refCallback = vi.fn();

      setRef(div, refCallback);

      expect(refCallback).toHaveBeenCalledWith(div);
    });

    it("should call cleanup with null", () => {
      const div = document.createElement("div");
      const refCallback = vi.fn();

      const cleanup = setRef(div, refCallback);
      cleanup();

      expect(refCallback).toHaveBeenCalledTimes(2);
      expect(refCallback).toHaveBeenLastCalledWith(null);
    });

    it("should set signal ref value", () => {
      const div = document.createElement("div");
      const ref = signal<Element | null>(null);

      setRef(div, ref);

      expect(ref.value).toBe(div);
    });

    it("should clear signal ref on cleanup", () => {
      const div = document.createElement("div");
      const ref = signal<Element | null>(null);

      const cleanup = setRef(div, ref);
      expect(ref.value).toBe(div);

      cleanup();
      expect(ref.value).toBeNull();
    });

    it("should handle invalid ref type", () => {
      const div = document.createElement("div");
      // Invalid ref type should return empty cleanup
      const cleanup = setRef(div, "invalid" as any);

      expect(typeof cleanup).toBe("function");
      expect(() => cleanup()).not.toThrow();
    });
  });
});
