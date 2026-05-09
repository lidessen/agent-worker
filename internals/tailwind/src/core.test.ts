import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hashString,
  valueToSuffix,
  createUtility,
  createTaggedUtility,
  createMultiUtility,
} from "./core";
import { configureTailwind, resetConfig } from "./config";

describe("hashString", () => {
  it("produces deterministic output", () => {
    const hash1 = hashString("test-value");
    const hash2 = hashString("test-value");
    expect(hash1).toBe(hash2);
  });

  it("produces different output for different inputs", () => {
    const hash1 = hashString("value-a");
    const hash2 = hashString("value-b");
    expect(hash1).not.toBe(hash2);
  });

  it("produces short output (5 chars)", () => {
    const hash = hashString("some-long-test-value");
    expect(hash.length).toBe(5);
  });

  it("only contains alphanumeric characters", () => {
    const hash = hashString("calc(100% - 40px)");
    expect(hash).toMatch(/^[a-z0-9]+$/);
  });
});

describe("valueToSuffix", () => {
  it("returns simple values as-is", () => {
    expect(valueToSuffix("4px")).toBe("4px");
    expect(valueToSuffix("1rem")).toBe("1rem");
    expect(valueToSuffix("100")).toBe("100");
  });

  it("replaces dots with underscores", () => {
    expect(valueToSuffix("0.5rem")).toBe("0_5rem");
    expect(valueToSuffix("1.5")).toBe("1_5");
  });

  it("hashes complex values", () => {
    const suffix = valueToSuffix("calc(100% - 40px)");
    expect(suffix.length).toBe(5);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });

  it("hashes values with special characters", () => {
    const suffix = valueToSuffix("rgb(255, 0, 0)");
    expect(suffix.length).toBe(5);
  });

  it("produces deterministic output for complex values", () => {
    const suffix1 = valueToSuffix("calc(100% - 40px)");
    const suffix2 = valueToSuffix("calc(100% - 40px)");
    expect(suffix1).toBe(suffix2);
  });
});

describe("createUtility", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it("creates a StyleToken with correct class name", () => {
    const padding = createUtility("padding", "p");
    const token = padding("1rem", "4");

    expect(token._).toBe("p-4");
    expect(token.__kind).toBe("style");
  });

  it("generates correct CSS template", () => {
    const padding = createUtility("padding", "p");
    const token = padding("1rem", "4");

    expect(token.__cssTemplate).toBe(".p-4 { padding: 1rem; }");
  });

  it("toString returns the class name", () => {
    const padding = createUtility("padding", "p");
    const token = padding("1rem", "4");

    expect(token.toString()).toBe("p-4");
    expect(`${token}`).toBe("p-4");
  });

  it("derives suffix from value when valueName not provided", () => {
    const padding = createUtility("padding", "p");
    const token = padding("10px");

    expect(token._).toBe("p-10px");
  });

  it("hashes complex arbitrary values", () => {
    const padding = createUtility("padding", "p");
    const token = padding("calc(100% - 40px)");

    expect(token._).toMatch(/^p-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("calc(100% - 40px)");
  });

  it("respects global prefix configuration", () => {
    configureTailwind({ prefix: "s-" });

    const padding = createUtility("padding", "p");
    const token = padding("1rem", "4");

    expect(token._).toBe("s-p-4");
    expect(token.__cssTemplate).toBe(".s-p-4 { padding: 1rem; }");
  });

  it("respects local config over global config", () => {
    configureTailwind({ prefix: "global-" });

    const padding = createUtility("padding", "p", { prefix: "local-" });
    const token = padding("1rem", "4");

    expect(token._).toBe("local-p-4");
  });
});

describe("createTaggedUtility", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it("creates StyleToken from tagged template", () => {
    const padding = createUtility("padding", "p");
    const p = createTaggedUtility(padding);

    const token = p`10px`;

    expect(token._).toBe("p-10px");
    expect(token.__cssTemplate).toBe(".p-10px { padding: 10px; }");
  });

  it("handles template with interpolations", () => {
    const padding = createUtility("padding", "p");
    const p = createTaggedUtility(padding);

    const size = 10;
    const token = p`${size}px`;

    expect(token._).toBe("p-10px");
  });

  it("hashes complex expressions", () => {
    const padding = createUtility("padding", "p");
    const p = createTaggedUtility(padding);

    const token = p`calc(100% - 40px)`;

    expect(token._).toMatch(/^p-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("calc(100% - 40px)");
  });
});

describe("createMultiUtility", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it("creates StyleToken with multiple CSS properties", () => {
    const mx = createMultiUtility(["margin-left", "margin-right"], "mx");
    const token = mx("1rem", "4");

    expect(token._).toBe("mx-4");
    expect(token.__cssTemplate).toBe(".mx-4 { margin-left: 1rem; margin-right: 1rem; }");
  });

  it("respects prefix configuration", () => {
    configureTailwind({ prefix: "s-" });

    const mx = createMultiUtility(["margin-left", "margin-right"], "mx");
    const token = mx("1rem", "4");

    expect(token._).toBe("s-mx-4");
  });

  it("handles arbitrary values", () => {
    const mx = createMultiUtility(["margin-left", "margin-right"], "mx");
    const token = mx("10px");

    expect(token._).toBe("mx-10px");
    expect(token.__cssTemplate).toContain("margin-left: 10px");
    expect(token.__cssTemplate).toContain("margin-right: 10px");
  });
});
