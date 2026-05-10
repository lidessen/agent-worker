/**
 * Layout utilities: position, overflow, z-index, inset, etc.
 *
 * Usage:
 * ```ts
 * // Flat exports (recommended)
 * import { absolute, relative, top4, z10, overflowHidden } from "@semajsx/tailwind";
 * <div class={cx(absolute, top4, z10, overflowHidden)}>
 *
 * // Namespace access
 * import { layout } from "@semajsx/tailwind";
 * <div class={cx(layout.absolute, layout.top4, layout.z10)}>
 *
 * // Arbitrary values (tagged template)
 * import { top, left, z } from "@semajsx/tailwind";
 * <div class={cx(top`100px`, left`50%`, z`999`)}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createTaggedUtility, createMultiUtility } from "./core";
import { getConfig } from "./config";

// ============================================
// Scale definitions
// ============================================

// Position values
const positionValues = ["static", "fixed", "absolute", "relative", "sticky"] as const;

// Inset scale (top/right/bottom/left/inset)
const insetScale: Record<string, string> = {
  "0": "0px",
  px: "1px",
  "0.5": "0.125rem",
  "1": "0.25rem",
  "1.5": "0.375rem",
  "2": "0.5rem",
  "2.5": "0.625rem",
  "3": "0.75rem",
  "3.5": "0.875rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "7": "1.75rem",
  "8": "2rem",
  "9": "2.25rem",
  "10": "2.5rem",
  "11": "2.75rem",
  "12": "3rem",
  "14": "3.5rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "28": "7rem",
  "32": "8rem",
  "36": "9rem",
  "40": "10rem",
  "44": "11rem",
  "48": "12rem",
  "52": "13rem",
  "56": "14rem",
  "60": "15rem",
  "64": "16rem",
  "72": "18rem",
  "80": "20rem",
  "96": "24rem",
};

// Semantic inset values
const insetSemanticValues: Record<string, string> = {
  auto: "auto",
  full: "100%",
  half: "50%",
  third: "33.333333%",
  twoThirds: "66.666667%",
  quarter: "25%",
  threeQuarters: "75%",
};

// Z-index scale
const zIndexScale: Record<string, string> = {
  "0": "0",
  "10": "10",
  "20": "20",
  "30": "30",
  "40": "40",
  "50": "50",
  auto: "auto",
};

// Overflow values
const overflowValues = ["auto", "hidden", "clip", "visible", "scroll"] as const;

// Visibility values
const visibilityMap: Record<string, string> = {
  visible: "visible",
  invisible: "hidden",
  collapse: "collapse",
};

// ============================================
// Utility function creators
// ============================================

const topFn = createUtility("top", "top");
const rightFn = createUtility("right", "right");
const bottomFn = createUtility("bottom", "bottom");
const leftFn = createUtility("left", "left");
const zIndexFn = createUtility("z-index", "z");
const insetFn = createUtility("inset", "inset");
const insetXFn = createMultiUtility(["left", "right"], "inset-x");
const insetYFn = createMultiUtility(["top", "bottom"], "inset-y");

// ============================================
// Token generators
// ============================================

function generatePositionTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const value of positionValues) {
    const className = `${prefix}${value}`;
    tokens[value] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { position: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateInsetTokens(
  utilityFn: (value: string, valueName?: string) => StyleToken,
  prefix: string,
): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  // Number tokens: inset0, inset4, inset0_5, etc.
  for (const [key, value] of Object.entries(insetScale)) {
    // Convert decimal keys (0.5 -> 0_5) for valid JS identifiers
    const normalizedKey = key.replace(".", "_");
    const tokenName = `${prefix}${normalizedKey}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  // px token
  tokens[`${prefix}px`] = utilityFn("1px", "px");

  // Semantic tokens: insetAuto, insetFull, insetHalf
  for (const [key, value] of Object.entries(insetSemanticValues)) {
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `${prefix}${capKey}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  return tokens;
}

function generateZIndexTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(zIndexScale)) {
    if (key === "auto") {
      tokens.zAuto = zIndexFn(value, "auto");
    } else {
      tokens[`z${key}`] = zIndexFn(value, key);
    }
  }

  return tokens;
}

function generateOverflowTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  // Main overflow
  for (const value of overflowValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const className = `${prefix}overflow-${value}`;
    tokens[`overflow${capValue}`] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { overflow: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  // Overflow-x
  for (const value of overflowValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const className = `${prefix}overflow-x-${value}`;
    tokens[`overflowX${capValue}`] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { overflow-x: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  // Overflow-y
  for (const value of overflowValues) {
    const capValue = value.charAt(0).toUpperCase() + value.slice(1);
    const className = `${prefix}overflow-y-${value}`;
    tokens[`overflowY${capValue}`] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { overflow-y: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateVisibilityTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  for (const [key, value] of Object.entries(visibilityMap)) {
    const className = `${prefix}${key}`;
    tokens[key] = {
      __kind: "style",
      _: className,
      __cssTemplate: `.${className} { visibility: ${value}; }`,
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

const positionTokens = generatePositionTokens();
const topTokens = generateInsetTokens(topFn, "top");
const rightTokens = generateInsetTokens(rightFn, "right");
const bottomTokens = generateInsetTokens(bottomFn, "bottom");
const leftTokens = generateInsetTokens(leftFn, "left");
const insetTokens = generateInsetTokens(insetFn, "inset");
const insetXTokens = generateInsetTokens(insetXFn, "insetX");
const insetYTokens = generateInsetTokens(insetYFn, "insetY");
const zIndexTokens = generateZIndexTokens();
const overflowTokens = generateOverflowTokens();
const visibilityTokens = generateVisibilityTokens();

// ============================================
// Tagged template functions for arbitrary values
// ============================================

/** Top - arbitrary value: top`100px` */
export const top: TaggedUtilityFn = createTaggedUtility(topFn);

