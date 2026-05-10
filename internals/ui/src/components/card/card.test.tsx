/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Card } from "./card";
import { lightTheme } from "../../theme/themes";

describe("Card", () => {
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

  it("renders a div by default (feature variant)", () => {
    render(<Card heading="Title" />, container);
    const card = container.querySelector("div > div");
    expect(card).toBeTruthy();
  });

  it("renders heading text", () => {
    render(<Card heading="My Card" />, container);
    const h3 = container.querySelector("h3");
    expect(h3).toBeTruthy();
    expect(h3!.textContent).toBe("My Card");
  });

  it("renders description text", () => {
    render(<Card description="Some description" />, container);
    const p = container.querySelector("p");
    expect(p).toBeTruthy();
    expect(p!.textContent).toBe("Some description");
  });

  it("renders icon slot", () => {
    render(<Card icon="⚡" heading="Fast" />, container);
    expect(container.textContent).toContain("⚡");
  });

  it("renders children content", () => {
    render(
      <Card heading="Title">
        <span>Custom content</span>
      </Card>,
      container,
    );
    expect(container.querySelector("span")!.textContent).toBe("Custom content");
  });

  // --- Variants ---

  it("renders as anchor for link variant", () => {
    render(<Card variant="link" heading="Link" href="/docs" />, container);
    const a = container.querySelector("a");
    expect(a).toBeTruthy();
    expect(a!.getAttribute("href")).toBe("/docs");
  });

  it("renders as div for feature variant", () => {
    render(<Card variant="feature" heading="Feature" />, container);
    const a = container.querySelector("a");
    expect(a).toBeNull();
  });

  // --- Custom class ---

  it("merges custom class", () => {
    render(<Card class="my-card" heading="Test" />, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("class")).toContain("my-card");
  });
});
