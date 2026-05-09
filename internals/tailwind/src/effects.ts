/**
 * Effects utilities: border, rounded, shadow, opacity, cursor
 *
 * Usage:
 * ```ts
 * // Flat exports (recommended)
 * import { rounded, roundedLg, roundedFull, shadow, shadowLg, opacity50 } from "@semajsx/tailwind";
 * <div class={cx(roundedLg, shadowLg, opacity50)}>
 *
 * // Namespace access
 * import { effects } from "@semajsx/tailwind";
 * <div class={cx(effects.roundedLg, effects.shadowLg, effects.opacity50)}>
 *
 * // Arbitrary values (tagged template)
 * import { rounded, shadow, opacity } from "@semajsx/tailwind";
 * <div class={cx(rounded`10px`, shadow`0 0 10px black`, opacity`0.33`)}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createTaggedUtility } from "./core";
import { getConfig } from "./config";

// ============================================
// Scale definitions
// ============================================

// Border width scale
const borderWidthScale: Record<string, string> = {
  "0": "0px",
  DEFAULT: "1px",
  "2": "2px",
  "4": "4px",
  "8": "8px",
};

// Border radius scale
const borderRadiusScale: Record<string, string> = {
  none: "0px",
  sm: "0.125rem",
  DEFAULT: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  full: "9999px",
};

// Box shadow scale
const boxShadowScale: Record<string, string> = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "0 0 #0000",
};

// Opacity scale
const opacityScale: Record<string, string> = {
  "0": "0",
  "5": "0.05",
  "10": "0.1",
  "15": "0.15",
  "20": "0.2",
  "25": "0.25",
  "30": "0.3",
  "35": "0.35",
  "40": "0.4",
  "45": "0.45",
  "50": "0.5",
  "55": "0.55",
  "60": "0.6",
  "65": "0.65",
  "70": "0.7",
  "75": "0.75",
  "80": "0.8",
  "85": "0.85",
  "90": "0.9",
  "95": "0.95",
  "100": "1",
};

// Border style values
const borderStyleValues = ["solid", "dashed", "dotted", "double", "hidden", "none"] as const;

// Cursor values
const cursorValues: Record<string, string> = {
  auto: "auto",
  default: "default",
  pointer: "pointer",
  wait: "wait",
  text: "text",
  move: "move",
  help: "help",
  notAllowed: "not-allowed",
  none: "none",
  contextMenu: "context-menu",
  progress: "progress",
  cell: "cell",
  crosshair: "crosshair",
  verticalText: "vertical-text",
  alias: "alias",
  copy: "copy",
  noDrop: "no-drop",
  grab: "grab",
  grabbing: "grabbing",
  allScroll: "all-scroll",
  colResize: "col-resize",
  rowResize: "row-resize",
  nResize: "n-resize",
  eResize: "e-resize",
  sResize: "s-resize",
  wResize: "w-resize",
  neResize: "ne-resize",
  nwResize: "nw-resize",
  seResize: "se-resize",
  swResize: "sw-resize",
  ewResize: "ew-resize",
  nsResize: "ns-resize",
  neswResize: "nesw-resize",
  nwseResize: "nwse-resize",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
};

// Cursor class name mapping (camelCase to kebab-case)
const cursorClassMap: Record<string, string> = {
  notAllowed: "not-allowed",
  contextMenu: "context-menu",
  verticalText: "vertical-text",
  noDrop: "no-drop",
  allScroll: "all-scroll",
  colResize: "col-resize",
  rowResize: "row-resize",
  nResize: "n-resize",
  eResize: "e-resize",
  sResize: "s-resize",
  wResize: "w-resize",
  neResize: "ne-resize",
  nwResize: "nw-resize",
  seResize: "se-resize",
  swResize: "sw-resize",
  ewResize: "ew-resize",
  nsResize: "ns-resize",
  neswResize: "nesw-resize",
  nwseResize: "nwse-resize",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
};

// Pointer events values
const pointerEventsValues = ["none", "auto"] as const;

// User select values
const userSelectValues = ["none", "text", "all", "auto"] as const;

// ============================================
// Utility function creators
// ============================================

const borderWidthFn = createUtility("border-width", "border");
const borderTopWidthFn = createUtility("border-top-width", "border-t");
const borderRightWidthFn = createUtility("border-right-width", "border-r");
const borderBottomWidthFn = createUtility("border-bottom-width", "border-b");
const borderLeftWidthFn = createUtility("border-left-width", "border-l");
const borderRadiusFn = createUtility("border-radius", "rounded");
const boxShadowFn = createUtility("box-shadow", "shadow");
const opacityFn = createUtility("opacity", "opacity");

// ============================================
// Token generators
// ============================================

function generateBorderWidthTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const [key, value] of Object.entries(borderWidthScale)) {
    if (key === "DEFAULT") {
      // border (default 1px)
      tokens.border = {
        __kind: "style",
        _: `${prefix}border`,
        __cssTemplate: `.${prefix}border { border-width: ${value}; }`,
        toString() {
          return this._;
        },
      };
    } else {
      // border0, border2, border4, border8
      const tokenName = `border${key}`;
      const className = `${prefix}border-${key}`;
      tokens[tokenName] = {
        __kind: "style",
        _: className,
        __cssTemplate: `.${className} { border-width: ${value}; }`,
        toString() {
          return this._;
        },
      };
    }
  }

  return tokens;
}

function generateSideBorderTokens(
  side: "t" | "r" | "b" | "l",
  property: string,
  _utilityFn: (value: string, valueName?: string) => StyleToken,
): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";
  const sideName = { t: "Top", r: "Right", b: "Bottom", l: "Left" }[side];

  for (const [key, value] of Object.entries(borderWidthScale)) {
    if (key === "DEFAULT") {
      // borderT, borderR, borderB, borderL (default 1px)
      tokens[`border${sideName}`] = {
        __kind: "style",
        _: `${prefix}border-${side}`,
        __cssTemplate: `.${prefix}border-${side} { ${property}: ${value}; }`,
        toString() {
          return this._;
        },
      };
    } else {
      // borderT0, borderT2, borderR4, borderB8, etc.
      const tokenName = `border${sideName}${key}`;
      const className = `${prefix}border-${side}-${key}`;
      tokens[tokenName] = {
        __kind: "style",
        _: className,
        __cssTemplate: `.${className} { ${property}: ${value}; }`,
        toString() {
          return this._;
        },
      };
    }
  }

  return tokens;
}

function generateBorderRadiusTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const [key, value] of Object.entries(borderRadiusScale)) {
    if (key === "DEFAULT") {
      // rounded (default 0.25rem)
      tokens.rounded = {
        __kind: "style",
        _: `${prefix}rounded`,
        __cssTemplate: `.${prefix}rounded { border-radius: ${value}; }`,
        toString() {
          return this._;
        },
      };
    } else {
      // roundedNone, roundedSm, roundedLg, rounded2xl, roundedFull
      const capKey = key.match(/^\d/) ? key : key.charAt(0).toUpperCase() + key.slice(1);
      const tokenName = `rounded${capKey}`;
      const className = `${prefix}rounded-${key}`;
      tokens[tokenName] = {
        __kind: "style",
        _: className,
        __cssTemplate: `.${className} { border-radius: ${value}; }`,
        toString() {
          return this._;
        },
      };
    }
  }

  return tokens;
}

function generateBoxShadowTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const [key, value] of Object.entries(boxShadowScale)) {
    if (key === "DEFAULT") {
      // shadow (default)
      tokens.shadow = {
        __kind: "style",
        _: `${prefix}shadow`,
        __cssTemplate: `.${prefix}shadow { box-shadow: ${value}; }`,
        toString() {
          return this._;
        },
      };
    } else {
      // shadowSm, shadowMd, shadowLg, shadow2xl, shadowInner, shadowNone
      const capKey = key.match(/^\d/) ? key : key.charAt(0).toUpperCase() + key.slice(1);
      const tokenName = `shadow${capKey}`;
      const className = `${prefix}shadow-${key}`;
      tokens[tokenName] = {
        __kind: "style",
        _: className,
        __cssTemplate: `.${className} { box-shadow: ${value}; }`,
        toString() {
          return this._;
        },
      };
    }
  }

  return tokens;
}

function generateOpacityTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(opacityScale)) {
    const tokenName = `opacity${key}`;
    tokens[tokenName] = opacityFn(value, key);
  }

  return tokens;
}

function generateBorderStyleTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const value of borderStyleValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const tokenName = `border${capValue}`;
    const className = `${prefix}border-${value}`;
    tokens[tokenName] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { border-style: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateCursorTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const [key, value] of Object.entries(cursorValues)) {
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `cursor${capKey}`;
    const cssClassName = cursorClassMap[key] ?? key;
    const className = `${prefix}cursor-${cssClassName}`;
    tokens[tokenName] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { cursor: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generatePointerEventsTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const value of pointerEventsValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const tokenName = `pointerEvents${capValue}`;
    const className = `${prefix}pointer-events-${value}`;
    tokens[tokenName] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { pointer-events: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateUserSelectTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const value of userSelectValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const tokenName = `select${capValue}`;
    const className = `${prefix}select-${value}`;
    tokens[tokenName] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { user-select: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

// ============================================
// Generate all tokens
// ============================================

const borderWidthTokens = generateBorderWidthTokens();
const borderTopTokens = generateSideBorderTokens("t", "border-top-width", borderTopWidthFn);
const borderRightTokens = generateSideBorderTokens("r", "border-right-width", borderRightWidthFn);
const borderBottomTokens = generateSideBorderTokens(
  "b",
  "border-bottom-width",
  borderBottomWidthFn,
);
const borderLeftTokens = generateSideBorderTokens("l", "border-left-width", borderLeftWidthFn);
const borderRadiusTokens = generateBorderRadiusTokens();
const boxShadowTokens = generateBoxShadowTokens();
const opacityTokens = generateOpacityTokens();
const borderStyleTokens = generateBorderStyleTokens();
const cursorTokens = generateCursorTokens();
const pointerEventsTokens = generatePointerEventsTokens();
const userSelectTokens = generateUserSelectTokens();

// ============================================
// Tagged template functions for arbitrary values
// ============================================

/** Border width - arbitrary value: borderW`3px` */
export const borderW: TaggedUtilityFn = createTaggedUtility(borderWidthFn);