/** Right - arbitrary value: right`100px` */
export const right: TaggedUtilityFn = createTaggedUtility(rightFn);

/** Bottom - arbitrary value: bottom`100px` */
export const bottom: TaggedUtilityFn = createTaggedUtility(bottomFn);

/** Left - arbitrary value: left`100px` */
export const left: TaggedUtilityFn = createTaggedUtility(leftFn);

/** Inset - arbitrary value: inset`100px` */
export const inset: TaggedUtilityFn = createTaggedUtility(insetFn);

/** Inset X - arbitrary value: insetX`100px` */
export const insetX: TaggedUtilityFn = createTaggedUtility(insetXFn);

/** Inset Y - arbitrary value: insetY`100px` */
export const insetY: TaggedUtilityFn = createTaggedUtility(insetYFn);

/** Z-index - arbitrary value: z`999` */
export const z: TaggedUtilityFn = createTaggedUtility(zIndexFn);

// ============================================
// Individual token exports (flat) - Position
// ============================================

export const positionStatic: StyleToken = positionTokens.static!;
export const fixed: StyleToken = positionTokens.fixed!;
export const absolute: StyleToken = positionTokens.absolute!;
export const relative: StyleToken = positionTokens.relative!;
export const sticky: StyleToken = positionTokens.sticky!;

// ============================================
// Individual token exports (flat) - Top
// ============================================

export const top0: StyleToken = topTokens.top0!;
export const toppx: StyleToken = topTokens.toppx!;
export const top0_5: StyleToken = topTokens.top0_5!;
export const top1: StyleToken = topTokens.top1!;
export const top1_5: StyleToken = topTokens.top1_5!;
export const top2: StyleToken = topTokens.top2!;
export const top2_5: StyleToken = topTokens.top2_5!;
export const top3: StyleToken = topTokens.top3!;
export const top3_5: StyleToken = topTokens.top3_5!;
export const top4: StyleToken = topTokens.top4!;
export const top5: StyleToken = topTokens.top5!;
export const top6: StyleToken = topTokens.top6!;
export const top7: StyleToken = topTokens.top7!;
export const top8: StyleToken = topTokens.top8!;
export const top9: StyleToken = topTokens.top9!;
export const top10: StyleToken = topTokens.top10!;
export const top11: StyleToken = topTokens.top11!;
export const top12: StyleToken = topTokens.top12!;
export const top14: StyleToken = topTokens.top14!;
export const top16: StyleToken = topTokens.top16!;
export const top20: StyleToken = topTokens.top20!;
export const top24: StyleToken = topTokens.top24!;
export const top28: StyleToken = topTokens.top28!;
export const top32: StyleToken = topTokens.top32!;
export const top36: StyleToken = topTokens.top36!;
export const top40: StyleToken = topTokens.top40!;
export const top44: StyleToken = topTokens.top44!;
export const top48: StyleToken = topTokens.top48!;
export const top52: StyleToken = topTokens.top52!;
export const top56: StyleToken = topTokens.top56!;
export const top60: StyleToken = topTokens.top60!;
export const top64: StyleToken = topTokens.top64!;
export const top72: StyleToken = topTokens.top72!;
export const top80: StyleToken = topTokens.top80!;
export const top96: StyleToken = topTokens.top96!;
export const topAuto: StyleToken = topTokens.topAuto!;
export const topFull: StyleToken = topTokens.topFull!;
export const topHalf: StyleToken = topTokens.topHalf!;
export const topThird: StyleToken = topTokens.topThird!;
export const topTwoThirds: StyleToken = topTokens.topTwoThirds!;
export const topQuarter: StyleToken = topTokens.topQuarter!;
export const topThreeQuarters: StyleToken = topTokens.topThreeQuarters!;

