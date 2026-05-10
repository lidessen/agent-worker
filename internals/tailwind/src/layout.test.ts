import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import {
  // Position
  positionStatic,
  fixed,
  absolute,
  relative,
  sticky,
  // Top
  top0,
  top4,
  topAuto,
  topHalf,
  top,
  // Right
  right4,
  right,
  // Bottom
  bottomAuto,
  // Left
  leftHalf,
  // Inset
  inset0,
  inset4,
  insetAuto,
  inset,
  // Inset X
  insetX4,
  insetX,
  // Inset Y
  insetY4,
  insetY,
  // Z-index
  z0,
  z50,
  zAuto,
  z,
  // Overflow
  overflowAuto,
  overflowHidden,
  overflowScroll,
  overflowXAuto,
  overflowYScroll,
  // Visibility
  visible,
  invisible,
  collapse,
  // Namespace
  layout,
} from "./layout";

describe("position utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates relative correctly", () => {
    expect(relative._).toBe("relative");
    expect(relative.__cssTemplate).toBe(".relative { position: relative; }");
  });

  it("generates absolute correctly", () => {
    expect(absolute._).toBe("absolute");
    expect(absolute.__cssTemplate).toBe(".absolute { position: absolute; }");
  });

  it("generates fixed correctly", () => {
    expect(fixed._).toBe("fixed");
    expect(fixed.__cssTemplate).toBe(".fixed { position: fixed; }");
  });

  it("generates sticky correctly", () => {
    expect(sticky._).toBe("sticky");
    expect(sticky.__cssTemplate).toBe(".sticky { position: sticky; }");
  });

  it("generates static correctly", () => {
    expect(positionStatic._).toBe("static");
    expect(positionStatic.__cssTemplate).toBe(".static { position: static; }");
  });
});

describe("inset utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates inset0 correctly", () => {
    expect(inset0._).toBe("inset-0");
    expect(inset0.__cssTemplate).toBe(".inset-0 { inset: 0px; }");
  });

  it("generates inset4 correctly", () => {
    expect(inset4._).toBe("inset-4");
    expect(inset4.__cssTemplate).toBe(".inset-4 { inset: 1rem; }");
  });

  it("generates insetAuto correctly", () => {
    expect(insetAuto._).toBe("inset-auto");
    expect(insetAuto.__cssTemplate).toBe(".inset-auto { inset: auto; }");
  });

  it("generates insetX4 correctly", () => {
    expect(insetX4._).toBe("inset-x-4");
    expect(insetX4.__cssTemplate).toBe(".inset-x-4 { left: 1rem; right: 1rem; }");
  });

  it("generates insetY4 correctly", () => {
    expect(insetY4._).toBe("inset-y-4");
    expect(insetY4.__cssTemplate).toBe(".inset-y-4 { top: 1rem; bottom: 1rem; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = inset`100px`;
    expect(token._).toBe("inset-100px");
    expect(token.__cssTemplate).toBe(".inset-100px { inset: 100px; }");
  });

  it("supports arbitrary values on insetX via tagged template", () => {
    const token = insetX`50px`;
    expect(token._).toBe("inset-x-50px");
    expect(token.__cssTemplate).toBe(".inset-x-50px { left: 50px; right: 50px; }");
  });

  it("supports arbitrary values on insetY via tagged template", () => {
    const token = insetY`50px`;
    expect(token._).toBe("inset-y-50px");
    expect(token.__cssTemplate).toBe(".inset-y-50px { top: 50px; bottom: 50px; }");
  });
});

describe("top/right/bottom/left utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates top0 correctly", () => {
    expect(top0._).toBe("top-0");
    expect(top0.__cssTemplate).toBe(".top-0 { top: 0px; }");
  });

  it("generates top4 correctly", () => {
    expect(top4._).toBe("top-4");
    expect(top4.__cssTemplate).toBe(".top-4 { top: 1rem; }");
  });

  it("generates topAuto correctly", () => {
    expect(topAuto._).toBe("top-auto");
    expect(topAuto.__cssTemplate).toBe(".top-auto { top: auto; }");
  });

  it("generates topHalf correctly", () => {
    expect(topHalf._).toBe("top-half");
    expect(topHalf.__cssTemplate).toBe(".top-half { top: 50%; }");
  });

  it("generates right4 correctly", () => {
    expect(right4._).toBe("right-4");
    expect(right4.__cssTemplate).toBe(".right-4 { right: 1rem; }");
  });

  it("generates bottomAuto correctly", () => {
    expect(bottomAuto._).toBe("bottom-auto");
    expect(bottomAuto.__cssTemplate).toBe(".bottom-auto { bottom: auto; }");
  });

  it("generates leftHalf correctly", () => {
    expect(leftHalf._).toBe("left-half");
    expect(leftHalf.__cssTemplate).toBe(".left-half { left: 50%; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = top`100px`;
    expect(token._).toBe("top-100px");
    expect(token.__cssTemplate).toBe(".top-100px { top: 100px; }");
  });

  it("supports arbitrary values on right via tagged template", () => {
    const token = right`20%`;
    // % is a special character, so it gets hashed
    expect(token._).toMatch(/^right-[a-z0-9]{5}$/);
    expect(token.__cssTemplate).toContain("right: 20%");
  });
});

