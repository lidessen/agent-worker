import { describe, it, expect, beforeEach } from "vitest";
import { resetConfig } from "./config";
import {
  // Border width
  border,
  border0,
  border2,
  borderW,
  // Border radius
  roundedBase,
  roundedNone,
  roundedLg,
  roundedFull,
  rounded,
  // Border style
  borderSolid,
  borderDashed,
  borderNone,
  // Box shadow
  shadowBase,
  shadowSm,
  shadowLg,
  shadowInner,
  shadowNone,
  shadow,
  // Opacity
  opacity0,
  opacity50,
  opacity100,
  opacity,
  // Cursor
  cursorPointer,
  cursorNotAllowed,
  cursorGrab,
  cursorZoomIn,
  // Pointer events
  pointerEventsNone,
  pointerEventsAuto,
  // User select
  selectNone,
  selectText,
  selectAll,
  // Namespace
  effects,
} from "./effects";

describe("border width utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates border (default) correctly", () => {
    expect(border._).toBe("border");
    expect(border.__cssTemplate).toBe(".border { border-width: 1px; }");
  });

  it("generates border0 correctly", () => {
    expect(border0._).toBe("border-0");
    expect(border0.__cssTemplate).toBe(".border-0 { border-width: 0px; }");
  });

  it("generates border2 correctly", () => {
    expect(border2._).toBe("border-2");
    expect(border2.__cssTemplate).toBe(".border-2 { border-width: 2px; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = borderW`3px`;
    expect(token._).toBe("border-3px");
    expect(token.__cssTemplate).toBe(".border-3px { border-width: 3px; }");
  });
});

describe("border radius utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates rounded (default) correctly", () => {
    expect(roundedBase._).toBe("rounded");
    expect(roundedBase.__cssTemplate).toBe(".rounded { border-radius: 0.25rem; }");
  });

  it("generates roundedNone correctly", () => {
    expect(roundedNone._).toBe("rounded-none");
    expect(roundedNone.__cssTemplate).toBe(".rounded-none { border-radius: 0px; }");
  });

  it("generates roundedLg correctly", () => {
    expect(roundedLg._).toBe("rounded-lg");
    expect(roundedLg.__cssTemplate).toBe(".rounded-lg { border-radius: 0.5rem; }");
  });

  it("generates roundedFull correctly", () => {
    expect(roundedFull._).toBe("rounded-full");
    expect(roundedFull.__cssTemplate).toBe(".rounded-full { border-radius: 9999px; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = rounded`10px`;
    expect(token._).toBe("rounded-10px");
    expect(token.__cssTemplate).toBe(".rounded-10px { border-radius: 10px; }");
  });
});

describe("border style utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates borderSolid correctly", () => {
    expect(borderSolid._).toBe("border-solid");
    expect(borderSolid.__cssTemplate).toBe(".border-solid { border-style: solid; }");
  });

  it("generates borderDashed correctly", () => {
    expect(borderDashed._).toBe("border-dashed");
    expect(borderDashed.__cssTemplate).toBe(".border-dashed { border-style: dashed; }");
  });

  it("generates borderNone correctly", () => {
    expect(borderNone._).toBe("border-none");
    expect(borderNone.__cssTemplate).toBe(".border-none { border-style: none; }");
  });
});

describe("box shadow utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates shadow (default) correctly", () => {
    expect(shadowBase._).toBe("shadow");
    expect(shadowBase.__cssTemplate).toContain("box-shadow:");
  });

  it("generates shadowSm correctly", () => {
    expect(shadowSm._).toBe("shadow-sm");
    expect(shadowSm.__cssTemplate).toContain("box-shadow:");
  });

  it("generates shadowLg correctly", () => {
    expect(shadowLg._).toBe("shadow-lg");
    expect(shadowLg.__cssTemplate).toContain("box-shadow:");
  });

  it("generates shadowNone correctly", () => {
    expect(shadowNone._).toBe("shadow-none");
    expect(shadowNone.__cssTemplate).toBe(".shadow-none { box-shadow: 0 0 #0000; }");
  });

  it("generates shadowInner correctly", () => {
    expect(shadowInner._).toBe("shadow-inner");
    expect(shadowInner.__cssTemplate).toContain("inset");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = shadow`0 0 10px black`;
    expect(token.__cssTemplate).toContain("box-shadow: 0 0 10px black");
  });
});