/** Border radius - arbitrary value: rounded`10px` */
export const rounded: TaggedUtilityFn = createTaggedUtility(borderRadiusFn);

/** Box shadow - arbitrary value: shadow`0 0 10px black` */
export const shadow: TaggedUtilityFn = createTaggedUtility(boxShadowFn);

/** Opacity - arbitrary value: opacity`0.33` */
export const opacity: TaggedUtilityFn = createTaggedUtility(opacityFn);

// ============================================
// Individual token exports (flat) - Border Width
// ============================================

export const border: StyleToken = borderWidthTokens.border!;
export const border0: StyleToken = borderWidthTokens.border0!;
export const border2: StyleToken = borderWidthTokens.border2!;
export const border4: StyleToken = borderWidthTokens.border4!;
export const border8: StyleToken = borderWidthTokens.border8!;

// Border Top
export const borderTop: StyleToken = borderTopTokens.borderTop!;
export const borderTop0: StyleToken = borderTopTokens.borderTop0!;
export const borderTop2: StyleToken = borderTopTokens.borderTop2!;
export const borderTop4: StyleToken = borderTopTokens.borderTop4!;
export const borderTop8: StyleToken = borderTopTokens.borderTop8!;

// Border Right
export const borderRight: StyleToken = borderRightTokens.borderRight!;
export const borderRight0: StyleToken = borderRightTokens.borderRight0!;
export const borderRight2: StyleToken = borderRightTokens.borderRight2!;
export const borderRight4: StyleToken = borderRightTokens.borderRight4!;
export const borderRight8: StyleToken = borderRightTokens.borderRight8!;

