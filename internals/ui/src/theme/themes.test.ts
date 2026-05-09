import { describe, expect, it } from "vitest";
import { isStyleToken } from "@semajsx/style";
import { lightTheme, darkTheme } from "./themes";

describe("themes", () => {
  it("creates a valid light theme StyleToken", () => {
    expect(isStyleToken(lightTheme)).toBe(true);
  });

  it("light theme targets :root selector", () => {
    expect(lightTheme.__cssTemplate).toContain(":root");
    expect(lightTheme.__cssTemplate).toContain("--colors-primary");
    expect(lightTheme.__cssTemplate).toContain("#0071e3");
  });

  it("light theme has no className (applies globally)", () => {
    expect(lightTheme.toString()).toBe("");
  });

  it("creates a valid dark theme StyleToken", () => {
    expect(isStyleToken(darkTheme)).toBe(true);
  });

  it("dark theme is scoped to a className", () => {
    const className = darkTheme.toString();
    expect(className).toBeTruthy();
    expect(className).toMatch(/^theme-/);
  });

  it("dark theme overrides color values", () => {
    const css = darkTheme.__cssTemplate;
    expect(css).toContain("--colors-primary");
    expect(css).toContain("--colors-background");
    expect(css).toContain("#000000");
  });
});
