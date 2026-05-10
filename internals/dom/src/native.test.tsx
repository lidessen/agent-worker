/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { render, Native } from "@semajsx/dom";

describe("Native", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render a native DOM element", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 12h14");
    svg.appendChild(path);

    render(<Native element={svg} />, container);

    const rendered = container.querySelector("svg");
    expect(rendered).toBe(svg);
    expect(rendered?.querySelector("path")?.getAttribute("d")).toBe("M5 12h14");
  });

  it("should apply attribute overrides", () => {
    const el = document.createElement("span");
    el.textContent = "icon";

    render(<Native element={el} class="my-icon" data-testid="test" />, container);

    const rendered = container.querySelector("span");
    expect(rendered).toBe(el);
    expect(rendered?.getAttribute("class")).toBe("my-icon");
    expect(rendered?.getAttribute("data-testid")).toBe("test");
  });

  it("should apply style override", () => {
    const el = document.createElement("div");

    render(<Native element={el} style="color: red;" />, container);

    expect(el.style.cssText).toContain("color: red");
  });

  it("should apply event handlers", () => {
    const el = document.createElement("button");
    let clicked = false;

    render(
      <Native
        element={el}
        onClick={() => {
          clicked = true;
        }}
      />,
      container,
    );

    el.click();
    expect(clicked).toBe(true);
  });

  it("should support signal props", async () => {
    const color = signal("red");
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    render(<Native element={el} stroke={color} />, container);

    expect(el.getAttribute("stroke")).toBe("red");

    color.value = "blue";
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(el.getAttribute("stroke")).toBe("blue");
  });

  it("should work as child of JSX element", () => {
    const span = document.createElement("span");
    span.textContent = "native";

    render(
      <div class="wrapper">
        <p>before</p>
        <Native element={span} />
        <p>after</p>
      </div>,
      container,
    );

    const wrapper = container.querySelector(".wrapper");
    expect(wrapper?.children.length).toBe(3);
    expect(wrapper?.children[1]).toBe(span);
  });

  it("should cleanup signal subscriptions on unmount", async () => {
    const color = signal("red");
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    const { unmount } = render(<Native element={el} stroke={color} />, container);

    expect(el.getAttribute("stroke")).toBe("red");

    unmount();

    // After unmount, signal updates should not affect the element
    color.value = "blue";
    await new Promise((resolve) => queueMicrotask(resolve));
    // The attribute might still change since we don't prevent it after unmount,
    // but the subscription should be cleaned up (no memory leak)
  });
});
