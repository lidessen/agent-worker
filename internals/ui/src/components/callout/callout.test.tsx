/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Callout } from "./callout";
import { lightTheme } from "../../theme/themes";

describe("Callout", () => {
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

  it("renders callout with content", () => {
    render(<Callout>Important info</Callout>, container);
    expect(container.textContent).toContain("Important info");
  });

  it("renders with title", () => {
    render(<Callout title="Note">Content here</Callout>, container);
    expect(container.textContent).toContain("Note");
    expect(container.textContent).toContain("Content here");
  });

  it("has role=note for accessibility", () => {
    render(<Callout>Test</Callout>, container);
    const el = container.querySelector("[role='note']");
    expect(el).toBeTruthy();
  });

  // --- Types ---

  it("renders info type by default", () => {
    render(<Callout>Info</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("rgba(0, 122, 255");
  });

  it("renders warning type", () => {
    render(<Callout type="warning">Warning</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("rgba(255, 159, 10");
  });

  it("renders success type", () => {
    render(<Callout type="success">Success</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("rgba(52, 199, 89");
  });

  it("renders error type", () => {
    render(<Callout type="error">Error</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("rgba(255, 69, 58");
  });

  it("renders tip type", () => {
    render(<Callout type="tip">Tip</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toContain("rgba(175, 82, 222");
  });

  // --- Title icon ---

  it("shows icon in title", () => {
    render(
      <Callout type="info" title="Note">
        Content
      </Callout>,
      container,
    );
    const svg = container.querySelector("span svg");
    expect(svg).toBeTruthy();
    expect(svg!.tagName.toLowerCase()).toBe("svg");
  });

  // --- Custom class ---

  it("merges custom class", () => {
    render(<Callout class="my-callout">Test</Callout>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("class")).toContain("my-callout");
  });
});