describe("z-index utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates z0 correctly", () => {
    expect(z0._).toBe("z-0");
    expect(z0.__cssTemplate).toBe(".z-0 { z-index: 0; }");
  });

  it("generates z50 correctly", () => {
    expect(z50._).toBe("z-50");
    expect(z50.__cssTemplate).toBe(".z-50 { z-index: 50; }");
  });

  it("generates zAuto correctly", () => {
    expect(zAuto._).toBe("z-auto");
    expect(zAuto.__cssTemplate).toBe(".z-auto { z-index: auto; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = z`999`;
    expect(token._).toBe("z-999");
    expect(token.__cssTemplate).toBe(".z-999 { z-index: 999; }");
  });
});

describe("overflow utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates overflowHidden correctly", () => {
    expect(overflowHidden._).toBe("overflow-hidden");
    expect(overflowHidden.__cssTemplate).toBe(".overflow-hidden { overflow: hidden; }");
  });

  it("generates overflowAuto correctly", () => {
    expect(overflowAuto._).toBe("overflow-auto");
    expect(overflowAuto.__cssTemplate).toBe(".overflow-auto { overflow: auto; }");
  });

  it("generates overflowScroll correctly", () => {
    expect(overflowScroll._).toBe("overflow-scroll");
    expect(overflowScroll.__cssTemplate).toBe(".overflow-scroll { overflow: scroll; }");
  });

  it("generates overflowXAuto correctly", () => {
    expect(overflowXAuto._).toBe("overflow-x-auto");
    expect(overflowXAuto.__cssTemplate).toBe(".overflow-x-auto { overflow-x: auto; }");
  });

  it("generates overflowYScroll correctly", () => {
    expect(overflowYScroll._).toBe("overflow-y-scroll");
    expect(overflowYScroll.__cssTemplate).toBe(".overflow-y-scroll { overflow-y: scroll; }");
  });
});

describe("visibility utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates visible correctly", () => {
    expect(visible._).toBe("visible");
    expect(visible.__cssTemplate).toBe(".visible { visibility: visible; }");
  });

  it("generates invisible correctly", () => {
    expect(invisible._).toBe("invisible");
    expect(invisible.__cssTemplate).toBe(".invisible { visibility: hidden; }");
  });

  it("generates collapse correctly", () => {
    expect(collapse._).toBe("collapse");
    expect(collapse.__cssTemplate).toBe(".collapse { visibility: collapse; }");
  });
});

describe("layout namespace", () => {
  it("has position tokens", () => {
    expect(layout.absolute).toBe(absolute);
    expect(layout.relative).toBe(relative);
    expect(layout.fixed).toBe(fixed);
  });

  it("has inset tokens", () => {
    expect(layout.inset0).toBe(inset0);
    expect(layout.inset4).toBe(inset4);
    expect(layout.insetX4).toBe(insetX4);
    expect(layout.insetY4).toBe(insetY4);
  });

  it("has z-index tokens", () => {
    expect(layout.z0).toBe(z0);
    expect(layout.z50).toBe(z50);
    expect(layout.zAuto).toBe(zAuto);
  });

  it("has overflow tokens", () => {
    expect(layout.overflowHidden).toBe(overflowHidden);
    expect(layout.overflowXAuto).toBe(overflowXAuto);
  });

  it("has visibility tokens", () => {
    expect(layout.visible).toBe(visible);
    expect(layout.invisible).toBe(invisible);
  });

  it("has tagged template functions", () => {
    expect(layout.top).toBe(top);
    expect(layout.z).toBe(z);
    expect(layout.inset).toBe(inset);
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(absolute.__kind).toBe("style");
    expect(top4.__kind).toBe("style");
    expect(z50.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(absolute.toString()).toBe("absolute");
    expect(top4.toString()).toBe("top-4");
    expect(z50.toString()).toBe("z-50");
  });
});
