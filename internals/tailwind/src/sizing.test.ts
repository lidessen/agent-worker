import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import {
  // Width - numbers
  w0,
  w4,
  w8,
  w16,
  w96,
  wpx,
  // Width - fractions
  wHalf,
  wThird,
  wTwoThirds,
  wQuarter,
  wThreeQuarters,
  // Width - semantic
  wAuto,
  wFull,
  wScreen,
  wMin,
  wMax,
  wFit,
  // Width - arbitrary
  w,
  // Height - numbers
  h0,
  h4,
  h8,
  h16,
  h32,
  h64,
  // Height - fractions
  hHalf,
  // Height - semantic
  hAuto,
  hFull,
  hScreen,
  hSvh,
  hDvh,
  // Height - arbitrary
  h,
  // Min/max width
  minW0,
  minWFull,
  minWMin,
  minWMax,
  minWFit,
  maxW0,
  maxWFull,
  maxWXs,
  maxWSm,
  maxWMd,
  maxWLg,
  maxWXl,
  maxW2xl,
  maxW7xl,
  maxWProse,
  minW,
  maxW,
  // Min/max height
  minH0,
  minHFull,
  minHScreen,
  minHMin,
  minHMax,
  minHFit,
  maxH0,
  maxHFull,
  maxHScreen,
  maxHMin,
  maxHMax,
  maxHFit,
  minH,
  maxH,
  // Size
  size4,
  size8,
  sizeFull,
  sizeHalf,
  size,
  // Namespace
  sizing,
} from "./sizing";

describe("width utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates width tokens for spacing scale", () => {
    expect(w0._).toBe("w-0");
    expect(w0.__cssTemplate).toBe(".w-0 { width: 0px; }");

    expect(w4._).toBe("w-4");
    expect(w4.__cssTemplate).toBe(".w-4 { width: 1rem; }");

    expect(w8._).toBe("w-8");
    expect(w8.__cssTemplate).toBe(".w-8 { width: 2rem; }");

    expect(w16._).toBe("w-16");
    expect(w16.__cssTemplate).toBe(".w-16 { width: 4rem; }");

    expect(w96._).toBe("w-96");
    expect(w96.__cssTemplate).toBe(".w-96 { width: 24rem; }");
  });

  it("generates width tokens for decimal scale via tagged template", () => {
    // Decimal values are not exported as flat tokens
    // Use tagged template instead: w`0.5`, w`1.5`, etc.
    const w0_5 = w`0.5`;
    expect(w0_5._).toBe("w-0_5");
    expect(w0_5.__cssTemplate).toContain("width: 0.5");
  });

  it("generates width token for px", () => {
    expect(wpx._).toBe("w-px");
    expect(wpx.__cssTemplate).toBe(".w-px { width: 1px; }");
  });

  it("generates width tokens for fractions", () => {
    expect(wHalf._).toBe("w-half");
    expect(wHalf.__cssTemplate).toBe(".w-half { width: 50%; }");

    expect(wThird._).toBe("w-third");
    expect(wThird.__cssTemplate).toBe(".w-third { width: 33.333333%; }");

    expect(wTwoThirds._).toBe("w-twoThirds");
    expect(wTwoThirds.__cssTemplate).toBe(".w-twoThirds { width: 66.666667%; }");

    expect(wQuarter._).toBe("w-quarter");
    expect(wThreeQuarters._).toBe("w-threeQuarters");
  });

  it("generates width tokens for semantic values", () => {
    expect(wAuto._).toBe("w-auto");
    expect(wAuto.__cssTemplate).toBe(".w-auto { width: auto; }");

    expect(wFull._).toBe("w-full");
    expect(wFull.__cssTemplate).toBe(".w-full { width: 100%; }");

    expect(wScreen._).toBe("w-screen");
    expect(wScreen.__cssTemplate).toBe(".w-screen { width: 100vw; }");

    expect(wMin._).toBe("w-min");
    expect(wMax._).toBe("w-max");
    expect(wFit._).toBe("w-fit");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = w`300px`;
    expect(token._).toBe("w-300px");
    expect(token.__cssTemplate).toBe(".w-300px { width: 300px; }");
  });

  it("hashes complex arbitrary values", () => {
    const token = w`calc(100% - 40px)`;
    expect(token._).toMatch(/^w-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("calc(100% - 40px)");
  });
});

describe("height utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates height tokens for spacing scale", () => {
    expect(h0._).toBe("h-0");
    expect(h4._).toBe("h-4");
    expect(h8._).toBe("h-8");
    expect(h16._).toBe("h-16");
    expect(h32._).toBe("h-32");
    expect(h64._).toBe("h-64");
  });

  it("generates height tokens for fractions", () => {
    expect(hHalf._).toBe("h-half");
    expect(hHalf.__cssTemplate).toBe(".h-half { height: 50%; }");
  });

  it("generates height tokens for semantic values", () => {
    expect(hAuto._).toBe("h-auto");
    expect(hFull._).toBe("h-full");
    expect(hFull.__cssTemplate).toBe(".h-full { height: 100%; }");
    expect(hScreen._).toBe("h-screen");
    expect(hScreen.__cssTemplate).toBe(".h-screen { height: 100vh; }");
  });

  it("generates dynamic viewport heights", () => {
    expect(hSvh._).toBe("h-svh");
    expect(hSvh.__cssTemplate).toBe(".h-svh { height: 100svh; }");
    expect(hDvh._).toBe("h-dvh");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = h`calc(100vh - 64px)`;
    expect(token._).toMatch(/^h-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("calc(100vh - 64px)");
  });
});

