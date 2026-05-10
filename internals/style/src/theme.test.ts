import { describe, it, expect } from "vitest";
import { defineTokens, createTheme, isTokenRef } from "./theme";
import { isStyleToken } from "./rule";

describe("defineTokens", () => {
  it("creates token refs with CSS variable names", () => {
    const tokens = defineTokens({
      colors: {
        primary: "#3b82f6",
        secondary: "#6b7280",
      },
    });

    expect(tokens.colors.primary.varName).toBe("--colors-primary");
    expect(tokens.colors.secondary.varName).toBe("--colors-secondary");
  });

  it("stringifies to var() expression", () => {
    const tokens = defineTokens({
      space: {
        sm: "0.5rem",
        md: "1rem",
      },
    });

    expect(tokens.space.sm.toString()).toBe("var(--space-sm)");
    expect(tokens.space.md.toString()).toBe("var(--space-md)");
    expect(`padding: ${tokens.space.md}`).toBe("padding: var(--space-md)");
  });

  it("preserves default values", () => {
    const tokens = defineTokens({
      radii: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
    });

    expect(tokens.radii.sm.defaultValue).toBe("4px");
    expect(tokens.radii.md.defaultValue).toBe("8px");
    expect(tokens.radii.lg.defaultValue).toBe("12px");
  });

  it("handles flat token definitions", () => {
    const tokens = defineTokens({
      primary: "#3b82f6",
      background: "#ffffff",
    });

    expect(tokens.primary.varName).toBe("--primary");
    expect(tokens.background.toString()).toBe("var(--background)");
  });

  it("handles deeply nested tokens", () => {
    const tokens = defineTokens({
      colors: {
        brand: {
          primary: "#3b82f6",
          secondary: "#6b7280",
        },
      },
    });

    expect(tokens.colors.brand.primary.varName).toBe("--colors-brand-primary");
    expect(tokens.colors.brand.primary.toString()).toBe("var(--colors-brand-primary)");
  });
});

describe("isTokenRef", () => {
  it("returns true for token refs", () => {
    const tokens = defineTokens({
      primary: "#3b82f6",
    });

    expect(isTokenRef(tokens.primary)).toBe(true);
  });

  it("returns false for non-token values", () => {
    expect(isTokenRef(null)).toBe(false);
    expect(isTokenRef(undefined)).toBe(false);
    expect(isTokenRef("string")).toBe(false);
    expect(isTokenRef(42)).toBe(false);
    expect(isTokenRef({})).toBe(false);
  });
});

describe("createTheme", () => {
  const tokens = defineTokens({
    colors: {
      primary: "#3b82f6",
      background: "#ffffff",
      text: "#1f2937",
    },
    space: {
      sm: "0.5rem",
      md: "1rem",
    },
  });

  it("creates default theme with :root selector", () => {
    const theme = createTheme(tokens);

    expect(isStyleToken(theme)).toBe(true);
    expect(theme._).toBeUndefined();
    expect(theme.__cssTemplate).toContain(":root");
    expect(theme.__cssTemplate).toContain("--colors-primary: #3b82f6");
    expect(theme.__cssTemplate).toContain("--colors-background: #ffffff");
    expect(theme.__cssTemplate).toContain("--colors-text: #1f2937");
    expect(theme.__cssTemplate).toContain("--space-sm: 0.5rem");
    expect(theme.__cssTemplate).toContain("--space-md: 1rem");
  });

  it("creates override theme with scoped class", () => {
    const dark = createTheme(tokens, {
      colors: {
        primary: "#60a5fa",
        background: "#1a1a2e",
        text: "#f0f0f0",
      },
    });

    expect(isStyleToken(dark)).toBe(true);
    expect(dark._).toBeDefined();
    expect(dark._).toMatch(/^theme-/);
    expect(dark.__cssTemplate).toContain("--colors-primary: #60a5fa");
    expect(dark.__cssTemplate).toContain("--colors-background: #1a1a2e");
    expect(dark.__cssTemplate).toContain("--colors-text: #f0f0f0");
    // Should NOT contain non-overridden values
    expect(dark.__cssTemplate).not.toContain("--space-sm");
    expect(dark.__cssTemplate).not.toContain("--space-md");
  });

  it("override theme stringifies to class name", () => {
    const dark = createTheme(tokens, {
      colors: { primary: "#60a5fa" },
    });

    expect(dark.toString()).toBe(dark._);
    expect(dark.toString()).toMatch(/^theme-/);
  });

  it("default theme stringifies to empty string", () => {
    const light = createTheme(tokens);
    expect(light.toString()).toBe("");
  });

  it("supports partial overrides", () => {
    const highContrast = createTheme(tokens, {
      colors: {
        text: "#000000",
      },
    });

    expect(highContrast.__cssTemplate).toContain("--colors-text: #000000");
    expect(highContrast.__cssTemplate).not.toContain("--colors-primary");
    expect(highContrast.__cssTemplate).not.toContain("--colors-background");
  });

  it("produces deterministic class names for same overrides", () => {
    const theme1 = createTheme(tokens, { colors: { primary: "#ff0000" } });
    const theme2 = createTheme(tokens, { colors: { primary: "#ff0000" } });

    expect(theme1._).toBe(theme2._);
  });

  it("produces different class names for different overrides", () => {
    const theme1 = createTheme(tokens, { colors: { primary: "#ff0000" } });
    const theme2 = createTheme(tokens, { colors: { primary: "#00ff00" } });

    expect(theme1._).not.toBe(theme2._);
  });

  it("override theme CSS wraps in class selector", () => {
    const dark = createTheme(tokens, {
      colors: { primary: "#60a5fa" },
    });

    expect(dark.__cssTemplate).toMatch(/^\.theme-[\w]+ \{/);
  });
});

describe("tokens in rule templates", () => {
  it("tokens can be interpolated in template strings", () => {
    const tokens = defineTokens({
      colors: {
        primary: "#3b82f6",
      },
      space: {
        md: "1rem",
      },
    });

    // Simulating what happens when tokens are used in rule``
    const css = `.test { color: ${tokens.colors.primary}; padding: ${tokens.space.md}; }`;
    expect(css).toBe(".test { color: var(--colors-primary); padding: var(--space-md); }");
  });
});