// Border Bottom
export const borderBottom: StyleToken = borderBottomTokens.borderBottom!;
export const borderBottom0: StyleToken = borderBottomTokens.borderBottom0!;
export const borderBottom2: StyleToken = borderBottomTokens.borderBottom2!;
export const borderBottom4: StyleToken = borderBottomTokens.borderBottom4!;
export const borderBottom8: StyleToken = borderBottomTokens.borderBottom8!;

// Border Left
export const borderLeft: StyleToken = borderLeftTokens.borderLeft!;
export const borderLeft0: StyleToken = borderLeftTokens.borderLeft0!;
export const borderLeft2: StyleToken = borderLeftTokens.borderLeft2!;
export const borderLeft4: StyleToken = borderLeftTokens.borderLeft4!;
export const borderLeft8: StyleToken = borderLeftTokens.borderLeft8!;

// Short aliases (Tailwind naming: border-t, border-b, etc.)
export const borderT: StyleToken = borderTop;
export const borderT0: StyleToken = borderTop0;
export const borderT2: StyleToken = borderTop2;
export const borderT4: StyleToken = borderTop4;
export const borderT8: StyleToken = borderTop8;

export const borderR: StyleToken = borderRight;
export const borderR0: StyleToken = borderRight0;
export const borderR2: StyleToken = borderRight2;
export const borderR4: StyleToken = borderRight4;
export const borderR8: StyleToken = borderRight8;

