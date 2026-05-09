/**
 * Sizing utilities: width, height, min/max width/height
 *
 * Usage:
 * ```ts
 * // Merged naming (recommended)
 * import { w4, wFull, wHalf, h4, hScreen, maxWLg } from "@semajsx/tailwind";
 * <div class={[w4, hFull]}>
 *
 * // Namespace access
 * import { sizing } from "@semajsx/tailwind";
 * <div class={[sizing.w4, sizing.hScreen]}>
 *
 * // Arbitrary values (tagged template)
 * import { w, h, maxW } from "@semajsx/tailwind";
 * <div class={[w`300px`, h`calc(100vh - 64px)`, maxW`800px`]}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createTaggedUtility } from "./core";

// ============================================
// Scale definitions
// ============================================

// Spacing-based scale (numbers)
const spacingScale: Record<string, string> = {
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

// Fraction values with semantic names
const fractionScale: Record<string, string> = {
  half: "50%",
  third: "33.333333%",
  twoThirds: "66.666667%",
  quarter: "25%",
  threeQuarters: "75%",
  fifth: "20%",
  twoFifths: "40%",
  threeFifths: "60%",
  fourFifths: "80%",
  sixth: "16.666667%",
  fiveSixths: "83.333333%",
};

// Semantic values
const semanticScale: Record<string, string> = {
  auto: "auto",
  full: "100%",
  screen: "100vw",
  svw: "100svw",
  lvw: "100lvw",
  dvw: "100dvw",
  min: "min-content",
  max: "max-content",
  fit: "fit-content",
};

// Height-specific semantic values
const heightSemanticScale: Record<string, string> = {
  auto: "auto",
  full: "100%",
  screen: "100vh",
  svh: "100svh",
  lvh: "100lvh",
  dvh: "100dvh",
  min: "min-content",
  max: "max-content",
  fit: "fit-content",
};

// Max-width named sizes
const maxWidthNamedScale: Record<string, string> = {
  xs: "20rem",
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
  "5xl": "64rem",
  "6xl": "72rem",
  "7xl": "80rem",
  prose: "65ch",
};

// ============================================
// Utility function creators
// ============================================

const widthFn = createUtility("width", "w");
const minWidthFn = createUtility("min-width", "min-w");
const maxWidthFn = createUtility("max-width", "max-w");
const heightFn = createUtility("height", "h");
const minHeightFn = createUtility("min-height", "min-h");
const maxHeightFn = createUtility("max-height", "max-h");
const sizeFnBase = createUtility("width", "size");

// Size utility (sets both width and height)
const sizeUtilityFn = (value: string, valueName?: string): StyleToken => {
  const token = sizeFnBase(value, valueName);
  return {
    ...token,
    __cssTemplate: `.${token._} { width: ${value}; height: ${value}; }`,
  };
};

// ============================================
// Token generators
// ============================================

type UtilityFn = (value: string, valueName?: string) => StyleToken;

function generateSpacingTokens(prefix: string, utilityFn: UtilityFn): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(spacingScale)) {
    // Replace decimal point with underscore for valid JS identifiers: 0.5 -> 0_5
    const safeKey = key.replace(".", "_");
    const tokenName = `${prefix}${safeKey}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  return tokens;
}

function generateFractionTokens(prefix: string, utilityFn: UtilityFn): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(fractionScale)) {
    // Capitalize first letter: half -> Half
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `${prefix}${capKey}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  return tokens;
}

function generateSemanticTokens(
  prefix: string,
  utilityFn: UtilityFn,
  scale: Record<string, string>,
): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(scale)) {
    // Capitalize first letter: full -> Full
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `${prefix}${capKey}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  return tokens;
}

function generateMaxWidthNamedTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(maxWidthNamedScale)) {
    // Capitalize: sm -> Sm, 2xl -> 2xl (keep as is for numbers)
    const capKey = key.match(/^\d/) ? key : key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `maxW${capKey}`;
    tokens[tokenName] = maxWidthFn(value, key);
  }

  // Also add basic semantic values
  tokens.maxW0 = maxWidthFn("0px", "0");
  tokens.maxWFull = maxWidthFn("100%", "full");
  tokens.maxWMin = maxWidthFn("min-content", "min");
  tokens.maxWMax = maxWidthFn("max-content", "max");
  tokens.maxWFit = maxWidthFn("fit-content", "fit");

  return tokens;
}

function generateMinWidthTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  tokens.minW0 = minWidthFn("0px", "0");
  tokens.minWFull = minWidthFn("100%", "full");
  tokens.minWMin = minWidthFn("min-content", "min");
  tokens.minWMax = minWidthFn("max-content", "max");
  tokens.minWFit = minWidthFn("fit-content", "fit");

  return tokens;
}

function generateMinHeightTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  tokens.minH0 = minHeightFn("0px", "0");
  tokens.minHFull = minHeightFn("100%", "full");
  tokens.minHScreen = minHeightFn("100vh", "screen");
  tokens.minHSvh = minHeightFn("100svh", "svh");
  tokens.minHLvh = minHeightFn("100lvh", "lvh");
  tokens.minHDvh = minHeightFn("100dvh", "dvh");
  tokens.minHMin = minHeightFn("min-content", "min");
  tokens.minHMax = minHeightFn("max-content", "max");
  tokens.minHFit = minHeightFn("fit-content", "fit");

  return tokens;
}

function generateMaxHeightTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  tokens.maxH0 = maxHeightFn("0px", "0");
  tokens.maxHFull = maxHeightFn("100%", "full");
  tokens.maxHScreen = maxHeightFn("100vh", "screen");
  tokens.maxHSvh = maxHeightFn("100svh", "svh");
  tokens.maxHLvh = maxHeightFn("100lvh", "lvh");
  tokens.maxHDvh = maxHeightFn("100dvh", "dvh");
  tokens.maxHMin = maxHeightFn("min-content", "min");
  tokens.maxHMax = maxHeightFn("max-content", "max");
  tokens.maxHFit = maxHeightFn("fit-content", "fit");

  return tokens;
}

// ============================================
// Generate all tokens
// ============================================

// Width tokens: w0, w1, w2, w4, ..., wFull, wHalf, ...
const widthTokens: Record<string, StyleToken> = {
  ...generateSpacingTokens("w", widthFn),
  ...generateFractionTokens("w", widthFn),
  ...generateSemanticTokens("w", widthFn, semanticScale),
};

// Height tokens: h0, h1, h2, h4, ..., hFull, hScreen, ...
const heightTokens: Record<string, StyleToken> = {
  ...generateSpacingTokens("h", heightFn),
  ...generateFractionTokens("h", heightFn),
  ...generateSemanticTokens("h", heightFn, heightSemanticScale),
};

// Size tokens: size0, size4, sizeFull, ...
const sizeTokens: Record<string, StyleToken> = {
  ...generateSpacingTokens("size", sizeUtilityFn),
  ...generateFractionTokens("size", sizeUtilityFn),
  ...generateSemanticTokens("size", sizeUtilityFn, semanticScale),
};

// Min/max width tokens
const minWidthTokens = generateMinWidthTokens();
const maxWidthTokens = generateMaxWidthNamedTokens();

// Min/max height tokens
const minHeightTokens = generateMinHeightTokens();
const maxHeightTokens = generateMaxHeightTokens();

// ============================================
// Tagged template functions for arbitrary values
// ============================================

/** Width - arbitrary value: w`300px` */
export const w: TaggedUtilityFn = createTaggedUtility(widthFn);