// ============================================
// Individual token exports (flat) - Right
// ============================================

export const right0: StyleToken = rightTokens.right0!;
export const rightpx: StyleToken = rightTokens.rightpx!;
export const right0_5: StyleToken = rightTokens.right0_5!;
export const right1: StyleToken = rightTokens.right1!;
export const right1_5: StyleToken = rightTokens.right1_5!;
export const right2: StyleToken = rightTokens.right2!;
export const right2_5: StyleToken = rightTokens.right2_5!;
export const right3: StyleToken = rightTokens.right3!;
export const right3_5: StyleToken = rightTokens.right3_5!;
export const right4: StyleToken = rightTokens.right4!;
export const right5: StyleToken = rightTokens.right5!;
export const right6: StyleToken = rightTokens.right6!;
export const right7: StyleToken = rightTokens.right7!;
export const right8: StyleToken = rightTokens.right8!;
export const right9: StyleToken = rightTokens.right9!;
export const right10: StyleToken = rightTokens.right10!;
export const right11: StyleToken = rightTokens.right11!;
export const right12: StyleToken = rightTokens.right12!;
export const right14: StyleToken = rightTokens.right14!;
export const right16: StyleToken = rightTokens.right16!;
export const right20: StyleToken = rightTokens.right20!;
export const right24: StyleToken = rightTokens.right24!;
export const right28: StyleToken = rightTokens.right28!;
export const right32: StyleToken = rightTokens.right32!;
export const right36: StyleToken = rightTokens.right36!;
export const right40: StyleToken = rightTokens.right40!;
export const right44: StyleToken = rightTokens.right44!;
export const right48: StyleToken = rightTokens.right48!;
export const right52: StyleToken = rightTokens.right52!;
export const right56: StyleToken = rightTokens.right56!;
export const right60: StyleToken = rightTokens.right60!;
export const right64: StyleToken = rightTokens.right64!;
export const right72: StyleToken = rightTokens.right72!;
export const right80: StyleToken = rightTokens.right80!;
export const right96: StyleToken = rightTokens.right96!;
export const rightAuto: StyleToken = rightTokens.rightAuto!;
export const rightFull: StyleToken = rightTokens.rightFull!;
export const rightHalf: StyleToken = rightTokens.rightHalf!;
export const rightThird: StyleToken = rightTokens.rightThird!;
export const rightTwoThirds: StyleToken = rightTokens.rightTwoThirds!;
export const rightQuarter: StyleToken = rightTokens.rightQuarter!;
export const rightThreeQuarters: StyleToken = rightTokens.rightThreeQuarters!;

// ============================================
// Individual token exports (flat) - Bottom
// ============================================

