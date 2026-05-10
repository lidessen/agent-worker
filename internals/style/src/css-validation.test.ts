/**
 * CSS validation tests using lightningcss
 *
 * These tests verify that the generated CSS is syntactically valid
 * and works correctly with complex CSS features.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { signal } from "@semajsx/signal";
import { classes } from "./classes";
import { rule, rules } from "./rule";

// Dynamic import for lightningcss (native module)
let transform: typeof import("lightningcss").transform | null = null;

beforeAll(async () => {
  try {
    const lightningcss = await import("lightningcss");
    transform = lightningcss.transform;
  } catch {
    // lightningcss not available (e.g., browser environment)
  }
});

/**
 * Validate CSS syntax using lightningcss
 */
function validateCSS(css: string): { valid: boolean; error?: string } {
  if (!transform) {
    // Skip validation if lightningcss is not available
    return { valid: true };
  }
  try {
    transform({
      filename: "test.css",
      code: Buffer.from(css),
      minify: false,
    });
    return { valid: true };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

/**
 * Replace signal placeholders with var() for validation
 */
function resolveCSS(cssTemplate: string, bindingCount: number): string {
  let css = cssTemplate;
  for (let i = 0; i < bindingCount; i++) {
    css = css.replace(`{{${i}}}`, `var(--sig-${i})`);
  }
  return css;
}

describe("CSS Validation", () => {
  describe("Basic rules", () => {
    it("should generate valid CSS for simple properties", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["box"]);
      const token = rule`${c.box} { padding: 8px; margin: 16px; }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for multiple properties", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["card"]);
      const token = rule`${c.card} {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });
  });

  describe("Signal bindings with var()", () => {
    it("should generate valid CSS with single signal binding", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["box"]);
      const height = signal("100px");
      const token = rule`${c.box} { height: ${height}; }`;

      const css = resolveCSS(token.__cssTemplate, 1);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with multiple signal bindings", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["box"]);
      const width = signal("200px");
      const height = signal("100px");
      const bg = signal("#ff0000");
      const token = rule`${c.box} {
        width: ${width};
        height: ${height};
        background-color: ${bg};
      }`;

      const css = resolveCSS(token.__cssTemplate, 3);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });
  });

  describe("Complex CSS features", () => {
    it("should generate valid CSS with calc()", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["container"]);
      const sidebarWidth = signal("250px");
      const token = rule`${c.container} {
        width: calc(100% - ${sidebarWidth});
        min-height: calc(100vh - 60px);
      }`;

      const css = resolveCSS(token.__cssTemplate, 1);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with nested calc()", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["grid"]);
      const gap = signal("16px");
      const columns = signal("3");
      const token = rule`${c.grid} {
        display: grid;
        gap: ${gap};
        grid-template-columns: repeat(${columns}, 1fr);
      }`;

      const css = resolveCSS(token.__cssTemplate, 2);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with transform", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["animated"]);
      const scale = signal("1.2");
      const rotation = signal("45deg");
      const token = rule`${c.animated} {
        transform: scale(${scale}) rotate(${rotation});
        transition: transform 0.3s ease;
      }`;

      const css = resolveCSS(token.__cssTemplate, 2);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with gradients", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["gradient"]);
      const startColor = signal("#ff0000");
      const endColor = signal("#0000ff");
      const token = rule`${c.gradient} {
        background: linear-gradient(135deg, ${startColor}, ${endColor});
      }`;

      const css = resolveCSS(token.__cssTemplate, 2);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with clamp()", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["responsive"]);
      const minSize = signal("14px");
      const maxSize = signal("24px");
      const token = rule`${c.responsive} {
        font-size: clamp(${minSize}, 2vw + 1rem, ${maxSize});
      }`;

      const css = resolveCSS(token.__cssTemplate, 2);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with filter", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["blurred"]);
      const blur = signal("4px");
      const brightness = signal("1.2");
      const token = rule`${c.blurred} {
        filter: blur(${blur}) brightness(${brightness});
      }`;

      const css = resolveCSS(token.__cssTemplate, 2);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });
  });

  describe("Selectors", () => {
    it("should generate valid CSS for pseudo-classes", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["button"]);
      const hoverBg = signal("#0066cc");
      const token = rule`${c.button}:hover {
        background-color: ${hoverBg};
        cursor: pointer;
      }`;

      const css = resolveCSS(token.__cssTemplate, 1);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for pseudo-elements", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["decorated"]);
      const token = rule`${c.decorated}::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for combinators", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["list", "item"]);
      const token = rule`${c.list} > ${c.item}:not(:last-child) {
        margin-bottom: 8px;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for attribute selectors", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["input"]);
      const token = rule`${c.input}[type="text"]:focus {
        outline: 2px solid blue;
        outline-offset: 2px;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for :has() selector", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["parent", "child"]);
      const token = rule`${c.parent}:has(${c.child}:hover) {
        background-color: #f0f0f0;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });
  });

  describe("Combined rules", () => {
    it("should generate valid CSS for combined tokens", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["btn"]);
      const bgColor = signal("#0066cc");
      const hoverBg = signal("#0055aa");

      const combined = rules(
        rule`${c.btn} {
          padding: 8px 16px;
          background-color: ${bgColor};
          border: none;
          border-radius: 4px;
        }`,
        rule`${c.btn}:hover {
          background-color: ${hoverBg};
        }`,
        rule`${c.btn}:active {
          transform: scale(0.98);
        }`,
        rule`${c.btn}:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }`,
      );

      // Note: rules() adjusts indices by tokenIndex * 100, so we need more placeholders
      let css = combined.__cssTemplate;
      for (const def of combined.__bindingDefs || []) {
        css = css.replace(`{{${def.index}}}`, `var(--sig-${def.index})`);
      }
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should generate valid CSS with custom properties", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["themed"]);
      const primary = signal("var(--theme-primary, #0066cc)");
      const token = rule`${c.themed} {
        color: ${primary};
        --local-spacing: 16px;
        padding: var(--local-spacing);
      }`;

      const css = resolveCSS(token.__cssTemplate, 1);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with !important", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["override"]);
      const token = rule`${c.override} {
        color: red !important;
        display: block !important;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with unicode content", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["icon"]);
      const token = rule`${c.icon}::before {
        content: "\\2713";
        font-family: sans-serif;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with complex box-shadow", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["elevated"]);
      const shadowColor = signal("rgba(0, 0, 0, 0.2)");
      const token = rule`${c.elevated} {
        box-shadow:
          0 1px 3px ${shadowColor},
          0 4px 6px ${shadowColor},
          0 10px 20px ${shadowColor};
      }`;

      const css = resolveCSS(token.__cssTemplate, 3);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS with animation", ({ skip }) => {
      if (!transform) skip();
      const c = classes(["pulse"]);
      const duration = signal("2s");
      const token = rule`${c.pulse} {
        animation: pulse ${duration} ease-in-out infinite;
      }`;

      const css = resolveCSS(token.__cssTemplate, 1);
      const result = validateCSS(css);
      expect(result.valid).toBe(true);
    });
  });

  describe("Global selectors", () => {
    it("should generate valid CSS for body selector", ({ skip }) => {
      if (!transform) skip();
      const token = rule`body {
        margin: 0;
        padding: 0;
        font-family: system-ui, sans-serif;
        line-height: 1.5;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });

    it("should generate valid CSS for universal selector", ({ skip }) => {
      if (!transform) skip();
      const token = rule`*, *::before, *::after {
        box-sizing: border-box;
      }`;

      const result = validateCSS(token.__cssTemplate);
      expect(result.valid).toBe(true);
    });
  });
});
