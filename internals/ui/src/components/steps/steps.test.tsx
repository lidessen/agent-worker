/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";
import { inject } from "@semajsx/style";
import { Steps, Step } from "./steps";
import { lightTheme } from "../../theme/themes";

describe("Steps", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    inject(lightTheme);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders step items", () => {
    render(
      <Steps>
        <Step title="First" number={1}>
          Do this first
        </Step>
        <Step title="Second" number={2}>
          Then this
        </Step>
      </Steps>,
      container,
    );

    const items = container.querySelectorAll("h4");
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toBe("First");
    expect(items[1]!.textContent).toBe("Second");
  });

  it("renders step numbers", () => {
    render(
      <Steps>
        <Step title="Install" number={1}>
          Install dependencies
        </Step>
        <Step title="Configure" number={2}>
          Set up config
        </Step>
      </Steps>,
      container,
    );

    const root = container.firstElementChild!;
    expect(root.textContent).toContain("1");
    expect(root.textContent).toContain("2");
  });

  it("renders step content", () => {
    render(
      <Steps>
        <Step title="Test" number={1}>
          <p>Some detailed instructions</p>
        </Step>
      </Steps>,
      container,
    );

    const p = container.querySelector("p");
    expect(p).toBeTruthy();
    expect(p!.textContent).toBe("Some detailed instructions");
  });

  it("supports custom class on Steps", () => {
    render(
      <Steps class="my-steps">
        <Step title="A" number={1}>
          Content
        </Step>
      </Steps>,
      container,
    );

    const root = container.firstElementChild!;
    expect(root.getAttribute("class")).toContain("my-steps");
  });

  it("renders without number when omitted", () => {
    render(
      <Steps>
        <Step title="No number">Content without number</Step>
      </Steps>,
      container,
    );

    const title = container.querySelector("h4");
    expect(title).toBeTruthy();
    expect(title!.textContent).toBe("No number");
  });
});