export const bottom0: StyleToken = bottomTokens.bottom0!;
export const bottompx: StyleToken = bottomTokens.bottompx!;
export const bottom0_5: StyleToken = bottomTokens.bottom0_5!;
export const bottom1: StyleToken = bottomTokens.bottom1!;
export const bottom1_5: StyleToken = bottomTokens.bottom1_5!;
export const bottom2: StyleToken = bottomTokens.bottom2!;
export const bottom2_5: StyleToken = bottomTokens.bottom2_5!;
export const bottom3: StyleToken = bottomTokens.bottom3!;
export const bottom3_5: StyleToken = bottomTokens.bottom3_5!;
export const bottom4: StyleToken = bottomTokens.bottom4!;
export const bottom5: StyleToken = bottomTokens.bottom5!;
export const bottom6: StyleToken = bottomTokens.bottom6!;
export const bottom7: StyleToken = bottomTokens.bottom7!;
export const bottom8: StyleToken = bottomTokens.bottom8!;
export const bottom9: StyleToken = bottomTokens.bottom9!;
export const bottom10: StyleToken = bottomTokens.bottom10!;
export const bottom11: StyleToken = bottomTokens.bottom11!;
export const bottom12: StyleToken = bottomTokens.bottom12!;
export const bottom14: StyleToken = bottomTokens.bottom14!;
export const bottom16: StyleToken = bottomTokens.bottom16!;
export const bottom20: StyleToken = bottomTokens.bottom20!;
export const bottom24: StyleToken = bottomTokens.bottom24!;
export const bottom28: StyleToken = bottomTokens.bottom28!;
export const bottom32: StyleToken = bottomTokens.bottom32!;
export const bottom36: StyleToken = bottomTokens.bottom36!;
export const bottom40: StyleToken = bottomTokens.bottom40!;
export const bottom44: StyleToken = bottomTokens.bottom44!;
export const bottom48: StyleToken = bottomTokens.bottom48!;
export const bottom52: StyleToken = bottomTokens.bottom52!;
export const bottom56: StyleToken = bottomTokens.bottom56!;
export const bottom60: StyleToken = bottomTokens.bottom60!;
export const bottom64: StyleToken = bottomTokens.bottom64!;
export const bottom72: StyleToken = bottomTokens.bottom72!;
export const bottom80: StyleToken = bottomTokens.bottom80!;
export const bottom96: StyleToken = bottomTokens.bottom96!;
export const bottomAuto: StyleToken = bottomTokens.bottomAuto!;
export const bottomFull: StyleToken = bottomTokens.bottomFull!;
export const bottomHalf: StyleToken = bottomTokens.bottomHalf!;
export const bottomThird: StyleToken = bottomTokens.bottomThird!;
export const bottomTwoThirds: StyleToken = bottomTokens.bottomTwoThirds!;
export const bottomQuarter: StyleToken = bottomTokens.bottomQuarter!;
export const bottomThreeQuarters: StyleToken = bottomTokens.bottomThreeQuarters!;

// ============================================
// Individual token exports (flat) - Left
// ============================================

export const left0: StyleToken = leftTokens.left0!;
export const leftpx: StyleToken = leftTokens.leftpx!;
export const left0_5: StyleToken = leftTokens.left0_5!;
export const left1: StyleToken = leftTokens.left1!;
export const left1_5: StyleToken = leftTokens.left1_5!;
export const left2: StyleToken = leftTokens.left2!;
export const left2_5: StyleToken = leftTokens.left2_5!;
export const left3: StyleToken = leftTokens.left3!;
export const left3_5: StyleToken = leftTokens.left3_5!;
export const left4: StyleToken = leftTokens.left4!;
export const left5: StyleToken = leftTokens.left5!;
export const left6: StyleToken = leftTokens.left6!;
export const left7: StyleToken = leftTokens.left7!;
export const left8: StyleToken = leftTokens.left8!;
export const left9: StyleToken = leftTokens.left9!;
export const left10: StyleToken = leftTokens.left10!;
export const left11: StyleToken = leftTokens.left11!;
export const left12: StyleToken = leftTokens.left12!;
export const left14: StyleToken = leftTokens.left14!;
export const left16: StyleToken = leftTokens.left16!;
export const left20: StyleToken = leftTokens.left20!;
export const left24: StyleToken = leftTokens.left24!;
export const left28: StyleToken = leftTokens.left28!;
export const left32: StyleToken = leftTokens.left32!;
export const left36: StyleToken = leftTokens.left36!;
export const left40: StyleToken = leftTokens.left40!;
export const left44: StyleToken = leftTokens.left44!;
export const left48: StyleToken = leftTokens.left48!;
export const left52: StyleToken = leftTokens.left52!;
export const left56: StyleToken = leftTokens.left56!;
export const left60: StyleToken = leftTokens.left60!;
export const left64: StyleToken = leftTokens.left64!;
export const left72: StyleToken = leftTokens.left72!;
export const left80: StyleToken = leftTokens.left80!;
export const left96: StyleToken = leftTokens.left96!;
export const leftAuto: StyleToken = leftTokens.leftAuto!;
export const leftFull: StyleToken = leftTokens.leftFull!;
export const leftHalf: StyleToken = leftTokens.leftHalf!;
export const leftThird: StyleToken = leftTokens.leftThird!;
export const leftTwoThirds: StyleToken = leftTokens.leftTwoThirds!;
export const leftQuarter: StyleToken = leftTokens.leftQuarter!;
export const leftThreeQuarters: StyleToken = leftTokens.leftThreeQuarters!;

