import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signal } from "@semajsx/signal";
import { classes } from "./classes";
import { rule } from "./rule";
import { StyleRegistry, createRegistry, createCx } from "./registry";

describe("StyleRegistry", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should process tokens and return className", () => {
    const c = classes(["button"]);
    const token = rule`${c.button} { padding: 8px; }`;

    const registry = new StyleRegistry({ target: container });
    const className = registry.processToken(token);

    expect(className).toBe(c.button.toString());
  });

  it("should inject CSS when processing token", () => {
    const c = classes(["button"]);
    const token = rule`${c.button} { padding: 8px; }`;

    const registry = new StyleRegistry({ target: container });
    registry.processToken(token);

    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain("padding: 8px");
  });

  it("should deduplicate CSS injection", () => {
    const c = classes(["button"]);
    const token = rule`${c.button} { padding: 8px; }`;

    const registry = new StyleRegistry({ target: container });
    registry.processToken(token);
    registry.processToken(token);
    registry.processToken(token);

    const styleElements = container.querySelectorAll("style");
    expect(styleElements.length).toBe(1);
  });

  it("should handle signal bindings with anchor element", async () => {
    const c = classes(["box"]);
    // Signal value includes the unit
    const height = signal("100px");
    const token = rule`${c.box} { height: ${height}; }`;

    const registry = new StyleRegistry({ target: container });
    registry.setAnchorElement(container);
    registry.processToken(token);

    // Should set CSS variable on anchor element
    expect(container.style.cssText).toContain("100px");

    // Update signal
    height.value = "200px";
    await new Promise((r) => queueMicrotask(r));

    // Should update CSS variable
    expect(container.style.cssText).toContain("200px");

    registry.dispose();
  });

  it("should cleanup subscriptions on dispose", async () => {
    const c = classes(["box"]);
    const height = signal("100px");
    const token = rule`${c.box} { height: ${height}; }`;

    const registry = new StyleRegistry({ target: container });
    registry.setAnchorElement(container);
    registry.processToken(token);

    registry.dispose();

    // After dispose, signal updates should not affect the element
    const currentStyle = container.style.cssText;
    height.value = "300px";
    await new Promise((r) => queueMicrotask(r));

    expect(container.style.cssText).toBe(currentStyle);
  });

  it("should handle tokens without className", () => {
    const c = classes(["root"]);
    const token = rule`${c.root}:hover { background: blue; }`;

    const registry = new StyleRegistry({ target: container });
    const className = registry.processToken(token);

    expect(className).toBe("");

    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain(":hover");
  });
});

describe("createRegistry", () => {
  it("should create a StyleRegistry instance", () => {
    const registry = createRegistry();
    expect(registry).toBeInstanceOf(StyleRegistry);
  });

  it("should accept options", () => {
    const container = document.createElement("div");
    const registry = createRegistry({ target: container });
    expect(registry).toBeInstanceOf(StyleRegistry);
  });
});

describe("createCx", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should combine classes from tokens and strings", () => {
    const c = classes(["button", "primary"]);
    const buttonToken = rule`${c.button} { padding: 8px; }`;
    const primaryToken = rule`${c.primary} { background: blue; }`;

    const registry = new StyleRegistry({ target: container });
    const cx = createCx(registry);

    const className = cx(buttonToken, primaryToken, "custom-class");
    expect(className).toContain(c.button.toString());
    expect(className).toContain(c.primary.toString());
    expect(className).toContain("custom-class");
  });

  it("should filter falsy values", () => {
    const c = classes(["button"]);
    const token = rule`${c.button} { padding: 8px; }`;

    const registry = new StyleRegistry({ target: container });
    const cx = createCx(registry);

    const className = cx(token, false, null, undefined, "extra");
    expect(className).toBe(`${c.button} extra`);
  });

  it("should handle conditional classes", () => {
    const c = classes(["button", "large"]);
    const buttonToken = rule`${c.button} { padding: 8px; }`;
    const largeToken = rule`${c.large} { font-size: 18px; }`;

    const registry = new StyleRegistry({ target: container });
    const cx = createCx(registry);

    const isLarge = true;
    const className = cx(buttonToken, isLarge && largeToken);

    expect(className).toContain(c.button.toString());
    expect(className).toContain(c.large.toString());
  });

  it("should handle false conditional", () => {
    const c = classes(["button", "large"]);
    const buttonToken = rule`${c.button} { padding: 8px; }`;
    const largeToken = rule`${c.large} { font-size: 18px; }`;

    const registry = new StyleRegistry({ target: container });
    const cx = createCx(registry);

    const isLarge = false;
    const className = cx(buttonToken, isLarge && largeToken);

    expect(className).toContain(c.button.toString());
    expect(className).not.toContain(c.large.toString());
  });
});
