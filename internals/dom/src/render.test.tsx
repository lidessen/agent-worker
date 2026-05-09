/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computed, signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";

describe("render", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render simple element", () => {
    const vnode = <div class="test">Hello</div>;
    render(vnode, container);

    expect(container.innerHTML).toContain('<div class="test">Hello</div>');
  });

  it("should render nested elements", () => {
    const vnode = (
      <div>
        <h1>Title</h1>
        <p>Content</p>
      </div>
    );
    render(vnode, container);

    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("p")?.textContent).toBe("Content");
  });

  it("should render signal as text", async () => {
    const count = signal(5);
    const vnode = <div>{count}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("5");

    count.value = 10;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("10");
  });

  it("should render computed signal", async () => {
    const count = signal(5);
    const doubled = computed([count], (c) => c * 2);
    const vnode = <div>{doubled}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("10");

    count.value = 10;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("20");
  });

  it("should render signal VNode", async () => {
    const show = signal(true);
    const content = computed([show], (s) => (s ? <p>Visible</p> : <p>Hidden</p>));
    const vnode = <div>{content}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("Visible");

    show.value = false;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("Hidden");
  });

  it("should handle signal props", async () => {
    const className = signal("initial");
    const vnode = <div class={className}>Test</div>;
    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.className).toBe("initial");

    className.value = "updated";
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(div?.className).toBe("updated");
  });

  it("should handle event handlers", () => {
    let clicked = false;
    const vnode = (
      <button
        onclick={() => {
          clicked = true;
        }}
      >
        Click me
      </button>
    );
    render(vnode, container);

    const button = container.querySelector("button");
    button?.click();

    expect(clicked).toBe(true);
  });

  it("should render components", () => {
    const Greeting = ({ name }: { name: string }) => {
      return <h1>Hello, {name}!</h1>;
    };

    const vnode = <Greeting name="World" />;
    render(vnode, container);

    expect(container.textContent).toBe("Hello, World!");
  });

  it("should render fragment", () => {
    const vnode = (
      <div>
        <span>One</span>
        <span>Two</span>
      </div>
    );
    render(vnode, container);

    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(2);
    expect(spans[0]?.textContent).toBe("One");
    expect(spans[1]?.textContent).toBe("Two");
  });

  it("should unmount and cleanup subscriptions", async () => {
    const count = signal(0);
    const vnode = <div>{count}</div>;
    const { unmount } = render(vnode, container);

    // Store reference to the div before unmount
    const div = container.querySelector("div");
    expect(div?.textContent).toContain("0");

    count.value = 5;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(div?.textContent).toContain("5");

    // Unmount removes the node from DOM
    unmount();
    expect(container.children.length).toBe(0);

    // After unmount, signal changes should not update (subscription cleaned up)
    count.value = 10;
    await new Promise((resolve) => queueMicrotask(resolve));

    // The original div should still show '5' since it's no longer subscribed
    expect(div?.textContent).toContain("5");
  });
});
