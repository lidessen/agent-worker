import { describe, it, expect } from "vitest";
import { estimateTextSize, canvasMeasureText } from "./measure";

describe("estimateTextSize", () => {
  it("produces non-zero dimensions for ASCII text", () => {
    const size = estimateTextSize("Hello World", 14);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it("narrow characters produce smaller width than wide ones", () => {
    const narrow = estimateTextSize("iiii", 14);
    const wide = estimateTextSize("WWWW", 14);
    expect(narrow.width).toBeLessThan(wide.width);
  });

  it("handles CJK characters with wider width", () => {
    // 4 CJK chars should be wider than 4 narrow Latin chars
    const cjk = estimateTextSize("你好世界", 14);
    const latin = estimateTextSize("abcd", 14);
    expect(cjk.width).toBeGreaterThan(latin.width);
  });

  it("empty string has zero width", () => {
    const size = estimateTextSize("", 14);
    expect(size.width).toBe(0);
  });

  it("scales with font size", () => {
    const small = estimateTextSize("Test", 12);
    const large = estimateTextSize("Test", 24);
    expect(large.width).toBeGreaterThan(small.width);
  });
});

describe("canvasMeasureText", () => {
  it("produces non-zero dimensions", () => {
    const size = canvasMeasureText("Hello", 14);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it("longer text produces wider result", () => {
    const short = canvasMeasureText("Hi", 14);
    const long = canvasMeasureText("Hello World!", 14);
    expect(long.width).toBeGreaterThan(short.width);
  });
});
