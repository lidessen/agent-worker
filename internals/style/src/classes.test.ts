import { describe, it, expect } from "vitest";
import { classes, isClassRef } from "./classes";

describe("classes", () => {
  it("should create class refs with hashed names", () => {
    const c = classes(["root", "icon", "label"]);

    expect(c.root).toBeDefined();
    expect(c.icon).toBeDefined();
    expect(c.label).toBeDefined();
  });

  it("should stringify to hashed class name", () => {
    const c = classes(["button"]);

    const className = c.button.toString();
    expect(className).toMatch(/^button-[a-z0-9]+$/);
    expect(`${c.button}`).toBe(className);
  });

  it("should have unique IDs", () => {
    const c = classes(["a", "b"]);

    expect(c.a.id).not.toBe(c.b.id);
  });

  it("should generate class names with unique IDs across different calls", () => {
    const c1 = classes(["root"]);
    const c2 = classes(["root"]);

    // Different calls create different ClassRef objects
    expect(c1.root.id).not.toBe(c2.root.id);
  });

  it("should generate unique class names across different calls with same names", () => {
    const c1 = classes(["root", "icon"]);
    const c2 = classes(["root", "icon"]);
    const c3 = classes(["root", "icon"]);

    // Different calls must produce different hashed class names
    // even if called in the same millisecond
    const names = [c1.root.toString(), c2.root.toString(), c3.root.toString()];
    expect(new Set(names).size).toBe(3);
  });
});

describe("isClassRef", () => {
  it("should return true for ClassRef", () => {
    const c = classes(["test"]);
    expect(isClassRef(c.test)).toBe(true);
  });

  it("should return false for non-ClassRef values", () => {
    expect(isClassRef("string")).toBe(false);
    expect(isClassRef(123)).toBe(false);
    expect(isClassRef(null)).toBe(false);
    expect(isClassRef(undefined)).toBe(false);
    expect(isClassRef({})).toBe(false);
    expect(isClassRef({ id: Symbol(), toString: () => "test" })).toBe(false);
  });
});