/** Height - arbitrary value: h`100vh` */
export const h: TaggedUtilityFn = createTaggedUtility(heightFn);

/** Min-width - arbitrary value: minW`200px` */
export const minW: TaggedUtilityFn = createTaggedUtility(minWidthFn);

/** Max-width - arbitrary value: maxW`800px` */
export const maxW: TaggedUtilityFn = createTaggedUtility(maxWidthFn);

/** Min-height - arbitrary value: minH`100px` */
export const minH: TaggedUtilityFn = createTaggedUtility(minHeightFn);

/** Max-height - arbitrary value: maxH`500px` */
export const maxH: TaggedUtilityFn = createTaggedUtility(maxHeightFn);

/** Size - arbitrary value: size`48px` (sets both width and height) */
export const size: TaggedUtilityFn = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
): StyleToken => {
  let result = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + (strings[i + 1] ?? "");
  }
  return sizeUtilityFn(result);
}) as TaggedUtilityFn;

// ============================================
// Individual token exports (flat)
// ============================================

// Width
export const w0: StyleToken = widthTokens.w0!;
export const wpx: StyleToken = widthTokens.wpx!;
export const w0_5: StyleToken = widthTokens.w0_5!;
export const w1: StyleToken = widthTokens.w1!;
export const w1_5: StyleToken = widthTokens.w1_5!;
export const w2: StyleToken = widthTokens.w2!;
export const w2_5: StyleToken = widthTokens.w2_5!;
export const w3: StyleToken = widthTokens.w3!;
export const w3_5: StyleToken = widthTokens.w3_5!;
export const w4: StyleToken = widthTokens.w4!;
export const w5: StyleToken = widthTokens.w5!;
export const w6: StyleToken = widthTokens.w6!;
export const w7: StyleToken = widthTokens.w7!;
export const w8: StyleToken = widthTokens.w8!;
export const w9: StyleToken = widthTokens.w9!;
export const w10: StyleToken = widthTokens.w10!;
export const w11: StyleToken = widthTokens.w11!;
export const w12: StyleToken = widthTokens.w12!;
export const w14: StyleToken = widthTokens.w14!;
export const w16: StyleToken = widthTokens.w16!;
export const w20: StyleToken = widthTokens.w20!;
export const w24: StyleToken = widthTokens.w24!;
export const w28: StyleToken = widthTokens.w28!;
export const w32: StyleToken = widthTokens.w32!;
export const w36: StyleToken = widthTokens.w36!;
export const w40: StyleToken = widthTokens.w40!;
export const w44: StyleToken = widthTokens.w44!;
export const w48: StyleToken = widthTokens.w48!;
export const w52: StyleToken = widthTokens.w52!;
export const w56: StyleToken = widthTokens.w56!;
export const w60: StyleToken = widthTokens.w60!;
export const w64: StyleToken = widthTokens.w64!;
export const w72: StyleToken = widthTokens.w72!;
export const w80: StyleToken = widthTokens.w80!;
export const w96: StyleToken = widthTokens.w96!;
export const wHalf: StyleToken = widthTokens.wHalf!;
export const wThird: StyleToken = widthTokens.wThird!;
export const wTwoThirds: StyleToken = widthTokens.wTwoThirds!;
export const wQuarter: StyleToken = widthTokens.wQuarter!;
export const wThreeQuarters: StyleToken = widthTokens.wThreeQuarters!;
export const wFifth: StyleToken = widthTokens.wFifth!;
export const wTwoFifths: StyleToken = widthTokens.wTwoFifths!;
export const wThreeFifths: StyleToken = widthTokens.wThreeFifths!;
export const wFourFifths: StyleToken = widthTokens.wFourFifths!;
export const wSixth: StyleToken = widthTokens.wSixth!;
export const wFiveSixths: StyleToken = widthTokens.wFiveSixths!;
export const wAuto: StyleToken = widthTokens.wAuto!;
export const wFull: StyleToken = widthTokens.wFull!;
export const wScreen: StyleToken = widthTokens.wScreen!;
export const wSvw: StyleToken = widthTokens.wSvw!;
export const wLvw: StyleToken = widthTokens.wLvw!;
export const wDvw: StyleToken = widthTokens.wDvw!;
export const wMin: StyleToken = widthTokens.wMin!;
export const wMax: StyleToken = widthTokens.wMax!;
export const wFit: StyleToken = widthTokens.wFit!;