describe("min-width utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates min-width tokens", () => {
    expect(minW0._).toBe("min-w-0");
    expect(minW0.__cssTemplate).toBe(".min-w-0 { min-width: 0px; }");
    expect(minWFull._).toBe("min-w-full");
    expect(minWMin._).toBe("min-w-min");
    expect(minWMax._).toBe("min-w-max");
    expect(minWFit._).toBe("min-w-fit");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = minW`200px`;
    expect(token._).toBe("min-w-200px");
    expect(token.__cssTemplate).toBe(".min-w-200px { min-width: 200px; }");
  });
});

describe("max-width utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates max-width tokens for named sizes", () => {
    expect(maxWXs._).toBe("max-w-xs");
    expect(maxWXs.__cssTemplate).toBe(".max-w-xs { max-width: 20rem; }");

    expect(maxWSm._).toBe("max-w-sm");
    expect(maxWMd._).toBe("max-w-md");
    expect(maxWLg._).toBe("max-w-lg");
    expect(maxWLg.__cssTemplate).toBe(".max-w-lg { max-width: 32rem; }");
    expect(maxWXl._).toBe("max-w-xl");
    expect(maxW2xl._).toBe("max-w-2xl");
    expect(maxW7xl._).toBe("max-w-7xl");

    expect(maxWProse._).toBe("max-w-prose");
    expect(maxWProse.__cssTemplate).toBe(".max-w-prose { max-width: 65ch; }");
  });

  it("generates max-width tokens for basic values", () => {
    expect(maxW0._).toBe("max-w-0");
    expect(maxWFull._).toBe("max-w-full");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = maxW`800px`;
    expect(token._).toBe("max-w-800px");
    expect(token.__cssTemplate).toBe(".max-w-800px { max-width: 800px; }");
  });
});

describe("min-height utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates min-height tokens", () => {
    expect(minH0._).toBe("min-h-0");
    expect(minH0.__cssTemplate).toBe(".min-h-0 { min-height: 0px; }");
    expect(minHFull._).toBe("min-h-full");
    expect(minHScreen._).toBe("min-h-screen");
    expect(minHScreen.__cssTemplate).toBe(".min-h-screen { min-height: 100vh; }");
    expect(minHMin._).toBe("min-h-min");
    expect(minHMax._).toBe("min-h-max");
    expect(minHFit._).toBe("min-h-fit");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = minH`100px`;
    expect(token._).toBe("min-h-100px");
    expect(token.__cssTemplate).toBe(".min-h-100px { min-height: 100px; }");
  });
});

describe("max-height utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates max-height tokens", () => {
    expect(maxH0._).toBe("max-h-0");
    expect(maxHFull._).toBe("max-h-full");
    expect(maxHFull.__cssTemplate).toBe(".max-h-full { max-height: 100%; }");
    expect(maxHScreen._).toBe("max-h-screen");
    expect(maxHMin._).toBe("max-h-min");
    expect(maxHMax._).toBe("max-h-max");
    expect(maxHFit._).toBe("max-h-fit");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = maxH`500px`;
    expect(token._).toBe("max-h-500px");
    expect(token.__cssTemplate).toBe(".max-h-500px { max-height: 500px; }");
  });
});

describe("size utility", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates size tokens (sets both width and height)", () => {
    expect(size4._).toBe("size-4");
    expect(size4.__cssTemplate).toBe(".size-4 { width: 1rem; height: 1rem; }");

    expect(size8._).toBe("size-8");
    expect(sizeFull._).toBe("size-full");
    expect(sizeFull.__cssTemplate).toBe(".size-full { width: 100%; height: 100%; }");
    expect(sizeHalf._).toBe("size-half");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = size`48px`;
    expect(token._).toBe("size-48px");
    expect(token.__cssTemplate).toBe(".size-48px { width: 48px; height: 48px; }");
  });
});

describe("sizing namespace", () => {
  it("has all width tokens", () => {
    expect(sizing.w4).toBe(w4);
    expect(sizing.wFull).toBe(wFull);
    expect(sizing.wHalf).toBe(wHalf);
  });

  it("has all height tokens", () => {
    expect(sizing.h4).toBe(h4);
    expect(sizing.hFull).toBe(hFull);
    expect(sizing.hScreen).toBe(hScreen);
  });

  it("has arbitrary functions", () => {
    expect(sizing.w).toBe(w);
    expect(sizing.h).toBe(h);
    expect(sizing.maxW).toBe(maxW);
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(w4.__kind).toBe("style");
    expect(hFull.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(w4.toString()).toBe("w-4");
    expect(hFull.toString()).toBe("h-full");
  });
});
