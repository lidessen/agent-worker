/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";
import { ForwardComponent } from "@semajsx/dom";
import { Forward, Context, context } from "@semajsx/core";
import type { ComponentAPI } from "@semajsx/core";

describe("Forward functionality", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should forward props to a child element", () => {
    const vnode = (
      <Forward class="extra" data-testid="forwarded">
        <button>Click me</button>
      </Forward>
    );

    render(vnode, container);

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.className).toBe("extra");
    expect(button?.getAttribute("data-testid")).toBe("forwarded");
    expect(button?.textContent).toBe("Click me");
  });

  it("should not produce an extra DOM node", () => {
    const vnode = (
      <div>
        <Forward class="forwarded">
          <span>Hello</span>
        </Forward>
      </div>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.children.length).toBe(1);
    expect(div?.children[0].tagName).toBe("SPAN");
    expect(div?.children[0].className).toBe("forwarded");
  });

  it("should merge class values (child + Forward)", () => {
    const vnode = (
      <Forward class="extra">
        <button class="btn">Click</button>
      </Forward>
    );

    render(vnode, container);

    const button = container.querySelector("button");
    // Both classes should be present
    expect(button?.className).toContain("btn");
    expect(button?.className).toContain("extra");
  });

  it("should merge style objects", () => {
    const vnode = (
      <Forward style={{ color: "red", fontWeight: "bold" }}>
        <div style={{ color: "blue", fontSize: "16px" }}>Styled</div>
      </Forward>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    // Forward's color overrides child's, but child's fontSize remains
    expect((div as HTMLElement)?.style.color).toBe("red");
    expect((div as HTMLElement)?.style.fontWeight).toBe("bold");
    expect((div as HTMLElement)?.style.fontSize).toBe("16px");
  });

  it("should chain event handlers", () => {
    const order: string[] = [];
    const forwardHandler = () => order.push("forward");
    const childHandler = () => order.push("child");

    const vnode = (
      <Forward onClick={forwardHandler}>
        <button onClick={childHandler}>Click</button>
      </Forward>
    );

    render(vnode, container);

    const button = container.querySelector("button");
    button?.click();

    // Forward handler runs first, then child's
    expect(order).toEqual(["forward", "child"]);
  });

  it("should forward event handlers to child without existing handler", () => {
    let clicked = false;
    const handler = () => {
      clicked = true;
    };

    const vnode = (
      <Forward onClick={handler}>
        <button>Click me</button>
      </Forward>
    );

    render(vnode, container);

    container.querySelector("button")?.click();
    expect(clicked).toBe(true);
  });

  it("should work with ForwardComponent", () => {
    const vnode = (
      <ForwardComponent class="forwarded" data-role="main">
        <div>Content</div>
      </ForwardComponent>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.className).toBe("forwarded");
    expect(div?.getAttribute("data-role")).toBe("main");
  });

  it("should forward ref to child element", () => {
    const buttonRef = signal<HTMLButtonElement | null>(null);

    const vnode = (
      <Forward ref={buttonRef}>
        <button>Ref button</button>
      </Forward>
    );

    render(vnode, container);

    expect(buttonRef.value).toBeInstanceOf(HTMLButtonElement);
    expect(buttonRef.value?.textContent).toBe("Ref button");
  });

  it("should support reactive signal props", async () => {
    const color = signal("red");

    const vnode = (
      <Forward data-color={color}>
        <div>Reactive</div>
      </Forward>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.getAttribute("data-color")).toBe("red");

    color.value = "blue";
    await new Promise((r) => setTimeout(r, 0));
    expect(div?.getAttribute("data-color")).toBe("blue");
  });

  it("should forward props to a component", () => {
    function Card(props: { class?: string; title?: string; children?: unknown }) {
      return (
        <div class={props.class}>
          <h2>{props.title}</h2>
          {props.children}
        </div>
      );
    }

    const vnode = (
      <Forward class="card-extra" title="Forwarded Title">
        <Card>
          <p>Card body</p>
        </Card>
      </Forward>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.className).toBe("card-extra");
    expect(container.querySelector("h2")?.textContent).toBe("Forwarded Title");
  });

  it("should work with nested Forwards", () => {
    const vnode = (
      <Forward class="outer" data-outer="true">
        <Forward class="inner" data-inner="true">
          <button>Nested</button>
        </Forward>
      </Forward>
    );

    render(vnode, container);

    const button = container.querySelector("button");
    expect(button?.className).toContain("outer");
    expect(button?.className).toContain("inner");
    expect(button?.getAttribute("data-outer")).toBe("true");
    expect(button?.getAttribute("data-inner")).toBe("true");
  });

  it("should propagate context through Forward", () => {
    const ThemeContext = context<string>("theme");

    function ThemedButton(_props: Record<string, never>, ctx?: ComponentAPI) {
      const theme = ctx!.inject(ThemeContext);
      return <button class={`theme-${theme}`}>{theme}</button>;
    }

    const vnode = (
      <Context provide={[ThemeContext, "dark"]}>
        <Forward data-forwarded="true">
          <ThemedButton />
        </Forward>
      </Context>
    );

    render(vnode, container);

    const button = container.querySelector("button");
    expect(button?.className).toBe("theme-dark");
    expect(button?.textContent).toBe("dark");
  });

  it("should throw if Forward has zero children", () => {
    const vnode = <Forward class="extra" />;

    expect(() => render(vnode, container)).toThrow("Forward must have exactly one child element");
  });

  it("should throw if Forward has multiple children", () => {
    const vnode = (
      <Forward class="extra">
        <span>One</span>
        <span>Two</span>
      </Forward>
    );

    expect(() => render(vnode, container)).toThrow("Forward must have exactly one child element");
  });

  it("should work inside a parent element", () => {
    const vnode = (
      <ul>
        <Forward class="active">
          <li>Item 1</li>
        </Forward>
        <li>Item 2</li>
      </ul>
    );

    render(vnode, container);

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].className).toBe("active");
    expect(items[0].textContent).toBe("Item 1");
    expect(items[1].className).toBe("");
    expect(items[1].textContent).toBe("Item 2");
  });

  it("should clean up on unmount", async () => {
    const count = signal(0);

    const vnode = (
      <Forward data-count={count}>
        <div>Content</div>
      </Forward>
    );

    const { unmount } = render(vnode, container);

    expect(container.querySelector("div")?.getAttribute("data-count")).toBe("0");

    unmount();

    // After unmount, signal updates should not cause errors
    count.value = 1;
    await new Promise((r) => setTimeout(r, 0));
  });

  it("should override non-class/style/event props", () => {
    const vnode = (
      <Forward id="forwarded-id" title="forwarded">
        <div id="original-id" title="original">
          Content
        </div>
      </Forward>
    );

    render(vnode, container);

    const div = container.querySelector("div");
    expect(div?.id).toBe("forwarded-id");
    expect(div?.title).toBe("forwarded");
  });
});
