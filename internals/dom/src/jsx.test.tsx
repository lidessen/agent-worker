/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computed, signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";

describe("JSX integration", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render JSX element", () => {
    const vnode = <div class="test">Hello JSX</div>;
    render(vnode, container);

    expect(container.innerHTML).toContain('<div class="test">Hello JSX</div>');
  });

  it("should render JSX with signal", async () => {
    const count = signal(42);
    const vnode = <div>Count: {count}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("Count: 42");

    count.value = 100;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("Count: 100");
  });

  it("should render JSX component", () => {
    function Greeting({ name }: { name: string }) {
      return <h1>Hello, {name}!</h1>;
    }

    const vnode = <Greeting name="Vitest" />;
    render(vnode, container);

    expect(container.textContent).toBe("Hello, Vitest!");
  });

  it("should render JSX with computed", async () => {
    const count = signal(5);
    const doubled = computed([count], (c) => c * 2);

    const vnode = (
      <div>
        <p>Count: {count}</p>
        <p>Doubled: {doubled}</p>
      </div>
    );
    render(vnode, container);

    expect(container.textContent).toContain("Count: 5");
    expect(container.textContent).toContain("Doubled: 10");

    count.value = 10;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("Count: 10");
    expect(container.textContent).toContain("Doubled: 20");
  });

  it("should render conditional JSX", async () => {
    const show = signal(true);
    const content = computed([show], (s) => (s ? <p>Visible</p> : <p>Hidden</p>));

    const vnode = <div>{content}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("Visible");

    show.value = false;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("Hidden");
  });

  it("should handle nested components", () => {
    function Button({ label }: { label: string }) {
      return <button>{label}</button>;
    }

    function Panel({ title }: { title: string }) {
      return (
        <div class="panel">
          <h2>{title}</h2>
          <Button label="Click me" />
        </div>
      );
    }

    const vnode = <Panel title="My Panel" />;
    render(vnode, container);

    expect(container.querySelector("h2")?.textContent).toBe("My Panel");
    expect(container.querySelector("button")?.textContent).toBe("Click me");
  });
});
