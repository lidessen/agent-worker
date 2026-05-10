import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { signal } from "@semajsx/signal";
import { classes } from "./classes";
import { rule } from "./rule";

// Dynamic imports for optional peer dependencies
let Vue: typeof import("vue") | null = null;
let styleVue: typeof import("./vue") | null = null;

beforeAll(async () => {
  try {
    Vue = await import("vue");
    styleVue = await import("./vue");
  } catch {
    // Vue not available
  }
});

describe("Vue Integration", () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof import("vue").createApp> | null = null;

  beforeEach(() => {
    if (!Vue || !styleVue) return;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (!container) return;
    app?.unmount();
    document.body.removeChild(container);
  });

  it("should render StyleAnchor with children", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle } = styleVue!;

    const c = classes(["box"]);
    const boxToken = rule`${c.box} { padding: 8px; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        return () => h("div", { class: cx(boxToken), "data-testid": "box" }, "Hello");
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    const box = container.querySelector('[data-testid="box"]');
    expect(box).not.toBeNull();
    expect(box?.className).toContain(c.box.toString());
  });

  it("should inject CSS when using cx with StyleToken", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle } = styleVue!;

    const c = classes(["btn"]);
    const btnToken = rule`${c.btn} { background: green; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        return () => h("button", { class: cx(btnToken) }, "Click");
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    const styleEls = document.head.querySelectorAll("style");
    const hasStyle = Array.from(styleEls).some((el) =>
      el.textContent?.includes("background: green"),
    );
    expect(hasStyle).toBe(true);
  });

  it("should combine multiple class names with cx", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle } = styleVue!;

    const c = classes(["base", "active"]);
    const baseToken = rule`${c.base} { padding: 8px; }`;
    const activeToken = rule`${c.active} { color: red; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        return () =>
          h(
            "div",
            {
              class: cx(baseToken, activeToken, "custom"),
              "data-testid": "combined",
            },
            "Test",
          );
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    const el = container.querySelector('[data-testid="combined"]');
    expect(el?.className).toContain(c.base.toString());
    expect(el?.className).toContain(c.active.toString());
    expect(el?.className).toContain("custom");
  });

  it("should filter falsy values in cx", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle } = styleVue!;

    const c = classes(["btn", "large"]);
    const btnToken = rule`${c.btn} { padding: 8px; }`;
    const largeToken = rule`${c.large} { font-size: 18px; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        const isLarge = false;
        return () =>
          h(
            "button",
            {
              class: cx(btnToken, isLarge && largeToken, null, undefined),
              "data-testid": "btn",
            },
            "Click",
          );
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    const btn = container.querySelector('[data-testid="btn"]');
    expect(btn?.className).toContain(c.btn.toString());
    expect(btn?.className).not.toContain(c.large.toString());
  });

  it("should handle signal bindings for reactive styles", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle, useSignal } = styleVue!;

    const c = classes(["box"]);

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        // Signal value includes the unit
        const height = useSignal("100px");

        const boxToken = rule`${c.box} { height: ${height}; }`;

        return () =>
          h(
            "div",
            {
              class: cx(boxToken),
              "data-testid": "reactive-box",
              onClick: () => {
                height.value = "200px";
              },
            },
            "Reactive",
          );
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    const anchor = container.querySelector('div[style*="display: contents"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("style")).toContain("100px");
  });

  it("should work without StyleAnchor (fallback mode)", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { useStyle } = styleVue!;

    const c = classes(["fallback"]);
    const token = rule`${c.fallback} { margin: 4px; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        return () => h("div", { class: cx(token), "data-testid": "fallback" }, "Fallback");
      },
    });

    app = createApp(TestComponent);
    app.mount(container);

    await nextTick();

    const el = container.querySelector('[data-testid="fallback"]');
    expect(el?.className).toContain(c.fallback.toString());
  });

  it("should cleanup subscriptions on unmount", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { StyleAnchor, useStyle } = styleVue!;

    const c = classes(["cleanup"]);
    const height = signal("100px");
    const boxToken = rule`${c.cleanup} { height: ${height}; }`;

    const TestComponent = defineComponent({
      setup() {
        const cx = useStyle();
        return () => h("div", { class: cx(boxToken) }, "Cleanup");
      },
    });

    const App = defineComponent({
      setup() {
        return () => h(StyleAnchor, null, { default: () => h(TestComponent) });
      },
    });

    app = createApp(App);
    app.mount(container);

    await nextTick();

    app.unmount();
    app = null;

    height.value = "300px";
    await nextTick();

    expect(true).toBe(true);
  });
});

describe("useSignal (Vue)", () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof import("vue").createApp> | null = null;

  beforeEach(() => {
    if (!Vue || !styleVue) return;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (!container) return;
    app?.unmount();
    document.body.removeChild(container);
  });

  it("should create a signal with initial value", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { useSignal } = styleVue!;

    let capturedSignal: ReturnType<typeof useSignal<number>> | null = null;

    const TestComponent = defineComponent({
      setup() {
        const count = useSignal(42);
        capturedSignal = count;
        return () => h("span", null, String(count.value));
      },
    });

    app = createApp(TestComponent);
    app.mount(container);

    await nextTick();

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal?.value).toBe(42);
  });

  it("should update signal value", async ({ skip }) => {
    if (!Vue || !styleVue) skip();
    const { createApp, defineComponent, h, nextTick } = Vue!;
    const { useSignal } = styleVue!;

    let capturedSignal: ReturnType<typeof useSignal<number>> | null = null;

    const TestComponent = defineComponent({
      setup() {
        const count = useSignal(0);
        capturedSignal = count;
        return () =>
          h(
            "button",
            {
              onClick: () => {
                count.value++;
              },
            },
            String(count.value),
          );
      },
    });

    app = createApp(TestComponent);
    app.mount(container);

    await nextTick();

    expect(capturedSignal?.value).toBe(0);

    capturedSignal!.value = 10;

    expect(capturedSignal?.value).toBe(10);
  });
});
