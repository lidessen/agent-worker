import { describe, it, expect } from "vitest";
import { signal } from "@semajsx/signal";
import { classes } from "./classes";
import { rule, rules, isStyleToken } from "./rule";

describe("rule", () => {
  it("should create a StyleToken with className", () => {
    const c = classes(["root"]);
    const token = rule`${c.root} { padding: 8px; }`;

    expect(token.__kind).toBe("style");
    expect(token._).toBe(c.root.toString());
    expect(token.__cssTemplate).toContain("padding: 8px");
    expect(token.toString()).toBe(c.root.toString());
  });

  it("should handle pseudo-class selectors (no className)", () => {
    const c = classes(["root"]);
    const token = rule`${c.root}:hover { background: blue; }`;

    expect(token.__kind).toBe("style");
    expect(token._).toBeUndefined();
    expect(token.__cssTemplate).toContain(":hover");
    expect(token.toString()).toBe("");
  });

  it("should handle descendant combinators", () => {
    const c = classes(["root", "icon"]);
    const token = rule`${c.root} > ${c.icon} { margin-right: 8px; }`;

    expect(token.__kind).toBe("style");
    expect(token._).toBeUndefined();
    expect(token.__cssTemplate).toContain(c.root.toString());
    expect(token.__cssTemplate).toContain(c.icon.toString());
  });

  it("should handle signal interpolation", () => {
    const c = classes(["box"]);
    // Signal value should include unit - no automatic unit extraction
    const height = signal("100px");

    const token = rule`${c.box} { height: ${height}; }`;

    expect(token.__kind).toBe("style");
    expect(token.__bindingDefs).toBeDefined();
    expect(token.__bindingDefs).toHaveLength(1);
    expect(token.__bindingDefs![0].signal).toBe(height);
    expect(token.__cssTemplate).toContain("{{0}}");
  });

  it("should handle multiple signal interpolations", () => {
    const c = classes(["box"]);
    // Signal values should include units
    const height = signal("100px");
    const width = signal("200em");

    const token = rule`${c.box} { height: ${height}; width: ${width}; }`;

    expect(token.__bindingDefs).toHaveLength(2);
    expect(token.__cssTemplate).toContain("{{0}}");
    expect(token.__cssTemplate).toContain("{{1}}");
  });

  it("should handle signal without unit (e.g. opacity)", () => {
    const c = classes(["box"]);
    const opacity = signal(0.5);

    const token = rule`${c.box} { opacity: ${opacity}; }`;

    expect(token.__bindingDefs).toHaveLength(1);
    expect(token.__bindingDefs![0].signal).toBe(opacity);
  });

  it("should handle static value interpolation", () => {
    const c = classes(["box"]);
    const padding = 16;

    const token = rule`${c.box} { padding: ${padding}px; }`;

    expect(token.__bindingDefs).toBeUndefined();
    expect(token.__cssTemplate).toContain("16px");
  });

  it("should handle global selectors", () => {
    const token = rule`body { margin: 0; }`;

    expect(token._).toBeUndefined();
    expect(token.__cssTemplate).toBe("body { margin: 0; }");
  });
});

describe("rules", () => {
  it("should combine multiple StyleTokens", () => {
    const c = classes(["root"]);

    const combined = rules(
      rule`${c.root}:hover { background: blue; }`,
      rule`${c.root}:active { transform: scale(0.98); }`,
    );

    expect(combined.__kind).toBe("style");
    expect(combined._).toBeUndefined();
    expect(combined.__cssTemplate).toContain(":hover");
    expect(combined.__cssTemplate).toContain(":active");
    expect(combined.toString()).toBe("");
  });

  it("should merge binding definitions", () => {
    const c = classes(["box"]);
    const height = signal("100px");
    const opacity = signal(0.5);

    const combined = rules(
      rule`${c.box} { height: ${height}; }`,
      rule`${c.box}:hover { opacity: ${opacity}; }`,
    );

    expect(combined.__bindingDefs).toHaveLength(2);
  });
});

describe("isStyleToken", () => {
  it("should return true for StyleToken", () => {
    const c = classes(["test"]);
    const token = rule`${c.test} { color: red; }`;

    expect(isStyleToken(token)).toBe(true);
  });

  it("should return false for non-StyleToken values", () => {
    expect(isStyleToken("string")).toBe(false);
    expect(isStyleToken(123)).toBe(false);
    expect(isStyleToken(null)).toBe(false);
    expect(isStyleToken(undefined)).toBe(false);
    expect(isStyleToken({})).toBe(false);
    expect(isStyleToken({ __kind: "other" })).toBe(false);
  });
});