describe("opacity utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates opacity0 correctly", () => {
    expect(opacity0._).toBe("opacity-0");
    expect(opacity0.__cssTemplate).toBe(".opacity-0 { opacity: 0; }");
  });

  it("generates opacity50 correctly", () => {
    expect(opacity50._).toBe("opacity-50");
    expect(opacity50.__cssTemplate).toBe(".opacity-50 { opacity: 0.5; }");
  });

  it("generates opacity100 correctly", () => {
    expect(opacity100._).toBe("opacity-100");
    expect(opacity100.__cssTemplate).toBe(".opacity-100 { opacity: 1; }");
  });

  it("supports arbitrary values via tagged template", () => {
    const token = opacity`0.33`;
    expect(token._).toBe("opacity-0_33");
    expect(token.__cssTemplate).toBe(".opacity-0_33 { opacity: 0.33; }");
  });
});

describe("cursor utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates cursorPointer correctly", () => {
    expect(cursorPointer._).toBe("cursor-pointer");
    expect(cursorPointer.__cssTemplate).toBe(".cursor-pointer { cursor: pointer; }");
  });

  it("generates cursorNotAllowed correctly", () => {
    expect(cursorNotAllowed._).toBe("cursor-not-allowed");
    expect(cursorNotAllowed.__cssTemplate).toBe(".cursor-not-allowed { cursor: not-allowed; }");
  });

  it("generates cursorGrab correctly", () => {
    expect(cursorGrab._).toBe("cursor-grab");
    expect(cursorGrab.__cssTemplate).toBe(".cursor-grab { cursor: grab; }");
  });

  it("generates cursorZoomIn correctly", () => {
    expect(cursorZoomIn._).toBe("cursor-zoom-in");
    expect(cursorZoomIn.__cssTemplate).toBe(".cursor-zoom-in { cursor: zoom-in; }");
  });
});

describe("pointer events utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates pointerEventsNone correctly", () => {
    expect(pointerEventsNone._).toBe("pointer-events-none");
    expect(pointerEventsNone.__cssTemplate).toBe(".pointer-events-none { pointer-events: none; }");
  });

  it("generates pointerEventsAuto correctly", () => {
    expect(pointerEventsAuto._).toBe("pointer-events-auto");
    expect(pointerEventsAuto.__cssTemplate).toBe(".pointer-events-auto { pointer-events: auto; }");
  });
});

describe("user select utilities", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("generates selectNone correctly", () => {
    expect(selectNone._).toBe("select-none");
    expect(selectNone.__cssTemplate).toBe(".select-none { user-select: none; }");
  });

  it("generates selectText correctly", () => {
    expect(selectText._).toBe("select-text");
    expect(selectText.__cssTemplate).toBe(".select-text { user-select: text; }");
  });

  it("generates selectAll correctly", () => {
    expect(selectAll._).toBe("select-all");
    expect(selectAll.__cssTemplate).toBe(".select-all { user-select: all; }");
  });
});

describe("effects namespace", () => {
  it("has border width tokens", () => {
    expect(effects.border).toBe(border);
    expect(effects.border0).toBe(border0);
    expect(effects.border2).toBe(border2);
  });

  it("has border radius tokens", () => {
    // effects.rounded is the tagged template function, not the base token
    expect(typeof effects.rounded).toBe("function");
    expect(effects.roundedLg).toBe(roundedLg);
    expect(effects.roundedFull).toBe(roundedFull);
  });

  it("has box shadow tokens", () => {
    // effects.shadow is the tagged template function, not the base token
    expect(typeof effects.shadow).toBe("function");
    expect(effects.shadowLg).toBe(shadowLg);
    expect(effects.shadowNone).toBe(shadowNone);
  });

  it("has opacity tokens", () => {
    expect(effects.opacity0).toBe(opacity0);
    expect(effects.opacity50).toBe(opacity50);
    expect(effects.opacity100).toBe(opacity100);
  });

  it("has cursor tokens", () => {
    expect(effects.cursorPointer).toBe(cursorPointer);
    expect(effects.cursorNotAllowed).toBe(cursorNotAllowed);
  });

  it("has tagged template functions", () => {
    expect(typeof effects.borderW).toBe("function");
    expect(typeof effects.rounded).toBe("function");
    expect(typeof effects.shadow).toBe("function");
    expect(typeof effects.opacity).toBe("function");
  });
});

describe("token properties", () => {
  it("has __kind property", () => {
    expect(border.__kind).toBe("style");
    expect(roundedLg.__kind).toBe("style");
    expect(opacity50.__kind).toBe("style");
  });

  it("has toString method", () => {
    expect(border.toString()).toBe("border");
    expect(roundedLg.toString()).toBe("rounded-lg");
    expect(opacity50.toString()).toBe("opacity-50");
  });
});