export const borderB: StyleToken = borderBottom;
export const borderB0: StyleToken = borderBottom0;
export const borderB2: StyleToken = borderBottom2;
export const borderB4: StyleToken = borderBottom4;
export const borderB8: StyleToken = borderBottom8;

export const borderL: StyleToken = borderLeft;
export const borderL0: StyleToken = borderLeft0;
export const borderL2: StyleToken = borderLeft2;
export const borderL4: StyleToken = borderLeft4;
export const borderL8: StyleToken = borderLeft8;

// ============================================
// Individual token exports (flat) - Border Radius
// ============================================

export const roundedBase: StyleToken = borderRadiusTokens.rounded!;
export const roundedNone: StyleToken = borderRadiusTokens.roundedNone!;
export const roundedSm: StyleToken = borderRadiusTokens.roundedSm!;
export const roundedMd: StyleToken = borderRadiusTokens.roundedMd!;
export const roundedLg: StyleToken = borderRadiusTokens.roundedLg!;
export const roundedXl: StyleToken = borderRadiusTokens.roundedXl!;
export const rounded2xl: StyleToken = borderRadiusTokens.rounded2xl!;
export const rounded3xl: StyleToken = borderRadiusTokens.rounded3xl!;
export const roundedFull: StyleToken = borderRadiusTokens.roundedFull!;

// ============================================
// Individual token exports (flat) - Box Shadow
// ============================================

export const shadowBase: StyleToken = boxShadowTokens.shadow!;
export const shadowSm: StyleToken = boxShadowTokens.shadowSm!;
export const shadowMd: StyleToken = boxShadowTokens.shadowMd!;
export const shadowLg: StyleToken = boxShadowTokens.shadowLg!;
export const shadowXl: StyleToken = boxShadowTokens.shadowXl!;
export const shadow2xl: StyleToken = boxShadowTokens.shadow2xl!;
export const shadowInner: StyleToken = boxShadowTokens.shadowInner!;
export const shadowNone: StyleToken = boxShadowTokens.shadowNone!;

