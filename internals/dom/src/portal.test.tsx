/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";
import { createPortal, PortalComponent } from "@semajsx/dom";
import { Context, context, when } from "@semajsx/core";
import type { ComponentAPI } from "@semajsx/core";

describe("Portal functionality", () => {
  let container: HTMLDivElement;
  let portalTarget: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "container";
    document.body.appendChild(container);

    portalTarget = document.createElement("div");
    portalTarget.id = "portal-target";
    document.body.appendChild(portalTarget);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(portalTarget);
  });

  it("should render children to portal target using createPortal", () => {
    const vnode = (
      <div>
        <p>Main content</p>
        {createPortal(<div>Portal content</div>, portalTarget)}
      </div>
    );

    render(vnode, container);

    // Main content should be in container
    expect(container.textContent).toContain("Main content");
    expect(container.textContent).not.toContain("Portal content");

    // Portal content should be in portal target
    expect(portalTarget.textContent).toContain("Portal content");
  });

  it("should render children to portal target using PortalComponent", () => {
    const vnode = (
      <div>
        <p>Main content</p>
        <PortalComponent container={portalTarget}>
          <div>Portal content</div>
        </PortalComponent>
      </div>
    );

    render(vnode, container);

    expect(container.textContent).toContain("Main content");
    expect(container.textContent).not.toContain("Portal content");
    expect(portalTarget.textContent).toContain("Portal content");
  });

  it("should support multiple portals to different targets", () => {
    const target1 = document.createElement("div");
    const target2 = document.createElement("div");
    document.body.appendChild(target1);
    document.body.appendChild(target2);

    const vnode = (
      <div>
        {createPortal(<div>Portal 1</div>, target1)}
        {createPortal(<div>Portal 2</div>, target2)}
      </div>
    );

    render(vnode, container);

    expect(target1.textContent).toBe("Portal 1");
    expect(target2.textContent).toBe("Portal 2");

    document.body.removeChild(target1);
    document.body.removeChild(target2);
  });

  it("should support reactive content in portals", async () => {
    const count = signal(0);
    const vnode = (
      <div>
        <p>Main</p>
        {createPortal(<div>Count: {count}</div>, portalTarget)}
      </div>
    );

    render(vnode, container);

    expect(portalTarget.textContent).toBe("Count: 0");

    count.value = 5;
    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(portalTarget.textContent).toBe("Count: 5");
  });

  it("should clean up portal content on unmount", () => {
    const vnode = createPortal(<div className="portal-content">Portal</div>, portalTarget);

    const { unmount } = render(vnode, container);

    expect(portalTarget.querySelector(".portal-content")).toBeTruthy();

    unmount();

    expect(portalTarget.querySelector(".portal-content")).toBeFalsy();
  });

  it("should handle nested elements in portal", () => {
    const vnode = createPortal(
      <div className="modal">
        <h1>Modal Title</h1>
        <p>Modal content</p>
        <button>Close</button>
      </div>,
      portalTarget,
    );

    render(vnode, container);

    const modal = portalTarget.querySelector(".modal");
    expect(modal).toBeTruthy();
    expect(modal?.querySelector("h1")?.textContent).toBe("Modal Title");
    expect(modal?.querySelector("p")?.textContent).toBe("Modal content");
    expect(modal?.querySelector("button")?.textContent).toBe("Close");
  });

  it("should support event handlers in portaled content", () => {
    let clicked = false;
    const handleClick = () => {
      clicked = true;
    };

    const vnode = createPortal(<button onClick={handleClick}>Click me</button>, portalTarget);

    render(vnode, container);

    const button = portalTarget.querySelector("button");
    expect(button).toBeTruthy();

    button?.click();
    expect(clicked).toBe(true);
  });

  it("should work with refs in portaled content", () => {
    const buttonRef = signal<HTMLButtonElement | null>(null);
    const vnode = createPortal(<button ref={buttonRef}>Portal button</button>, portalTarget);

    render(vnode, container);

    expect(buttonRef.value).toBeInstanceOf(HTMLButtonElement);
    expect(buttonRef.value?.textContent).toBe("Portal button");
    expect(buttonRef.value?.parentElement).toBe(portalTarget);
  });

  it("should propagate context through portals", () => {
    const ThemeContext = context<string>("theme");

    function ThemedButton(_props: Record<string, never>, ctx?: ComponentAPI) {
      const theme = ctx!.inject(ThemeContext);
      return <button className={`theme-${theme}`}>{theme}</button>;
    }

    const vnode = (
      <Context provide={[ThemeContext, "dark"]}>
        <div>
          <p>Main</p>
          {createPortal(<ThemedButton />, portalTarget)}
        </div>
      </Context>
    );

    render(vnode, container);

    const button = portalTarget.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.className).toBe("theme-dark");
    expect(button?.textContent).toBe("dark");
  });

  it("should render portal inside conditional (when)", async () => {
    const show = signal(false);
    const portal = when(show, () => createPortal(<div className="modal">Modal</div>, portalTarget));

    const vnode = (
      <div>
        <p>Main</p>
        {portal}
      </div>
    );

    render(vnode, container);

    // Portal should not be rendered initially
    expect(portalTarget.querySelector(".modal")).toBeFalsy();

    // Show portal
    show.value = true;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(portalTarget.querySelector(".modal")).toBeTruthy();
    expect(portalTarget.textContent).toBe("Modal");

    // Hide portal
    show.value = false;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(portalTarget.querySelector(".modal")).toBeFalsy();
  });

  it("should support nested portals", () => {
    const innerTarget = document.createElement("div");
    document.body.appendChild(innerTarget);

    const vnode = (
      <div>
        {createPortal(
          <div className="outer">
            Outer
            {createPortal(<div className="inner">Inner</div>, innerTarget)}
          </div>,
          portalTarget,
        )}
      </div>
    );

    render(vnode, container);

    // Outer portal content in portalTarget
    expect(portalTarget.querySelector(".outer")).toBeTruthy();
    expect(portalTarget.textContent).toContain("Outer");
    expect(portalTarget.textContent).not.toContain("Inner");

    // Inner portal content in innerTarget
    expect(innerTarget.querySelector(".inner")).toBeTruthy();
    expect(innerTarget.textContent).toBe("Inner");

    document.body.removeChild(innerTarget);
  });

  it("should support multiple children without wrapper in portal", () => {
    const vnode = createPortal(
      <>
        <p>First</p>
        <p>Second</p>
        <p>Third</p>
      </>,
      portalTarget,
    );

    render(vnode, container);

    const paragraphs = portalTarget.querySelectorAll("p");
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0].textContent).toBe("First");
    expect(paragraphs[1].textContent).toBe("Second");
    expect(paragraphs[2].textContent).toBe("Third");
  });

  it("should clean up signal subscriptions in portaled content on unmount", async () => {
    const count = signal(0);
    const vnode = createPortal(<div>Count: {count}</div>, portalTarget);

    const { unmount } = render(vnode, container);

    expect(portalTarget.textContent).toBe("Count: 0");

    count.value = 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(portalTarget.textContent).toBe("Count: 1");

    unmount();

    // Portal content removed
    expect(portalTarget.textContent).toBe("");

    // Signal updates after unmount should not cause errors
    count.value = 2;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(portalTarget.textContent).toBe("");
  });

  it("should support component children in portal", () => {
    function Card(props: { title: string; children?: unknown }) {
      return (
        <div className="card">
          <h2>{props.title}</h2>
          <div className="card-body">{props.children}</div>
        </div>
      );
    }

    const vnode = createPortal(
      <Card title="Portal Card">
        <p>Card content</p>
      </Card>,
      portalTarget,
    );

    render(vnode, container);

    const card = portalTarget.querySelector(".card");
    expect(card).toBeTruthy();
    expect(card?.querySelector("h2")?.textContent).toBe("Portal Card");
    expect(card?.querySelector(".card-body p")?.textContent).toBe("Card content");
  });

  it("should not affect parent container DOM when portal content changes", async () => {
    const text = signal("initial");
    const vnode = (
      <div className="parent">
        <span>Static</span>
        {createPortal(<div>{text}</div>, portalTarget)}
      </div>
    );

    render(vnode, container);

    const parent = container.querySelector(".parent");
    expect(parent?.childNodes.length).toBe(1); // Only <span>
    expect(parent?.textContent).toBe("Static");

    text.value = "updated";
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Parent should not be affected
    expect(parent?.childNodes.length).toBe(1);
    expect(parent?.textContent).toBe("Static");
    expect(portalTarget.textContent).toBe("updated");
  });
});