// Height
export const h0: StyleToken = heightTokens.h0!;
export const hpx: StyleToken = heightTokens.hpx!;
export const h0_5: StyleToken = heightTokens.h0_5!;
export const h1: StyleToken = heightTokens.h1!;
export const h1_5: StyleToken = heightTokens.h1_5!;
export const h2: StyleToken = heightTokens.h2!;
export const h2_5: StyleToken = heightTokens.h2_5!;
export const h3: StyleToken = heightTokens.h3!;
export const h3_5: StyleToken = heightTokens.h3_5!;
export const h4: StyleToken = heightTokens.h4!;
export const h5: StyleToken = heightTokens.h5!;
export const h6: StyleToken = heightTokens.h6!;
export const h7: StyleToken = heightTokens.h7!;
export const h8: StyleToken = heightTokens.h8!;
export const h9: StyleToken = heightTokens.h9!;
export const h10: StyleToken = heightTokens.h10!;
export const h11: StyleToken = heightTokens.h11!;
export const h12: StyleToken = heightTokens.h12!;
export const h14: StyleToken = heightTokens.h14!;
export const h16: StyleToken = heightTokens.h16!;
export const h20: StyleToken = heightTokens.h20!;
export const h24: StyleToken = heightTokens.h24!;
export const h28: StyleToken = heightTokens.h28!;
export const h32: StyleToken = heightTokens.h32!;
export const h36: StyleToken = heightTokens.h36!;
export const h40: StyleToken = heightTokens.h40!;
export const h44: StyleToken = heightTokens.h44!;
export const h48: StyleToken = heightTokens.h48!;
export const h52: StyleToken = heightTokens.h52!;
export const h56: StyleToken = heightTokens.h56!;
export const h60: StyleToken = heightTokens.h60!;
export const h64: StyleToken = heightTokens.h64!;
export const h72: StyleToken = heightTokens.h72!;
export const h80: StyleToken = heightTokens.h80!;
export const h96: StyleToken = heightTokens.h96!;
export const hHalf: StyleToken = heightTokens.hHalf!;
export const hThird: StyleToken = heightTokens.hThird!;
export const hTwoThirds: StyleToken = heightTokens.hTwoThirds!;
export const hQuarter: StyleToken = heightTokens.hQuarter!;
export const hThreeQuarters: StyleToken = heightTokens.hThreeQuarters!;
export const hFifth: StyleToken = heightTokens.hFifth!;
export const hTwoFifths: StyleToken = heightTokens.hTwoFifths!;
export const hThreeFifths: StyleToken = heightTokens.hThreeFifths!;
export const hFourFifths: StyleToken = heightTokens.hFourFifths!;
export const hSixth: StyleToken = heightTokens.hSixth!;
export const hFiveSixths: StyleToken = heightTokens.hFiveSixths!;
export const hAuto: StyleToken = heightTokens.hAuto!;
export const hFull: StyleToken = heightTokens.hFull!;
export const hScreen: StyleToken = heightTokens.hScreen!;
export const hSvh: StyleToken = heightTokens.hSvh!;
export const hLvh: StyleToken = heightTokens.hLvh!;
export const hDvh: StyleToken = heightTokens.hDvh!;
export const hMin: StyleToken = heightTokens.hMin!;
export const hMax: StyleToken = heightTokens.hMax!;
export const hFit: StyleToken = heightTokens.hFit!;