// ============================================
// Individual token exports (flat) - Opacity
// ============================================

export const opacity0: StyleToken = opacityTokens.opacity0!;
export const opacity5: StyleToken = opacityTokens.opacity5!;
export const opacity10: StyleToken = opacityTokens.opacity10!;
export const opacity15: StyleToken = opacityTokens.opacity15!;
export const opacity20: StyleToken = opacityTokens.opacity20!;
export const opacity25: StyleToken = opacityTokens.opacity25!;
export const opacity30: StyleToken = opacityTokens.opacity30!;
export const opacity35: StyleToken = opacityTokens.opacity35!;
export const opacity40: StyleToken = opacityTokens.opacity40!;
export const opacity45: StyleToken = opacityTokens.opacity45!;
export const opacity50: StyleToken = opacityTokens.opacity50!;
export const opacity55: StyleToken = opacityTokens.opacity55!;
export const opacity60: StyleToken = opacityTokens.opacity60!;
export const opacity65: StyleToken = opacityTokens.opacity65!;
export const opacity70: StyleToken = opacityTokens.opacity70!;
export const opacity75: StyleToken = opacityTokens.opacity75!;
export const opacity80: StyleToken = opacityTokens.opacity80!;
export const opacity85: StyleToken = opacityTokens.opacity85!;
export const opacity90: StyleToken = opacityTokens.opacity90!;
export const opacity95: StyleToken = opacityTokens.opacity95!;
export const opacity100: StyleToken = opacityTokens.opacity100!;

// ============================================
// Individual token exports (flat) - Border Style
// ============================================

export const borderSolid: StyleToken = borderStyleTokens.borderSolid!;
export const borderDashed: StyleToken = borderStyleTokens.borderDashed!;
export const borderDotted: StyleToken = borderStyleTokens.borderDotted!;
export const borderDouble: StyleToken = borderStyleTokens.borderDouble!;
export const borderHidden: StyleToken = borderStyleTokens.borderHidden!;
export const borderNone: StyleToken = borderStyleTokens.borderNone!;

// ============================================
// Individual token exports (flat) - Cursor
// ============================================

export const cursorAuto: StyleToken = cursorTokens.cursorAuto!;
export const cursorDefault: StyleToken = cursorTokens.cursorDefault!;
export const cursorPointer: StyleToken = cursorTokens.cursorPointer!;
export const cursorWait: StyleToken = cursorTokens.cursorWait!;
export const cursorText: StyleToken = cursorTokens.cursorText!;
export const cursorMove: StyleToken = cursorTokens.cursorMove!;
export const cursorHelp: StyleToken = cursorTokens.cursorHelp!;
export const cursorNotAllowed: StyleToken = cursorTokens.cursorNotAllowed!;
export const cursorNone: StyleToken = cursorTokens.cursorNone!;
export const cursorContextMenu: StyleToken = cursorTokens.cursorContextMenu!;
export const cursorProgress: StyleToken = cursorTokens.cursorProgress!;
export const cursorCell: StyleToken = cursorTokens.cursorCell!;
export const cursorCrosshair: StyleToken = cursorTokens.cursorCrosshair!;
export const cursorVerticalText: StyleToken = cursorTokens.cursorVerticalText!;
export const cursorAlias: StyleToken = cursorTokens.cursorAlias!;
export const cursorCopy: StyleToken = cursorTokens.cursorCopy!;
export const cursorNoDrop: StyleToken = cursorTokens.cursorNoDrop!;
export const cursorGrab: StyleToken = cursorTokens.cursorGrab!;
export const cursorGrabbing: StyleToken = cursorTokens.cursorGrabbing!;
export const cursorAllScroll: StyleToken = cursorTokens.cursorAllScroll!;
export const cursorColResize: StyleToken = cursorTokens.cursorColResize!;
export const cursorRowResize: StyleToken = cursorTokens.cursorRowResize!;
export const cursorNResize: StyleToken = cursorTokens.cursorNResize!;
export const cursorEResize: StyleToken = cursorTokens.cursorEResize!;
export const cursorSResize: StyleToken = cursorTokens.cursorSResize!;
export const cursorWResize: StyleToken = cursorTokens.cursorWResize!;
export const cursorNeResize: StyleToken = cursorTokens.cursorNeResize!;
export const cursorNwResize: StyleToken = cursorTokens.cursorNwResize!;
export const cursorSeResize: StyleToken = cursorTokens.cursorSeResize!;
export const cursorSwResize: StyleToken = cursorTokens.cursorSwResize!;
export const cursorEwResize: StyleToken = cursorTokens.cursorEwResize!;
export const cursorNsResize: StyleToken = cursorTokens.cursorNsResize!;
export const cursorNeswResize: StyleToken = cursorTokens.cursorNeswResize!;
export const cursorNwseResize: StyleToken = cursorTokens.cursorNwseResize!;
export const cursorZoomIn: StyleToken = cursorTokens.cursorZoomIn!;
export const cursorZoomOut: StyleToken = cursorTokens.cursorZoomOut!;

