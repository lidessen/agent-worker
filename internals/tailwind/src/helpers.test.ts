import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import { cx, extractCss } from "./helpers";
import { p4, m4, gap4 } from "./spacing";
import { w4, wFull } from "./sizing";
import { textBase, fontBold } from "./typography";

describe("cx helper", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("combines multiple tokens into a single class string", () => {
    expect(cx(p4, m4, gap4)).toBe("p-4 m-4 gap-4");
  });

  it("handles tokens from different modules", () => {
    expect(cx(p4, wFull, textBase, fontBold)).toBe("p-4 w-full text-base font-bold");
  });

  it("handles raw strings", () => {
    expect(cx(p4, "custom-class", m4)).toBe("p-4 custom-class m-4");
  });

  it("ignores falsy values", () => {
    expect(cx(p4, false, m4)).toBe("p-4 m-4");
    expect(cx(p4, null, m4)).toBe("p-4 m-4");
    expect(cx(p4, undefined, m4)).toBe("p-4 m-4");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;

    expect(cx(p4, isActive && m4, isDisabled && gap4)).toBe("p-4 m-4");
  });

  it("handles nested arrays", () => {
    const base = [p4, m4];
    const sizing = [w4, wFull];

    expect(cx(base, sizing)).toBe("p-4 m-4 w-4 w-full");
  });

  it("handles deeply nested arrays", () => {
    expect(
      cx([
        [p4, m4],
        [w4, [wFull]],
      ]),
    ).toBe("p-4 m-4 w-4 w-full");
  });

  it("returns empty string for no arguments", () => {
    expect(cx()).toBe("");
  });

  it("returns empty string for only falsy arguments", () => {
    expect(cx(false, null, undefined)).toBe("");
  });

  it("handles single token", () => {
    expect(cx(p4)).toBe("p-4");
  });

  it("handles mixed token types", () => {
    const condition = false;
    expect(cx(p4, "custom", [m4, wFull], condition && gap4)).toBe("p-4 custom m-4 w-full");
  });
});

describe("extractCss helper", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("extracts CSS from a single token", () => {
    expect(extractCss(p4)).toBe(".p-4 { padding: 1rem; }");
  });

  it("extracts CSS from multiple tokens", () => {
    const css = extractCss(p4, m4);
    expect(css).toContain(".p-4 { padding: 1rem; }");
    expect(css).toContain(".m-4 { margin: 1rem; }");
  });

  it("extracts CSS from arrays of tokens", () => {
    const css = extractCss([p4, m4], [wFull]);
    expect(css).toContain(".p-4 { padding: 1rem; }");
    expect(css).toContain(".m-4 { margin: 1rem; }");
    expect(css).toContain(".w-full { width: 100%; }");
  });

  it("deduplicates CSS templates", () => {
    const css = extractCss(p4, p4, p4);
    // Should only contain one instance
    expect(css.match(/\.p-4/g)?.length).toBe(1);
  });

  it("returns empty string for no arguments", () => {
    expect(extractCss()).toBe("");
  });
});