// ============================================
// Individual token exports (flat) - Inset
// ============================================

export const inset0: StyleToken = insetTokens.inset0!;
export const insetpx: StyleToken = insetTokens.insetpx!;
export const inset0_5: StyleToken = insetTokens.inset0_5!;
export const inset1: StyleToken = insetTokens.inset1!;
export const inset1_5: StyleToken = insetTokens.inset1_5!;
export const inset2: StyleToken = insetTokens.inset2!;
export const inset2_5: StyleToken = insetTokens.inset2_5!;
export const inset3: StyleToken = insetTokens.inset3!;
export const inset3_5: StyleToken = insetTokens.inset3_5!;
export const inset4: StyleToken = insetTokens.inset4!;
export const inset5: StyleToken = insetTokens.inset5!;
export const inset6: StyleToken = insetTokens.inset6!;
export const inset7: StyleToken = insetTokens.inset7!;
export const inset8: StyleToken = insetTokens.inset8!;
export const inset9: StyleToken = insetTokens.inset9!;
export const inset10: StyleToken = insetTokens.inset10!;
export const inset11: StyleToken = insetTokens.inset11!;
export const inset12: StyleToken = insetTokens.inset12!;
export const inset14: StyleToken = insetTokens.inset14!;
export const inset16: StyleToken = insetTokens.inset16!;
export const inset20: StyleToken = insetTokens.inset20!;
export const inset24: StyleToken = insetTokens.inset24!;
export const inset28: StyleToken = insetTokens.inset28!;
export const inset32: StyleToken = insetTokens.inset32!;
export const inset36: StyleToken = insetTokens.inset36!;
export const inset40: StyleToken = insetTokens.inset40!;
export const inset44: StyleToken = insetTokens.inset44!;
export const inset48: StyleToken = insetTokens.inset48!;
export const inset52: StyleToken = insetTokens.inset52!;
export const inset56: StyleToken = insetTokens.inset56!;
export const inset60: StyleToken = insetTokens.inset60!;
export const inset64: StyleToken = insetTokens.inset64!;
export const inset72: StyleToken = insetTokens.inset72!;
export const inset80: StyleToken = insetTokens.inset80!;
export const inset96: StyleToken = insetTokens.inset96!;
export const insetAuto: StyleToken = insetTokens.insetAuto!;
export const insetFull: StyleToken = insetTokens.insetFull!;
export const insetHalf: StyleToken = insetTokens.insetHalf!;
export const insetThird: StyleToken = insetTokens.insetThird!;
export const insetTwoThirds: StyleToken = insetTokens.insetTwoThirds!;
export const insetQuarter: StyleToken = insetTokens.insetQuarter!;
export const insetThreeQuarters: StyleToken = insetTokens.insetThreeQuarters!;

// ============================================
// Individual token exports (flat) - Inset X
// ============================================