// ============================================
// Individual token exports (flat) - Pointer Events
// ============================================

export const pointerEventsNone: StyleToken = pointerEventsTokens.pointerEventsNone!;
export const pointerEventsAuto: StyleToken = pointerEventsTokens.pointerEventsAuto!;

// ============================================
// Individual token exports (flat) - User Select
// ============================================

export const selectNone: StyleToken = userSelectTokens.selectNone!;
export const selectText: StyleToken = userSelectTokens.selectText!;
export const selectAll: StyleToken = userSelectTokens.selectAll!;
export const selectAuto: StyleToken = userSelectTokens.selectAuto!;

// ============================================
// Namespace export (grouped)
// ============================================

/** All effects tokens in a namespace */
export const effects: Record<string, StyleToken | TaggedUtilityFn> = {
  // Border width
  ...borderWidthTokens,
  // Border side widths
  ...borderTopTokens,
  ...borderRightTokens,
  ...borderBottomTokens,
  ...borderLeftTokens,
  // Short aliases
  borderT,
  borderT0,
  borderT2,
  borderT4,
  borderT8,
  borderR,
  borderR0,
  borderR2,
  borderR4,
  borderR8,
  borderB,
  borderB0,
  borderB2,
  borderB4,
  borderB8,
  borderL,
  borderL0,
  borderL2,
  borderL4,
  borderL8,
  // Border radius
  ...borderRadiusTokens,
  // Box shadow
  ...boxShadowTokens,
  // Opacity
  ...opacityTokens,
  // Border style
  ...borderStyleTokens,
  // Cursor
  ...cursorTokens,
  // Pointer events
  ...pointerEventsTokens,
  // User select
  ...userSelectTokens,
  // Arbitrary (tagged templates)
  borderW,
  rounded,
  shadow,
  opacity,
};

// Type for the effects namespace
export type EffectsNamespace = typeof effects;

// Legacy type exports for backwards compatibility
export type EffectsValues = Record<string, StyleToken>;
export type EffectsGroup = EffectsNamespace;

// Legacy exports for backwards compatibility
export const effectsArb: Record<string, TaggedUtilityFn> = {
  borderW,
  rounded,
  shadow,
  opacity,
};

// Legacy proxies (for backwards compatibility only)
export const borderWidth: Record<string, StyleToken> = borderWidthTokens;
export const borderRadius: Record<string, StyleToken> = borderRadiusTokens;
export const borderStyle: Record<string, StyleToken> = borderStyleTokens;
export const boxShadow: Record<string, StyleToken> = boxShadowTokens;
export const cursor: Record<string, StyleToken> = cursorTokens;
export const pointerEvents: Record<string, StyleToken> = pointerEventsTokens;
export const userSelect: Record<string, StyleToken> = userSelectTokens;
