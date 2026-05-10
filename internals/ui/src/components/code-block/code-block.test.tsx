/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { CodeBlock, InlineCode } from "./code-block";
import { lightTheme } from "../../theme/themes";

describe("CodeBlock", () => {
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

  it("renders a pre > code element", () => {
    render(<CodeBlock>{"const x = 1;"}</CodeBlock>, container);
    const pre = container.querySelector("pre");
    const code = container.querySelector("code");
    expect(pre).toBeTruthy();
    expect(code).toBeTruthy();
    expect(code!.textContent).toBe("const x = 1;");
  });

  it("renders language header when language is provided", () => {
    render(<CodeBlock language="tsx">{"<App />"}</CodeBlock>, container);
    expect(container.textContent).toContain("tsx");
  });

  it("does not render header when no language", () => {
    render(<CodeBlock>{"code"}</CodeBlock>, container);
    // Should only have the wrapper div and pre, not the header
    const divs = container.querySelectorAll("div");
    // root div + container = 2, if header existed it would be 3
    expect(divs.length).toBeLessThanOrEqual(2);
  });

  // --- Custom class ---

  it("merges custom class", () => {
    render(<CodeBlock class="my-code">{"test"}</CodeBlock>, container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("class")).toContain("my-code");
  });
});

describe("InlineCode", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    inject(lightTheme);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a code element", () => {
    render(<InlineCode>signal()</InlineCode>, container);
    const code = container.querySelector("code");
    expect(code).toBeTruthy();
    expect(code!.textContent).toBe("signal()");
  });

  it("merges custom class", () => {
    render(<InlineCode class="my-inline">test</InlineCode>, container);
    const code = container.querySelector("code")!;
    expect(code.getAttribute("class")).toContain("my-inline");
  });
});