// Size
export const size0: StyleToken = sizeTokens.size0!;
export const sizepx: StyleToken = sizeTokens.sizepx!;
export const size0_5: StyleToken = sizeTokens.size0_5!;
export const size1: StyleToken = sizeTokens.size1!;
export const size1_5: StyleToken = sizeTokens.size1_5!;
export const size2: StyleToken = sizeTokens.size2!;
export const size2_5: StyleToken = sizeTokens.size2_5!;
export const size3: StyleToken = sizeTokens.size3!;
export const size3_5: StyleToken = sizeTokens.size3_5!;
export const size4: StyleToken = sizeTokens.size4!;
export const size5: StyleToken = sizeTokens.size5!;
export const size6: StyleToken = sizeTokens.size6!;
export const size7: StyleToken = sizeTokens.size7!;
export const size8: StyleToken = sizeTokens.size8!;
export const size9: StyleToken = sizeTokens.size9!;
export const size10: StyleToken = sizeTokens.size10!;
export const size11: StyleToken = sizeTokens.size11!;
export const size12: StyleToken = sizeTokens.size12!;
export const size14: StyleToken = sizeTokens.size14!;
export const size16: StyleToken = sizeTokens.size16!;
export const size20: StyleToken = sizeTokens.size20!;
export const size24: StyleToken = sizeTokens.size24!;
export const size28: StyleToken = sizeTokens.size28!;
export const size32: StyleToken = sizeTokens.size32!;
export const size36: StyleToken = sizeTokens.size36!;
export const size40: StyleToken = sizeTokens.size40!;
export const size44: StyleToken = sizeTokens.size44!;
export const size48: StyleToken = sizeTokens.size48!;
export const size52: StyleToken = sizeTokens.size52!;
export const size56: StyleToken = sizeTokens.size56!;
export const size60: StyleToken = sizeTokens.size60!;
export const size64: StyleToken = sizeTokens.size64!;
export const size72: StyleToken = sizeTokens.size72!;
export const size80: StyleToken = sizeTokens.size80!;
export const size96: StyleToken = sizeTokens.size96!;
export const sizeHalf: StyleToken = sizeTokens.sizeHalf!;
export const sizeThird: StyleToken = sizeTokens.sizeThird!;
export const sizeTwoThirds: StyleToken = sizeTokens.sizeTwoThirds!;
export const sizeQuarter: StyleToken = sizeTokens.sizeQuarter!;
export const sizeThreeQuarters: StyleToken = sizeTokens.sizeThreeQuarters!;
export const sizeFifth: StyleToken = sizeTokens.sizeFifth!;
export const sizeTwoFifths: StyleToken = sizeTokens.sizeTwoFifths!;
export const sizeThreeFifths: StyleToken = sizeTokens.sizeThreeFifths!;
export const sizeFourFifths: StyleToken = sizeTokens.sizeFourFifths!;
export const sizeSixth: StyleToken = sizeTokens.sizeSixth!;
export const sizeFiveSixths: StyleToken = sizeTokens.sizeFiveSixths!;
export const sizeAuto: StyleToken = sizeTokens.sizeAuto!;
export const sizeFull: StyleToken = sizeTokens.sizeFull!;
export const sizeScreen: StyleToken = sizeTokens.sizeScreen!;
export const sizeSvw: StyleToken = sizeTokens.sizeSvw!;
export const sizeLvw: StyleToken = sizeTokens.sizeLvw!;
export const sizeDvw: StyleToken = sizeTokens.sizeDvw!;
export const sizeMin: StyleToken = sizeTokens.sizeMin!;
export const sizeMax: StyleToken = sizeTokens.sizeMax!;
export const sizeFit: StyleToken = sizeTokens.sizeFit!;

