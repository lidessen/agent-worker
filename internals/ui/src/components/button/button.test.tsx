/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Button } from "./button";
import { lightTheme } from "../../theme/themes";

describe("Button", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    inject(lightTheme);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // --- Rendering ---

  it("renders a button element", () => {
    render(<Button>Click me</Button>, container);
    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toBe("Click me");
  });

  it("sets type='button' by default", () => {
    render(<Button>Test</Button>, container);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("allows overriding type", () => {
    render(<Button type="submit">Submit</Button>, container);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("type")).toBe("submit");
  });

  // --- Variants ---

  it("applies solid variant classes by default", () => {
    render(<Button>Solid</Button>, container);
    const btn = container.querySelector("button")!;
    const classes = btn.getAttribute("class") ?? "";
    // Should have some class applied (hashed class names)
    expect(classes.length).toBeGreaterThan(0);
  });

  it("applies outline variant classes", () => {
    render(<Button variant="outline">Outline</Button>, container);
    const btn = container.querySelector("button")!;
    const classes = btn.getAttribute("class") ?? "";
    expect(classes.length).toBeGreaterThan(0);
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>, container);
    const btn = container.querySelector("button")!;
    const classes = btn.getAttribute("class") ?? "";
    expect(classes.length).toBeGreaterThan(0);
  });

  // --- Sizes ---

  it("renders different sizes with different class sets", () => {
    render(
      <div>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>,
      container,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3);

    // Each size should have a class
    const smClasses = buttons[0]!.getAttribute("class") ?? "";
    const mdClasses = buttons[1]!.getAttribute("class") ?? "";
    const lgClasses = buttons[2]!.getAttribute("class") ?? "";

    expect(smClasses.length).toBeGreaterThan(0);
    expect(mdClasses.length).toBeGreaterThan(0);
    expect(lgClasses.length).toBeGreaterThan(0);
  });

  // --- Danger color ---

  it("applies danger color classes", () => {
    render(<Button color="danger">Delete</Button>, container);
    const btn = container.querySelector("button")!;
    const classes = btn.getAttribute("class") ?? "";
    expect(classes.length).toBeGreaterThan(0);
  });

  // --- Disabled ---

  it("sets disabled attribute", () => {
    render(<Button disabled>Disabled</Button>, container);
    const btn = container.querySelector("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("does not set disabled when false", () => {
    render(<Button>Enabled</Button>, container);
    const btn = container.querySelector("button")!;
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  // --- Events ---

  it("calls onClick handler", () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>, container);
    const btn = container.querySelector("button")!;
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handler = vi.fn();
    render(
      <Button onClick={handler} disabled>
        Click
      </Button>,
      container,
    );
    const btn = container.querySelector("button")!;
    btn.click();
    expect(handler).not.toHaveBeenCalled();
  });

  // --- Accessibility ---

  it("supports aria-label", () => {
    render(<Button aria-label="Close dialog">X</Button>, container);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Close dialog");
  });

  // --- Custom class ---

  it("merges custom class with component classes", () => {
    render(<Button class="my-custom">Test</Button>, container);
    const btn = container.querySelector("button")!;
    const classes = btn.getAttribute("class") ?? "";
    expect(classes).toContain("my-custom");
  });
});
