import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import { bg, text, border, colors, colorsArb } from "./colors";

describe("background color utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates bg.white correctly", () => {
    expect(bg.white._).toBe("bg-white");
    expect(bg.white.__cssTemplate).toBe(".bg-white { background-color: #fff; }");
  });

  it("generates bg.black correctly", () => {
    expect(bg.black._).toBe("bg-black");
    expect(bg.black.__cssTemplate).toBe(".bg-black { background-color: #000; }");
  });

  it("generates bg.transparent correctly", () => {
    expect(bg.transparent._).toBe("bg-transparent");
    expect(bg.transparent.__cssTemplate).toBe(".bg-transparent { background-color: transparent; }");
  });

  it("generates bg.blue500 correctly", () => {
    expect(bg.blue500._).toBe("bg-blue-500");
    expect(bg.blue500.__cssTemplate).toBe(".bg-blue-500 { background-color: #3b82f6; }");
  });

  it("generates bg.red600 correctly", () => {
    expect(bg.red600._).toBe("bg-red-600");
    expect(bg.red600.__cssTemplate).toBe(".bg-red-600 { background-color: #dc2626; }");
  });

  it("generates bg.slate50 correctly", () => {
    expect(bg.slate50._).toBe("bg-slate-50");
    expect(bg.slate50.__cssTemplate).toBe(".bg-slate-50 { background-color: #f8fafc; }");
  });

  it("supports arbitrary values via tagged template (hashes colors with #)", () => {
    const token = bg`#ff5500`;
    // # is a special character, so it gets hashed
    expect(token._).toMatch(/^bg-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("#ff5500");
  });

  it("hashes complex arbitrary values", () => {
    const token = bg`rgb(255, 85, 0)`;
    expect(token._).toMatch(/^bg-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("rgb(255, 85, 0)");
  });
});

describe("text color utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates text.white correctly", () => {
    expect(text.white._).toBe("text-white");
    expect(text.white.__cssTemplate).toBe(".text-white { color: #fff; }");
  });

  it("generates text.gray700 correctly", () => {
    expect(text.gray700._).toBe("text-gray-700");
    expect(text.gray700.__cssTemplate).toBe(".text-gray-700 { color: #374151; }");
  });

  it("generates text.current correctly", () => {
    expect(text.current._).toBe("text-current");
    expect(text.current.__cssTemplate).toBe(".text-current { color: currentColor; }");
  });

  it("generates text.inherit correctly", () => {
    expect(text.inherit._).toBe("text-inherit");
    expect(text.inherit.__cssTemplate).toBe(".text-inherit { color: inherit; }");
  });

  it("supports arbitrary values via tagged template (hashes colors with #)", () => {
    const token = text`#333`;
    // # is a special character, so it gets hashed
    expect(token._).toMatch(/^text-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("#333");
  });
});

describe("border color utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates border.gray200 correctly", () => {
    expect(border.gray200._).toBe("border-gray-200");
    expect(border.gray200.__cssTemplate).toBe(".border-gray-200 { border-color: #e5e7eb; }");
  });

  it("generates border.transparent correctly", () => {
    expect(border.transparent._).toBe("border-transparent");
    expect(border.transparent.__cssTemplate).toBe(
      ".border-transparent { border-color: transparent; }",
    );
  });

  it("supports arbitrary values via tagged template", () => {
    const token = border`rgba(0, 0, 0, 0.1)`;
    expect(token._).toMatch(/^border-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("rgba(0, 0, 0, 0.1)");
  });
});

describe("color palette coverage", () => {
  it("includes all standard Tailwind colors", () => {
    const colorNames = [
      "slate",
      "gray",
      "zinc",
      "neutral",
      "stone",
      "red",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "emerald",
      "teal",
      "cyan",
      "sky",
      "blue",
      "indigo",
      "violet",
      "purple",
      "fuchsia",
      "pink",
      "rose",
    ];

    const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

    for (const color of colorNames) {
      for (const shade of shades) {
        // Use camelCase format: blue500, gray200, etc.
        const key = `${color}${shade}`;
        expect(bg[key]).toBeDefined();
        expect(text[key]).toBeDefined();
        expect(border[key]).toBeDefined();
      }
    }
  });

  it("includes special colors", () => {
    const specialColors = ["inherit", "current", "transparent", "black", "white"];

    for (const color of specialColors) {
      expect(bg[color]).toBeDefined();
      expect(text[color]).toBeDefined();
      expect(border[color]).toBeDefined();
    }
  });
});

describe("grouped exports", () => {
  it("colors object contains all utilities", () => {
    expect(colors.bg).toBe(bg);
    expect(colors.text).toBe(text);
    expect(colors.border).toBe(border);
  });

  it("colorsArb object contains all arbitrary functions", () => {
    expect(colorsArb.bg).toBe(bg);
    expect(colorsArb.text).toBe(text);
    expect(colorsArb.border).toBe(border);
  });
});

describe("color destructuring", () => {
  it("supports destructuring from bg", () => {
    const { blue500, white, red600 } = bg;

    expect(blue500._).toBe("bg-blue-500");
    expect(white._).toBe("bg-white");
    expect(red600._).toBe("bg-red-600");
  });
});