export const insetX0: StyleToken = insetXTokens.insetX0!;
export const insetXpx: StyleToken = insetXTokens.insetXpx!;
export const insetX0_5: StyleToken = insetXTokens.insetX0_5!;
export const insetX1: StyleToken = insetXTokens.insetX1!;
export const insetX1_5: StyleToken = insetXTokens.insetX1_5!;
export const insetX2: StyleToken = insetXTokens.insetX2!;
export const insetX2_5: StyleToken = insetXTokens.insetX2_5!;
export const insetX3: StyleToken = insetXTokens.insetX3!;
export const insetX3_5: StyleToken = insetXTokens.insetX3_5!;
export const insetX4: StyleToken = insetXTokens.insetX4!;
export const insetX5: StyleToken = insetXTokens.insetX5!;
export const insetX6: StyleToken = insetXTokens.insetX6!;
export const insetX7: StyleToken = insetXTokens.insetX7!;
export const insetX8: StyleToken = insetXTokens.insetX8!;
export const insetX9: StyleToken = insetXTokens.insetX9!;
export const insetX10: StyleToken = insetXTokens.insetX10!;
export const insetX11: StyleToken = insetXTokens.insetX11!;
export const insetX12: StyleToken = insetXTokens.insetX12!;
export const insetX14: StyleToken = insetXTokens.insetX14!;
export const insetX16: StyleToken = insetXTokens.insetX16!;
export const insetX20: StyleToken = insetXTokens.insetX20!;
export const insetX24: StyleToken = insetXTokens.insetX24!;
export const insetX28: StyleToken = insetXTokens.insetX28!;
export const insetX32: StyleToken = insetXTokens.insetX32!;
export const insetX36: StyleToken = insetXTokens.insetX36!;
export const insetX40: StyleToken = insetXTokens.insetX40!;
export const insetX44: StyleToken = insetXTokens.insetX44!;
export const insetX48: StyleToken = insetXTokens.insetX48!;
export const insetX52: StyleToken = insetXTokens.insetX52!;
export const insetX56: StyleToken = insetXTokens.insetX56!;
export const insetX60: StyleToken = insetXTokens.insetX60!;
export const insetX64: StyleToken = insetXTokens.insetX64!;
export const insetX72: StyleToken = insetXTokens.insetX72!;
export const insetX80: StyleToken = insetXTokens.insetX80!;
export const insetX96: StyleToken = insetXTokens.insetX96!;
export const insetXAuto: StyleToken = insetXTokens.insetXAuto!;
export const insetXFull: StyleToken = insetXTokens.insetXFull!;
export const insetXHalf: StyleToken = insetXTokens.insetXHalf!;
export const insetXThird: StyleToken = insetXTokens.insetXThird!;
export const insetXTwoThirds: StyleToken = insetXTokens.insetXTwoThirds!;
export const insetXQuarter: StyleToken = insetXTokens.insetXQuarter!;
export const insetXThreeQuarters: StyleToken = insetXTokens.insetXThreeQuarters!;

// ============================================
// Individual token exports (flat) - Inset Y
// ============================================

export const insetY0: StyleToken = insetYTokens.insetY0!;
export const insetYpx: StyleToken = insetYTokens.insetYpx!;
export const insetY0_5: StyleToken = insetYTokens.insetY0_5!;
export const insetY1: StyleToken = insetYTokens.insetY1!;
export const insetY1_5: StyleToken = insetYTokens.insetY1_5!;
export const insetY2: StyleToken = insetYTokens.insetY2!;
export const insetY2_5: StyleToken = insetYTokens.insetY2_5!;
export const insetY3: StyleToken = insetYTokens.insetY3!;
export const insetY3_5: StyleToken = insetYTokens.insetY3_5!;
export const insetY4: StyleToken = insetYTokens.insetY4!;
export const insetY5: StyleToken = insetYTokens.insetY5!;
export const insetY6: StyleToken = insetYTokens.insetY6!;
export const insetY7: StyleToken = insetYTokens.insetY7!;
export const insetY8: StyleToken = insetYTokens.insetY8!;
export const insetY9: StyleToken = insetYTokens.insetY9!;
export const insetY10: StyleToken = insetYTokens.insetY10!;
export const insetY11: StyleToken = insetYTokens.insetY11!;
export const insetY12: StyleToken = insetYTokens.insetY12!;
export const insetY14: StyleToken = insetYTokens.insetY14!;
export const insetY16: StyleToken = insetYTokens.insetY16!;
export const insetY20: StyleToken = insetYTokens.insetY20!;
export const insetY24: StyleToken = insetYTokens.insetY24!;
export const insetY28: StyleToken = insetYTokens.insetY28!;
export const insetY32: StyleToken = insetYTokens.insetY32!;
export const insetY36: StyleToken = insetYTokens.insetY36!;
export const insetY40: StyleToken = insetYTokens.insetY40!;
export const insetY44: StyleToken = insetYTokens.insetY44!;
export const insetY48: StyleToken = insetYTokens.insetY48!;
export const insetY52: StyleToken = insetYTokens.insetY52!;
export const insetY56: StyleToken = insetYTokens.insetY56!;
export const insetY60: StyleToken = insetYTokens.insetY60!;
export const insetY64: StyleToken = insetYTokens.insetY64!;
export const insetY72: StyleToken = insetYTokens.insetY72!;
export const insetY80: StyleToken = insetYTokens.insetY80!;
export const insetY96: StyleToken = insetYTokens.insetY96!;
export const insetYAuto: StyleToken = insetYTokens.insetYAuto!;
export const insetYFull: StyleToken = insetYTokens.insetYFull!;
export const insetYHalf: StyleToken = insetYTokens.insetYHalf!;
export const insetYThird: StyleToken = insetYTokens.insetYThird!;
export const insetYTwoThirds: StyleToken = insetYTokens.insetYTwoThirds!;
export const insetYQuarter: StyleToken = insetYTokens.insetYQuarter!;
export const insetYThreeQuarters: StyleToken = insetYTokens.insetYThreeQuarters!;

