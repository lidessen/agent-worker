import { describe, expect, it } from "vitest";
import { tokens } from "./tokens";
import { isTokenRef } from "@semajsx/style";

describe("tokens", () => {
  it("creates valid token refs for colors", () => {
    expect(isTokenRef(tokens.colors.primary)).toBe(true);
    expect(tokens.colors.primary.varName).toBe("--colors-primary");
    expect(tokens.colors.primary.defaultValue).toBe("#0071e3");
  });

  it("stringifies to var() expressions", () => {
    expect(tokens.colors.primary.toString()).toBe("var(--colors-primary)");
    expect(`${tokens.space.md}`).toBe("var(--space-md)");
  });

  it("defines all expected token categories", () => {
    expect(tokens.colors).toBeDefined();
    expect(tokens.space).toBeDefined();
    expect(tokens.radii).toBeDefined();
    expect(tokens.fonts).toBeDefined();
    expect(tokens.fontSizes).toBeDefined();
    expect(tokens.fontWeights).toBeDefined();
    expect(tokens.shadows).toBeDefined();
    expect(tokens.transitions).toBeDefined();
  });

  it("defines semantic color tokens", () => {
    expect(tokens.colors.danger.varName).toBe("--colors-danger");
    expect(tokens.colors.success.varName).toBe("--colors-success");
    expect(tokens.colors.warning.varName).toBe("--colors-warning");
  });

  it("defines size scale tokens", () => {
    expect(tokens.space.xs.varName).toBe("--space-xs");
    expect(tokens.space.sm.varName).toBe("--space-sm");
    expect(tokens.space.md.varName).toBe("--space-md");
    expect(tokens.space.lg.varName).toBe("--space-lg");
    expect(tokens.space.xl.varName).toBe("--space-xl");
  });
});
