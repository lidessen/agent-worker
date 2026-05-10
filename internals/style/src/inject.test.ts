import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { classes } from "./classes";
import { rule } from "./rule";
import { inject, injectStyles, preload } from "./inject";

describe("injectStyles", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should inject CSS into the target", () => {
    injectStyles(".test { color: red; }", container);

    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain(".test { color: red; }");
  });

  it("should inject into document.head by default", () => {
    const initialCount = document.head.querySelectorAll("style").length;

    injectStyles(".test-head { color: blue; }");

    // May reuse a shared element or create a new one
    const styleEls = document.head.querySelectorAll("style[data-semajsx]");
    expect(styleEls.length).toBeGreaterThanOrEqual(1);

    // Content should be present
    const allContent = Array.from(styleEls)
      .map((s) => s.textContent)
      .join("");
    expect(allContent).toContain(".test-head { color: blue; }");
  });

  it("should be synchronous — CSS readable immediately after injection", () => {
    injectStyles(".sync-test { display: none; }", container);
    const styleEl = container.querySelector("style");
    // Content must be readable immediately, not deferred
    expect(styleEl?.textContent).toContain(".sync-test { display: none; }");
  });
});

describe("inject", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should inject a single StyleToken", () => {
    const c = classes(["btn"]);
    const token = rule`${c.btn} { padding: 8px; }`;

    inject(token, { target: container });

    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain("padding: 8px");
  });

  it("should inject an array of StyleTokens into shared element", () => {
    const c = classes(["btn", "icon"]);
    const btnToken = rule`${c.btn} { padding: 8px; }`;
    const iconToken = rule`${c.icon} { width: 16px; }`;

    inject([btnToken, iconToken], { target: container });

    // All rules in one shared <style> element
    const styleEls = container.querySelectorAll("style");
    expect(styleEls.length).toBe(1);
    expect(styleEls[0]?.textContent).toContain("padding: 8px");
    expect(styleEls[0]?.textContent).toContain("width: 16px");
  });

  it("should inject an object of StyleTokens into shared element", () => {
    const c = classes(["btn", "icon"]);
    const styles = {
      btn: rule`${c.btn} { padding: 8px; }`,
      icon: rule`${c.icon} { width: 16px; }`,
    };

    inject(styles, { target: container });

    const styleEls = container.querySelectorAll("style");
    expect(styleEls.length).toBe(1);
    expect(styleEls[0]?.textContent).toContain("padding: 8px");
    expect(styleEls[0]?.textContent).toContain("width: 16px");
  });

  it("should deduplicate by className", () => {
    const c = classes(["btn"]);
    const token = rule`${c.btn} { padding: 8px; }`;

    inject(token, { target: container });
    inject(token, { target: container });
    inject(token, { target: container });

    const styleEls = container.querySelectorAll("style");
    expect(styleEls.length).toBe(1);
    // CSS should appear only once despite 3 inject calls
    const content = styleEls[0]?.textContent ?? "";
    const matches = content.match(/padding: 8px/g);
    expect(matches?.length).toBe(1);
  });

  it("should return a working cleanup function", () => {
    const c = classes(["cleanup-test"]);
    const token = rule`${c["cleanup-test"]} { margin: 4px; }`;

    const cleanup = inject(token, { target: container });

    // CSS is present
    expect(container.querySelector("style")?.textContent).toContain("margin: 4px");

    // After cleanup, CSS is removed
    cleanup();
    const content = container.querySelector("style")?.textContent ?? "";
    expect(content).not.toContain("margin: 4px");
  });

  it("should not remove CSS while other callers still reference it", () => {
    const c = classes(["refcount"]);
    const token = rule`${c.refcount} { opacity: 0.5; }`;

    const cleanupA = inject(token, { target: container });
    const cleanupB = inject(token, { target: container });

    // CSS present
    expect(container.querySelector("style")?.textContent).toContain("opacity: 0.5");

    // First cleanup — CSS should stay (still referenced by B)
    cleanupA();
    expect(container.querySelector("style")?.textContent).toContain("opacity: 0.5");

    // Second cleanup — now CSS should be removed
    cleanupB();
    const content = container.querySelector("style")?.textContent ?? "";
    expect(content).not.toContain("opacity: 0.5");
  });

  it("should allow re-injection after all references are cleaned up", () => {
    const c = classes(["reinject"]);
    const token = rule`${c.reinject} { z-index: 99; }`;

    const cleanup1 = inject(token, { target: container });
    cleanup1();

    // CSS removed
    expect(container.querySelector("style")?.textContent ?? "").not.toContain("z-index: 99");

    // Re-inject should work (key is released)
    inject(token, { target: container });
    expect(container.querySelector("style")?.textContent).toContain("z-index: 99");
  });

  it("cleanup should be idempotent", () => {
    const c = classes(["idempotent"]);
    const token = rule`${c.idempotent} { font-size: 12px; }`;

    const cleanupA = inject(token, { target: container });
    const cleanupB = inject(token, { target: container });

    // Double-calling cleanupA should not decrement twice
    cleanupA();
    cleanupA(); // idempotent — no effect
    expect(container.querySelector("style")?.textContent).toContain("font-size: 12px");

    cleanupB();
    expect(container.querySelector("style")?.textContent ?? "").not.toContain("font-size: 12px");
  });

  it("should handle style element being removed externally", () => {
    const c = classes(["resilience"]);
    const token1 = rule`${c.resilience} { color: red; }`;

    inject(token1, { target: container });
    expect(container.querySelector("style")?.textContent).toContain("color: red");

    // Simulate external removal (HMR, test teardown)
    container.querySelector("style")?.remove();

    // Re-inject should recreate the element
    const c2 = classes(["resilience2"]);
    const token2 = rule`${c2.resilience2} { color: blue; }`;
    inject(token2, { target: container });

    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain("color: blue");
  });
});

describe("preload", () => {
  it("should preload multiple style objects", () => {
    const c1 = classes(["preload-a"]);
    const c2 = classes(["preload-b"]);
    const styles1 = { a: rule`${c1["preload-a"]} { color: red; }` };
    const styles2 = { b: rule`${c2["preload-b"]} { color: blue; }` };

    preload(styles1, styles2);

    // All preloaded rules should be in the shared element
    const styleEls = document.head.querySelectorAll("style[data-semajsx]");
    expect(styleEls.length).toBeGreaterThanOrEqual(1);
    const allContent = Array.from(styleEls)
      .map((s) => s.textContent)
      .join("");
    expect(allContent).toContain("color: red");
    expect(allContent).toContain("color: blue");
  });
});
