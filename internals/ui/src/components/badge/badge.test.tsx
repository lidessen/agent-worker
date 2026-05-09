/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Badge } from "./badge";
import { lightTheme } from "../../theme/themes";

describe("Badge", () => {
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

  it("renders a span element", () => {
    render(<Badge>Label</Badge>, container);
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe("Label");
  });

  // --- Colors ---

  it("applies default color", () => {
    render(<Badge>Default</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(0, 0, 0, 0.06)");
  });

  it("applies success color", () => {
    render(<Badge color="success">Beginner</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(52, 199, 89");
    expect(span.getAttribute("style")).toContain("rgb(36, 138, 61)");
  });

  it("applies warning color", () => {
    render(<Badge color="warning">Intermediate</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(255, 159, 10");
  });

  it("applies danger color", () => {
    render(<Badge color="danger">Advanced</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(255, 69, 58");
  });

  it("applies info color", () => {
    render(<Badge color="info">Info</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(0, 122, 255");
  });

  it("applies tip color", () => {
    render(<Badge color="tip">Tip</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("style")).toContain("rgba(175, 82, 222");
  });

  // --- Custom class ---

  it("merges custom class", () => {
    render(<Badge class="my-badge">Test</Badge>, container);
    const span = container.querySelector("span")!;
    expect(span.getAttribute("class")).toContain("my-badge");
  });
});
