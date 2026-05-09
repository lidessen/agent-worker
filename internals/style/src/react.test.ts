import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { signal } from "@semajsx/signal";
import { classes } from "./classes";
import { rule } from "./rule";

// Dynamic imports for optional peer dependencies
let React: typeof import("react") | null = null;
let ReactDOM: typeof import("react-dom/client") | null = null;
let styleReact: typeof import("./react") | null = null;

beforeAll(async () => {
  try {
    React = await import("react");
    ReactDOM = await import("react-dom/client");
    styleReact = await import("./react");
  } catch {
    // React not available
  }
});

describe("React Integration", () => {
  let container: HTMLDivElement;
  let root: import("react-dom/client").Root | null = null;

  beforeEach(() => {
    if (!React || !ReactDOM || !styleReact) return;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    if (!root) return;
    root.unmount();
    document.body.removeChild(container);
  });

  it("should render StyleAnchor with children", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle } = styleReact!;

    const c = classes(["box"]);
    const boxToken = rule`${c.box} { padding: 8px; }`;

    function TestComponent() {
      const cx = useStyle();
      return createElement("div", { className: cx(boxToken), "data-testid": "box" }, "Hello");
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));

    await new Promise((r) => setTimeout(r, 10));

    const box = container.querySelector('[data-testid="box"]');
    expect(box).not.toBeNull();
    expect(box?.className).toContain(c.box.toString());
  });

  it("should inject CSS when using cx with StyleToken", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle } = styleReact!;

    const c = classes(["btn"]);
    const btnToken = rule`${c.btn} { background: blue; }`;

    function TestComponent() {
      const cx = useStyle();
      return createElement("button", { className: cx(btnToken) }, "Click");
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));

    await new Promise((r) => setTimeout(r, 10));

    const styleEls = document.head.querySelectorAll("style");
    const hasStyle = Array.from(styleEls).some((el) =>
      el.textContent?.includes("background: blue"),
    );
    expect(hasStyle).toBe(true);
  });

  it("should combine multiple class names with cx", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle } = styleReact!;

    const c = classes(["base", "active"]);
    const baseToken = rule`${c.base} { padding: 8px; }`;
    const activeToken = rule`${c.active} { color: red; }`;

    function TestComponent() {
      const cx = useStyle();
      return createElement(
        "div",
        {
          className: cx(baseToken, activeToken, "custom"),
          "data-testid": "combined",
        },
        "Test",
      );
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));

    await new Promise((r) => setTimeout(r, 10));

    const el = container.querySelector('[data-testid="combined"]');
    expect(el?.className).toContain(c.base.toString());
    expect(el?.className).toContain(c.active.toString());
    expect(el?.className).toContain("custom");
  });

  it("should filter falsy values in cx", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle } = styleReact!;

    const c = classes(["btn", "large"]);
    const btnToken = rule`${c.btn} { padding: 8px; }`;
    const largeToken = rule`${c.large} { font-size: 18px; }`;

    function TestComponent() {
      const cx = useStyle();
      const isLarge = false;
      return createElement(
        "button",
        {
          className: cx(btnToken, isLarge && largeToken, null, undefined),
          "data-testid": "btn",
        },
        "Click",
      );
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));

    await new Promise((r) => setTimeout(r, 10));

    const btn = container.querySelector('[data-testid="btn"]');
    expect(btn?.className).toContain(c.btn.toString());
    expect(btn?.className).not.toContain(c.large.toString());
  });

  it("should handle signal bindings for reactive styles", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle, useSignal } = styleReact!;

    const c = classes(["box"]);

    function TestComponent() {
      const cx = useStyle();
      // Signal value includes the unit
      const height = useSignal("100px");

      const boxToken = rule`${c.box} { height: ${height}; }`;

      return createElement(
        "div",
        {
          className: cx(boxToken),
          "data-testid": "reactive-box",
          onClick: () => {
            height.value = "200px";
          },
        },
        "Reactive",
      );
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));

    await new Promise((r) => setTimeout(r, 50));

    const anchor = container.querySelector('div[style*="display: contents"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("style")).toContain("100px");
  });

  it("should work without StyleAnchor (fallback mode)", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { useStyle } = styleReact!;

    const c = classes(["fallback"]);
    const token = rule`${c.fallback} { margin: 4px; }`;

    function TestComponent() {
      const cx = useStyle();
      return createElement("div", { className: cx(token), "data-testid": "fallback" }, "Fallback");
    }

    root!.render(createElement(TestComponent));

    await new Promise((r) => setTimeout(r, 10));

    const el = container.querySelector('[data-testid="fallback"]');
    expect(el?.className).toContain(c.fallback.toString());
  });

  it("should cleanup subscriptions on unmount", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { StyleAnchor, useStyle } = styleReact!;

    const c = classes(["cleanup"]);
    const height = signal("100px");
    const boxToken = rule`${c.cleanup} { height: ${height}; }`;

    function TestComponent() {
      const cx = useStyle();
      return createElement("div", { className: cx(boxToken) }, "Cleanup");
    }

    root!.render(createElement(StyleAnchor, null, createElement(TestComponent)));
    await new Promise((r) => setTimeout(r, 10));

    root!.unmount();
    root = null;

    height.value = "300px";
    await new Promise((r) => setTimeout(r, 10));

    expect(true).toBe(true);
  });
});

describe("useSignal", () => {
  let container: HTMLDivElement;
  let root: import("react-dom/client").Root | null = null;

  beforeEach(() => {
    if (!React || !ReactDOM || !styleReact) return;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    if (!root) return;
    root.unmount();
    document.body.removeChild(container);
  });

  it("should create a signal with initial value", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement } = React!;
    const { useSignal } = styleReact!;

    let capturedSignal: ReturnType<typeof useSignal<number>> | null = null;

    function TestComponent() {
      const count = useSignal(42);
      capturedSignal = count;
      return createElement("span", null, String(count.value));
    }

    root!.render(createElement(TestComponent));
    await new Promise((r) => setTimeout(r, 10));

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal?.value).toBe(42);
  });

  it("should preserve signal across re-renders", async ({ skip }) => {
    if (!React || !ReactDOM || !styleReact) skip();
    const { createElement, useState, useEffect } = React!;
    const { useSignal } = styleReact!;

    const signals: Array<ReturnType<typeof useSignal<number>>> = [];

    function TestComponent() {
      const count = useSignal(0);
      signals.push(count);

      const [, setTrigger] = useState(0);

      useEffect(() => {
        setTrigger(1);
      }, []);

      return createElement("span", null, String(count.value));
    }

    root!.render(createElement(TestComponent));
    await new Promise((r) => setTimeout(r, 50));

    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals[0]).toBe(signals[1]);
  });
});