// Min-width
export const minW0: StyleToken = minWidthTokens.minW0!;
export const minWFull: StyleToken = minWidthTokens.minWFull!;
export const minWMin: StyleToken = minWidthTokens.minWMin!;
export const minWMax: StyleToken = minWidthTokens.minWMax!;
export const minWFit: StyleToken = minWidthTokens.minWFit!;

// Max-width
export const maxW0: StyleToken = maxWidthTokens.maxW0!;
export const maxWFull: StyleToken = maxWidthTokens.maxWFull!;
export const maxWMin: StyleToken = maxWidthTokens.maxWMin!;
export const maxWMax: StyleToken = maxWidthTokens.maxWMax!;
export const maxWFit: StyleToken = maxWidthTokens.maxWFit!;
export const maxWXs: StyleToken = maxWidthTokens.maxWXs!;
export const maxWSm: StyleToken = maxWidthTokens.maxWSm!;
export const maxWMd: StyleToken = maxWidthTokens.maxWMd!;
export const maxWLg: StyleToken = maxWidthTokens.maxWLg!;
export const maxWXl: StyleToken = maxWidthTokens.maxWXl!;
export const maxW2xl: StyleToken = maxWidthTokens.maxW2xl!;
export const maxW3xl: StyleToken = maxWidthTokens.maxW3xl!;
export const maxW4xl: StyleToken = maxWidthTokens.maxW4xl!;
export const maxW5xl: StyleToken = maxWidthTokens.maxW5xl!;
export const maxW6xl: StyleToken = maxWidthTokens.maxW6xl!;
export const maxW7xl: StyleToken = maxWidthTokens.maxW7xl!;
export const maxWProse: StyleToken = maxWidthTokens.maxWProse!;

// Min-height
export const minH0: StyleToken = minHeightTokens.minH0!;
export const minHFull: StyleToken = minHeightTokens.minHFull!;
export const minHScreen: StyleToken = minHeightTokens.minHScreen!;
export const minHSvh: StyleToken = minHeightTokens.minHSvh!;
export const minHLvh: StyleToken = minHeightTokens.minHLvh!;
export const minHDvh: StyleToken = minHeightTokens.minHDvh!;
export const minHMin: StyleToken = minHeightTokens.minHMin!;
export const minHMax: StyleToken = minHeightTokens.minHMax!;
export const minHFit: StyleToken = minHeightTokens.minHFit!;

// Max-height
export const maxH0: StyleToken = maxHeightTokens.maxH0!;
export const maxHFull: StyleToken = maxHeightTokens.maxHFull!;
export const maxHScreen: StyleToken = maxHeightTokens.maxHScreen!;
export const maxHSvh: StyleToken = maxHeightTokens.maxHSvh!;
export const maxHLvh: StyleToken = maxHeightTokens.maxHLvh!;
export const maxHDvh: StyleToken = maxHeightTokens.maxHDvh!;
export const maxHMin: StyleToken = maxHeightTokens.maxHMin!;
export const maxHMax: StyleToken = maxHeightTokens.maxHMax!;
export const maxHFit: StyleToken = maxHeightTokens.maxHFit!;

// ============================================
// Namespace export (grouped)
// ============================================

/** All sizing tokens in a namespace */
export const sizing: Record<string, StyleToken | TaggedUtilityFn> = {
  // Width
  ...widthTokens,
  // Height
  ...heightTokens,
  // Size
  ...sizeTokens,
  // Min-width
  ...minWidthTokens,
  // Max-width
  ...maxWidthTokens,
  // Min-height
  ...minHeightTokens,
  // Max-height
  ...maxHeightTokens,
  // Arbitrary (tagged templates)
  w,
  h,
  minW,
  maxW,
  minH,
  maxH,
  size,
};

// Type for the sizing namespace
export type SizingNamespace = typeof sizing;
