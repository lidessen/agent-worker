import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import {
  // Display
  inlineBlock,
  flex,
  inlineFlex,
  grid,
  hidden,
  // Flex direction
  flexRow,
  flexRowReverse,
  flexCol,
  flexColReverse,
  // Flex wrap
  flexWrap,
  flexWrapReverse,
  flexNowrap,
  // Flex shorthand
  flex1,
  flexAuto,
  flexNone,
  flexArb,
  // Grow/shrink
  grow,
  grow0,
  shrink,
  shrink0,
  // Basis
  basis4,
  basisAuto,
  basisHalf,
  basisFull,
  basis,
  // Justify content
  justifyCenter,
  justifyBetween,
  // Justify items
  justifyItemsCenter,
  // Justify self
  justifySelfStart,
  // Align content
  contentCenter,
  // Align items
  itemsCenter,
  itemsStart,
  // Align self
  selfCenter,
  // Place content
  placeContentCenter,
  // Place items
  placeItemsCenter,
  // Place self
  placeSelfCenter,
  // Order
  order1,
  orderFirst,
  orderLast,
  order,
  // Namespace
  flexbox,
} from "./flexbox";

describe("display utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates flex display correctly", () => {
    expect(flex._).toBe("flex");
    expect(flex.__cssTemplate).toBe(".flex { display: flex; }");
  });

  it("generates grid display correctly", () => {
    expect(grid._).toBe("grid");
    expect(grid.__cssTemplate).toBe(".grid { display: grid; }");
  });

  it("generates hidden correctly", () => {
    expect(hidden._).toBe("hidden");
    expect(hidden.__cssTemplate).toBe(".hidden { display: none; }");
  });

  it("generates inlineFlex correctly", () => {
    expect(inlineFlex._).toBe("inline-flex");
    expect(inlineFlex.__cssTemplate).toBe(".inline-flex { display: inline-flex; }");
  });

  it("generates inlineBlock correctly", () => {
    expect(inlineBlock._).toBe("inline-block");
    expect(inlineBlock.__cssTemplate).toBe(".inline-block { display: inline-block; }");
  });
});

describe("flex direction utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates flexRow correctly", () => {
    expect(flexRow._).toBe("flex-row");
    expect(flexRow.__cssTemplate).toBe(".flex-row { flex-direction: row; }");
  });

  it("generates flexCol correctly", () => {
    expect(flexCol._).toBe("flex-col");
    expect(flexCol.__cssTemplate).toBe(".flex-col { flex-direction: column; }");
  });

  it("generates flexRowReverse correctly", () => {
    expect(flexRowReverse._).toBe("flex-row-reverse");
    expect(flexRowReverse.__cssTemplate).toBe(".flex-row-reverse { flex-direction: row-reverse; }");
  });

  it("generates flexColReverse correctly", () => {
    expect(flexColReverse._).toBe("flex-col-reverse");
    expect(flexColReverse.__cssTemplate).toBe(
      ".flex-col-reverse { flex-direction: column-reverse; }",
    );
  });
});

describe("flex wrap utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates flexWrap correctly", () => {
    expect(flexWrap._).toBe("flex-wrap");
    expect(flexWrap.__cssTemplate).toBe(".flex-wrap { flex-wrap: wrap; }");
  });

  it("generates flexNowrap correctly", () => {
    expect(flexNowrap._).toBe("flex-nowrap");
    expect(flexNowrap.__cssTemplate).toBe(".flex-nowrap { flex-wrap: nowrap; }");
  });

  it("generates flexWrapReverse correctly", () => {
    expect(flexWrapReverse._).toBe("flex-wrap-reverse");
    expect(flexWrapReverse.__cssTemplate).toBe(".flex-wrap-reverse { flex-wrap: wrap-reverse; }");
  });
});

describe("flex shorthand utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates flex1 correctly", () => {
    expect(flex1._).toBe("flex-1");
    expect(flex1.__cssTemplate).toBe(".flex-1 { flex: 1 1 0%; }");
  });

  it("generates flexAuto correctly", () => {
    expect(flexAuto._).toBe("flex-auto");
    expect(flexAuto.__cssTemplate).toBe(".flex-auto { flex: 1 1 auto; }");
  });

  it("generates flexNone correctly", () => {
    expect(flexNone._).toBe("flex-none");
    expect(flexNone.__cssTemplate).toBe(".flex-none { flex: none; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = flexArb`2 2 0%`;
    expect(token._).toMatch(/^flex-/);
    expect(token.__cssTemplate).toContain("2 2 0%");
  });
});

describe("flex grow/shrink utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates grow correctly", () => {
    expect(grow._).toBe("grow");
    expect(grow.__cssTemplate).toBe(".grow { flex-grow: 1; }");
  });

  it("generates grow0 correctly", () => {
    expect(grow0._).toBe("grow-0");
    expect(grow0.__cssTemplate).toBe(".grow-0 { flex-grow: 0; }");
  });

  it("generates shrink correctly", () => {
    expect(shrink._).toBe("shrink");
    expect(shrink.__cssTemplate).toBe(".shrink { flex-shrink: 1; }");
  });

  it("generates shrink0 correctly", () => {
    expect(shrink0._).toBe("shrink-0");
    expect(shrink0.__cssTemplate).toBe(".shrink-0 { flex-shrink: 0; }");
  });
});