// ============================================
// Individual token exports (flat) - Z-index
// ============================================

export const z0: StyleToken = zIndexTokens.z0!;
export const z10: StyleToken = zIndexTokens.z10!;
export const z20: StyleToken = zIndexTokens.z20!;
export const z30: StyleToken = zIndexTokens.z30!;
export const z40: StyleToken = zIndexTokens.z40!;
export const z50: StyleToken = zIndexTokens.z50!;
export const zAuto: StyleToken = zIndexTokens.zAuto!;

// ============================================
// Individual token exports (flat) - Overflow
// ============================================

export const overflowAuto: StyleToken = overflowTokens.overflowAuto!;
export const overflowHidden: StyleToken = overflowTokens.overflowHidden!;
export const overflowClip: StyleToken = overflowTokens.overflowClip!;
export const overflowVisible: StyleToken = overflowTokens.overflowVisible!;
export const overflowScroll: StyleToken = overflowTokens.overflowScroll!;
export const overflowXAuto: StyleToken = overflowTokens.overflowXAuto!;
export const overflowXHidden: StyleToken = overflowTokens.overflowXHidden!;
export const overflowXClip: StyleToken = overflowTokens.overflowXClip!;
export const overflowXVisible: StyleToken = overflowTokens.overflowXVisible!;
export const overflowXScroll: StyleToken = overflowTokens.overflowXScroll!;
export const overflowYAuto: StyleToken = overflowTokens.overflowYAuto!;
export const overflowYHidden: StyleToken = overflowTokens.overflowYHidden!;
export const overflowYClip: StyleToken = overflowTokens.overflowYClip!;
export const overflowYVisible: StyleToken = overflowTokens.overflowYVisible!;
export const overflowYScroll: StyleToken = overflowTokens.overflowYScroll!;

// ============================================
// Individual token exports (flat) - Visibility
// ============================================

export const visible: StyleToken = visibilityTokens.visible!;
export const invisible: StyleToken = visibilityTokens.invisible!;
export const collapse: StyleToken = visibilityTokens.collapse!;

// ============================================
// Namespace export (grouped)
// ============================================

/** All layout tokens in a namespace */
export const layout: Record<string, StyleToken | TaggedUtilityFn> = {
  // Position
  ...positionTokens,
  // Top
  ...topTokens,
  // Right
  ...rightTokens,
  // Bottom
  ...bottomTokens,
  // Left
  ...leftTokens,
  // Inset
  ...insetTokens,
  // Inset X
  ...insetXTokens,
  // Inset Y
  ...insetYTokens,
  // Z-index
  ...zIndexTokens,
  // Overflow
  ...overflowTokens,
  // Visibility
  ...visibilityTokens,
  // Arbitrary (tagged templates)
  top,
  right,
  bottom,
  left,
  inset,
  insetX,
  insetY,
  z,
};

// Type for the layout namespace
export type LayoutNamespace = typeof layout;

// Legacy type exports for backwards compatibility
export type LayoutValues = Record<string, StyleToken>;
export type LayoutGroup = LayoutNamespace;

// Legacy exports for backwards compatibility
export const layoutArb: Record<string, TaggedUtilityFn> = {
  top,
  right,
  bottom,
  left,
  inset,
  insetX,
  insetY,
  z,
};

// Legacy proxies (for backwards compatibility only)
export const position: Record<string, StyleToken> = positionTokens;
export const overflow: Record<string, StyleToken> = overflowTokens;
export const overflowX: Record<string, StyleToken> = overflowTokens;
export const overflowY: Record<string, StyleToken> = overflowTokens;
export const visibility: Record<string, StyleToken> = visibilityTokens;
export const zIndex: Record<string, StyleToken> = zIndexTokens;