describe("flex basis utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates basis4 correctly", () => {
    expect(basis4._).toBe("basis-4");
    expect(basis4.__cssTemplate).toBe(".basis-4 { flex-basis: 1rem; }");
  });

  it("generates basisAuto correctly", () => {
    expect(basisAuto._).toBe("basis-auto");
    expect(basisAuto.__cssTemplate).toBe(".basis-auto { flex-basis: auto; }");
  });

  it("generates basisHalf correctly", () => {
    expect(basisHalf._).toBe("basis-half");
    expect(basisHalf.__cssTemplate).toBe(".basis-half { flex-basis: 50%; }");
  });

  it("generates basisFull correctly", () => {
    expect(basisFull._).toBe("basis-full");
    expect(basisFull.__cssTemplate).toBe(".basis-full { flex-basis: 100%; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = basis`200px`;
    expect(token._).toBe("basis-200px");
    expect(token.__cssTemplate).toBe(".basis-200px { flex-basis: 200px; }");
  });
});

describe("justify utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates justifyCenter correctly", () => {
    expect(justifyCenter._).toBe("justify-center");
    expect(justifyCenter.__cssTemplate).toBe(".justify-center { justify-content: center; }");
  });

  it("generates justifyBetween correctly", () => {
    expect(justifyBetween._).toBe("justify-between");
    expect(justifyBetween.__cssTemplate).toBe(
      ".justify-between { justify-content: space-between; }",
    );
  });

  it("generates justifyItemsCenter correctly", () => {
    expect(justifyItemsCenter._).toBe("justify-items-center");
    expect(justifyItemsCenter.__cssTemplate).toBe(
      ".justify-items-center { justify-items: center; }",
    );
  });

  it("generates justifySelfStart correctly", () => {
    expect(justifySelfStart._).toBe("justify-self-start");
    expect(justifySelfStart.__cssTemplate).toBe(".justify-self-start { justify-self: start; }");
  });
});

describe("align utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates itemsCenter correctly", () => {
    expect(itemsCenter._).toBe("items-center");
    expect(itemsCenter.__cssTemplate).toBe(".items-center { align-items: center; }");
  });

  it("generates itemsStart correctly", () => {
    expect(itemsStart._).toBe("items-start");
    expect(itemsStart.__cssTemplate).toBe(".items-start { align-items: flex-start; }");
  });

  it("generates contentCenter correctly", () => {
    expect(contentCenter._).toBe("content-center");
    expect(contentCenter.__cssTemplate).toBe(".content-center { align-content: center; }");
  });

  it("generates selfCenter correctly", () => {
    expect(selfCenter._).toBe("self-center");
    expect(selfCenter.__cssTemplate).toBe(".self-center { align-self: center; }");
  });
});

describe("place utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates placeContentCenter correctly", () => {
    expect(placeContentCenter._).toBe("place-content-center");
    expect(placeContentCenter.__cssTemplate).toBe(
      ".place-content-center { place-content: center; }",
    );
  });

  it("generates placeItemsCenter correctly", () => {
    expect(placeItemsCenter._).toBe("place-items-center");
    expect(placeItemsCenter.__cssTemplate).toBe(".place-items-center { place-items: center; }");
  });

  it("generates placeSelfCenter correctly", () => {
    expect(placeSelfCenter._).toBe("place-self-center");
    expect(placeSelfCenter.__cssTemplate).toBe(".place-self-center { place-self: center; }");
  });
});

describe("order utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates order1 correctly", () => {
    expect(order1._).toBe("order-1");
    expect(order1.__cssTemplate).toBe(".order-1 { order: 1; }");
  });

  it("generates orderFirst correctly", () => {
    expect(orderFirst._).toBe("order-first");
    expect(orderFirst.__cssTemplate).toBe(".order-first { order: -9999; }");
  });

  it("generates orderLast correctly", () => {
    expect(orderLast._).toBe("order-last");
    expect(orderLast.__cssTemplate).toBe(".order-last { order: 9999; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = order`99`;
    expect(token._).toBe("order-99");
    expect(token.__cssTemplate).toBe(".order-99 { order: 99; }");
  });
});

describe("flexbox namespace", () => {
  it("has display tokens", () => {
    expect(flexbox.flex).toBe(flex);
    expect(flexbox.grid).toBe(grid);
    expect(flexbox.hidden).toBe(hidden);
  });

  it("has flex direction tokens", () => {
    expect(flexbox.flexRow).toBe(flexRow);
    expect(flexbox.flexCol).toBe(flexCol);
  });

  it("has flex shorthand tokens", () => {
    expect(flexbox.flex1).toBe(flex1);
    expect(flexbox.flexAuto).toBe(flexAuto);
  });

  it("has justify tokens", () => {
    expect(flexbox.justifyCenter).toBe(justifyCenter);
    expect(flexbox.justifyBetween).toBe(justifyBetween);
  });

  it("has align items tokens", () => {
    expect(flexbox.itemsCenter).toBe(itemsCenter);
    expect(flexbox.itemsStart).toBe(itemsStart);
  });

  it("has tagged template functions", () => {
    expect(typeof flexbox.basis).toBe("function");
    expect(typeof flexbox.order).toBe("function");
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(flex.__kind).toBe("style");
    expect(flexCol.__kind).toBe("style");
    expect(justifyCenter.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(flex.toString()).toBe("flex");
    expect(flexCol.toString()).toBe("flex-col");
    expect(justifyCenter.toString()).toBe("justify-center");
  });
});
