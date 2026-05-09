/**
 * Spacing utilities: padding, margin, gap
 *
 * Usage:
 * ```ts
 * // Merged naming - flat exports (recommended)
 * import { p4, px2, m4, mx2, gap4 } from "@semajsx/tailwind";
 * <div class={[p4, mx2, gap4]}>
 *
 * // Namespace access
 * import { spacing } from "@semajsx/tailwind";
 * <div class={[spacing.p4, spacing.mx2]}>
 *
 * // Arbitrary values (tagged template)
 * import { p, px, m, mx } from "@semajsx/tailwind";
 * <div class={[p`10px`, px`20px`, m`calc(100% - 40px)`]}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createMultiUtility, createTaggedUtility } from "./core";

// Tailwind spacing scale (in rem, where 4 = 1rem)
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

// Utility function creators
const utilityCreators = {
  p: createUtility("padding", "p"),
  px: createMultiUtility(["padding-left", "padding-right"], "px"),
  py: createMultiUtility(["padding-top", "padding-bottom"], "py"),
  pt: createUtility("padding-top", "pt"),
  pr: createUtility("padding-right", "pr"),
  pb: createUtility("padding-bottom", "pb"),
  pl: createUtility("padding-left", "pl"),
  m: createUtility("margin", "m"),
  mx: createMultiUtility(["margin-left", "margin-right"], "mx"),
  my: createMultiUtility(["margin-top", "margin-bottom"], "my"),
  mt: createUtility("margin-top", "mt"),
  mr: createUtility("margin-right", "mr"),
  mb: createUtility("margin-bottom", "mb"),
  ml: createUtility("margin-left", "ml"),
  gap: createUtility("gap", "gap"),
  gapX: createUtility("column-gap", "gap-x"),
  gapY: createUtility("row-gap", "gap-y"),
};

type UtilityFn = (value: string, valueName?: string) => StyleToken;

// ============================================
// Token generators
// ============================================

function generateSpacingTokens(prefix: string, utilityFn: UtilityFn): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  for (const [key, value] of Object.entries(spacingScale)) {
    // Convert decimal keys: "0.5" -> "0_5" for valid JS identifiers
    const tokenName = `${prefix}${key.replace(".", "_")}`;
    tokens[tokenName] = utilityFn(value, key);
  }

  return tokens;
}

// ============================================
// Generate all tokens
// ============================================

// Padding tokens
const pTokens = generateSpacingTokens("p", utilityCreators.p);
const pxTokens = generateSpacingTokens("px", utilityCreators.px);
const pyTokens = generateSpacingTokens("py", utilityCreators.py);
const ptTokens = generateSpacingTokens("pt", utilityCreators.pt);
const prTokens = generateSpacingTokens("pr", utilityCreators.pr);
const pbTokens = generateSpacingTokens("pb", utilityCreators.pb);
const plTokens = generateSpacingTokens("pl", utilityCreators.pl);

// Margin tokens
const mTokens = generateSpacingTokens("m", utilityCreators.m);
const mxTokens = generateSpacingTokens("mx", utilityCreators.mx);
const myTokens = generateSpacingTokens("my", utilityCreators.my);
const mtTokens = generateSpacingTokens("mt", utilityCreators.mt);
const mrTokens = generateSpacingTokens("mr", utilityCreators.mr);
const mbTokens = generateSpacingTokens("mb", utilityCreators.mb);
const mlTokens = generateSpacingTokens("ml", utilityCreators.ml);

// Margin auto tokens
const marginAutoTokens = {
  mAuto: utilityCreators.m("auto", "auto"),
  mxAuto: utilityCreators.mx("auto", "auto"),
  myAuto: utilityCreators.my("auto", "auto"),
  mtAuto: utilityCreators.mt("auto", "auto"),
  mrAuto: utilityCreators.mr("auto", "auto"),
  mbAuto: utilityCreators.mb("auto", "auto"),
  mlAuto: utilityCreators.ml("auto", "auto"),
};

// Gap tokens
const gapTokens = generateSpacingTokens("gap", utilityCreators.gap);
const gapXTokens = generateSpacingTokens("gapX", utilityCreators.gapX);
const gapYTokens = generateSpacingTokens("gapY", utilityCreators.gapY);

// ============================================
// Tagged Template Functions (Arbitrary Values)
// ============================================

/** Padding - arbitrary value: p`10px` */
export const p: TaggedUtilityFn = createTaggedUtility(utilityCreators.p);
/** Padding X - arbitrary value: px`10px` */
export const px: TaggedUtilityFn = createTaggedUtility(utilityCreators.px);
/** Padding Y - arbitrary value: py`10px` */
export const py: TaggedUtilityFn = createTaggedUtility(utilityCreators.py);
/** Padding Top - arbitrary value: pt`10px` */
export const pt: TaggedUtilityFn = createTaggedUtility(utilityCreators.pt);
/** Padding Right - arbitrary value: pr`10px` */
export const pr: TaggedUtilityFn = createTaggedUtility(utilityCreators.pr);
/** Padding Bottom - arbitrary value: pb`10px` */
export const pb: TaggedUtilityFn = createTaggedUtility(utilityCreators.pb);
/** Padding Left - arbitrary value: pl`10px` */
export const pl: TaggedUtilityFn = createTaggedUtility(utilityCreators.pl);

/** Margin - arbitrary value: m`10px` */
export const m: TaggedUtilityFn = createTaggedUtility(utilityCreators.m);
/** Margin X - arbitrary value: mx`10px` */
export const mx: TaggedUtilityFn = createTaggedUtility(utilityCreators.mx);
/** Margin Y - arbitrary value: my`10px` */
export const my: TaggedUtilityFn = createTaggedUtility(utilityCreators.my);
/** Margin Top - arbitrary value: mt`10px` */
export const mt: TaggedUtilityFn = createTaggedUtility(utilityCreators.mt);
/** Margin Right - arbitrary value: mr`10px` */
export const mr: TaggedUtilityFn = createTaggedUtility(utilityCreators.mr);
/** Margin Bottom - arbitrary value: mb`10px` */
export const mb: TaggedUtilityFn = createTaggedUtility(utilityCreators.mb);
/** Margin Left - arbitrary value: ml`10px` */
export const ml: TaggedUtilityFn = createTaggedUtility(utilityCreators.ml);

/** Gap - arbitrary value: gap`10px` */
export const gap: TaggedUtilityFn = createTaggedUtility(utilityCreators.gap);
/** Gap X - arbitrary value: gapX`10px` */
export const gapX: TaggedUtilityFn = createTaggedUtility(utilityCreators.gapX);
/** Gap Y - arbitrary value: gapY`10px` */
export const gapY: TaggedUtilityFn = createTaggedUtility(utilityCreators.gapY);

// ============================================
// Individual token exports (flat) - Padding
// ============================================

export const p0: StyleToken = pTokens.p0!;
export const ppx: StyleToken = pTokens.ppx!;
export const p0_5: StyleToken = pTokens.p0_5!;
export const p1: StyleToken = pTokens.p1!;
export const p1_5: StyleToken = pTokens.p1_5!;
export const p2: StyleToken = pTokens.p2!;
export const p2_5: StyleToken = pTokens.p2_5!;
export const p3: StyleToken = pTokens.p3!;
export const p3_5: StyleToken = pTokens.p3_5!;
export const p4: StyleToken = pTokens.p4!;
export const p5: StyleToken = pTokens.p5!;
export const p6: StyleToken = pTokens.p6!;
export const p7: StyleToken = pTokens.p7!;
export const p8: StyleToken = pTokens.p8!;
export const p9: StyleToken = pTokens.p9!;
export const p10: StyleToken = pTokens.p10!;
export const p11: StyleToken = pTokens.p11!;
export const p12: StyleToken = pTokens.p12!;
export const p14: StyleToken = pTokens.p14!;
export const p16: StyleToken = pTokens.p16!;
export const p20: StyleToken = pTokens.p20!;
export const p24: StyleToken = pTokens.p24!;
export const p28: StyleToken = pTokens.p28!;
export const p32: StyleToken = pTokens.p32!;
export const p36: StyleToken = pTokens.p36!;
export const p40: StyleToken = pTokens.p40!;
export const p44: StyleToken = pTokens.p44!;
export const p48: StyleToken = pTokens.p48!;
export const p52: StyleToken = pTokens.p52!;
export const p56: StyleToken = pTokens.p56!;
export const p60: StyleToken = pTokens.p60!;
export const p64: StyleToken = pTokens.p64!;
export const p72: StyleToken = pTokens.p72!;
export const p80: StyleToken = pTokens.p80!;
export const p96: StyleToken = pTokens.p96!;

export const px0: StyleToken = pxTokens.px0!;
export const pxpx: StyleToken = pxTokens.pxpx!;
export const px0_5: StyleToken = pxTokens.px0_5!;
export const px1: StyleToken = pxTokens.px1!;
export const px1_5: StyleToken = pxTokens.px1_5!;
export const px2: StyleToken = pxTokens.px2!;
export const px2_5: StyleToken = pxTokens.px2_5!;
export const px3: StyleToken = pxTokens.px3!;
export const px3_5: StyleToken = pxTokens.px3_5!;
export const px4: StyleToken = pxTokens.px4!;
export const px5: StyleToken = pxTokens.px5!;
export const px6: StyleToken = pxTokens.px6!;
export const px7: StyleToken = pxTokens.px7!;
export const px8: StyleToken = pxTokens.px8!;
export const px9: StyleToken = pxTokens.px9!;
export const px10: StyleToken = pxTokens.px10!;
export const px11: StyleToken = pxTokens.px11!;
export const px12: StyleToken = pxTokens.px12!;
export const px14: StyleToken = pxTokens.px14!;
export const px16: StyleToken = pxTokens.px16!;
export const px20: StyleToken = pxTokens.px20!;
export const px24: StyleToken = pxTokens.px24!;
export const px28: StyleToken = pxTokens.px28!;
export const px32: StyleToken = pxTokens.px32!;
export const px36: StyleToken = pxTokens.px36!;
export const px40: StyleToken = pxTokens.px40!;
export const px44: StyleToken = pxTokens.px44!;
export const px48: StyleToken = pxTokens.px48!;
export const px52: StyleToken = pxTokens.px52!;
export const px56: StyleToken = pxTokens.px56!;
export const px60: StyleToken = pxTokens.px60!;
export const px64: StyleToken = pxTokens.px64!;
export const px72: StyleToken = pxTokens.px72!;
export const px80: StyleToken = pxTokens.px80!;
export const px96: StyleToken = pxTokens.px96!;

export const py0: StyleToken = pyTokens.py0!;
export const pypx: StyleToken = pyTokens.pypx!;
export const py0_5: StyleToken = pyTokens.py0_5!;
export const py1: StyleToken = pyTokens.py1!;
export const py1_5: StyleToken = pyTokens.py1_5!;
export const py2: StyleToken = pyTokens.py2!;
export const py2_5: StyleToken = pyTokens.py2_5!;
export const py3: StyleToken = pyTokens.py3!;
export const py3_5: StyleToken = pyTokens.py3_5!;
export const py4: StyleToken = pyTokens.py4!;
export const py5: StyleToken = pyTokens.py5!;
export const py6: StyleToken = pyTokens.py6!;
export const py7: StyleToken = pyTokens.py7!;
export const py8: StyleToken = pyTokens.py8!;
export const py9: StyleToken = pyTokens.py9!;
export const py10: StyleToken = pyTokens.py10!;
export const py11: StyleToken = pyTokens.py11!;
export const py12: StyleToken = pyTokens.py12!;
export const py14: StyleToken = pyTokens.py14!;
export const py16: StyleToken = pyTokens.py16!;
export const py20: StyleToken = pyTokens.py20!;
export const py24: StyleToken = pyTokens.py24!;
export const py28: StyleToken = pyTokens.py28!;
export const py32: StyleToken = pyTokens.py32!;
export const py36: StyleToken = pyTokens.py36!;
export const py40: StyleToken = pyTokens.py40!;
export const py44: StyleToken = pyTokens.py44!;
export const py48: StyleToken = pyTokens.py48!;
export const py52: StyleToken = pyTokens.py52!;
export const py56: StyleToken = pyTokens.py56!;
export const py60: StyleToken = pyTokens.py60!;
export const py64: StyleToken = pyTokens.py64!;
export const py72: StyleToken = pyTokens.py72!;
export const py80: StyleToken = pyTokens.py80!;
export const py96: StyleToken = pyTokens.py96!;

export const pt0: StyleToken = ptTokens.pt0!;
export const ptpx: StyleToken = ptTokens.ptpx!;
export const pt0_5: StyleToken = ptTokens.pt0_5!;
export const pt1: StyleToken = ptTokens.pt1!;
export const pt1_5: StyleToken = ptTokens.pt1_5!;
export const pt2: StyleToken = ptTokens.pt2!;
export const pt2_5: StyleToken = ptTokens.pt2_5!;
export const pt3: StyleToken = ptTokens.pt3!;
export const pt3_5: StyleToken = ptTokens.pt3_5!;
export const pt4: StyleToken = ptTokens.pt4!;
export const pt5: StyleToken = ptTokens.pt5!;
export const pt6: StyleToken = ptTokens.pt6!;
export const pt7: StyleToken = ptTokens.pt7!;
export const pt8: StyleToken = ptTokens.pt8!;
export const pt9: StyleToken = ptTokens.pt9!;
export const pt10: StyleToken = ptTokens.pt10!;
export const pt11: StyleToken = ptTokens.pt11!;
export const pt12: StyleToken = ptTokens.pt12!;
export const pt14: StyleToken = ptTokens.pt14!;
export const pt16: StyleToken = ptTokens.pt16!;
export const pt20: StyleToken = ptTokens.pt20!;
export const pt24: StyleToken = ptTokens.pt24!;
export const pt28: StyleToken = ptTokens.pt28!;
export const pt32: StyleToken = ptTokens.pt32!;
export const pt36: StyleToken = ptTokens.pt36!;
export const pt40: StyleToken = ptTokens.pt40!;
export const pt44: StyleToken = ptTokens.pt44!;
export const pt48: StyleToken = ptTokens.pt48!;
export const pt52: StyleToken = ptTokens.pt52!;
export const pt56: StyleToken = ptTokens.pt56!;
export const pt60: StyleToken = ptTokens.pt60!;
export const pt64: StyleToken = ptTokens.pt64!;
export const pt72: StyleToken = ptTokens.pt72!;
export const pt80: StyleToken = ptTokens.pt80!;
export const pt96: StyleToken = ptTokens.pt96!;

export const pr0: StyleToken = prTokens.pr0!;
export const prpx: StyleToken = prTokens.prpx!;
export const pr0_5: StyleToken = prTokens.pr0_5!;
export const pr1: StyleToken = prTokens.pr1!;
export const pr1_5: StyleToken = prTokens.pr1_5!;
export const pr2: StyleToken = prTokens.pr2!;
export const pr2_5: StyleToken = prTokens.pr2_5!;
export const pr3: StyleToken = prTokens.pr3!;
export const pr3_5: StyleToken = prTokens.pr3_5!;
export const pr4: StyleToken = prTokens.pr4!;
export const pr5: StyleToken = prTokens.pr5!;
export const pr6: StyleToken = prTokens.pr6!;
export const pr7: StyleToken = prTokens.pr7!;
export const pr8: StyleToken = prTokens.pr8!;
export const pr9: StyleToken = prTokens.pr9!;
export const pr10: StyleToken = prTokens.pr10!;
export const pr11: StyleToken = prTokens.pr11!;
export const pr12: StyleToken = prTokens.pr12!;
export const pr14: StyleToken = prTokens.pr14!;
export const pr16: StyleToken = prTokens.pr16!;
export const pr20: StyleToken = prTokens.pr20!;
export const pr24: StyleToken = prTokens.pr24!;
export const pr28: StyleToken = prTokens.pr28!;
export const pr32: StyleToken = prTokens.pr32!;
export const pr36: StyleToken = prTokens.pr36!;
export const pr40: StyleToken = prTokens.pr40!;
export const pr44: StyleToken = prTokens.pr44!;
export const pr48: StyleToken = prTokens.pr48!;
export const pr52: StyleToken = prTokens.pr52!;
export const pr56: StyleToken = prTokens.pr56!;
export const pr60: StyleToken = prTokens.pr60!;
export const pr64: StyleToken = prTokens.pr64!;
export const pr72: StyleToken = prTokens.pr72!;
export const pr80: StyleToken = prTokens.pr80!;
export const pr96: StyleToken = prTokens.pr96!;

export const pb0: StyleToken = pbTokens.pb0!;
export const pbpx: StyleToken = pbTokens.pbpx!;
export const pb0_5: StyleToken = pbTokens.pb0_5!;
export const pb1: StyleToken = pbTokens.pb1!;
export const pb1_5: StyleToken = pbTokens.pb1_5!;
export const pb2: StyleToken = pbTokens.pb2!;
export const pb2_5: StyleToken = pbTokens.pb2_5!;
export const pb3: StyleToken = pbTokens.pb3!;
export const pb3_5: StyleToken = pbTokens.pb3_5!;
export const pb4: StyleToken = pbTokens.pb4!;
export const pb5: StyleToken = pbTokens.pb5!;
export const pb6: StyleToken = pbTokens.pb6!;
export const pb7: StyleToken = pbTokens.pb7!;
export const pb8: StyleToken = pbTokens.pb8!;
export const pb9: StyleToken = pbTokens.pb9!;
export const pb10: StyleToken = pbTokens.pb10!;
export const pb11: StyleToken = pbTokens.pb11!;
export const pb12: StyleToken = pbTokens.pb12!;
export const pb14: StyleToken = pbTokens.pb14!;
export const pb16: StyleToken = pbTokens.pb16!;
export const pb20: StyleToken = pbTokens.pb20!;
export const pb24: StyleToken = pbTokens.pb24!;
export const pb28: StyleToken = pbTokens.pb28!;
export const pb32: StyleToken = pbTokens.pb32!;
export const pb36: StyleToken = pbTokens.pb36!;
export const pb40: StyleToken = pbTokens.pb40!;
export const pb44: StyleToken = pbTokens.pb44!;
export const pb48: StyleToken = pbTokens.pb48!;
export const pb52: StyleToken = pbTokens.pb52!;
export const pb56: StyleToken = pbTokens.pb56!;
export const pb60: StyleToken = pbTokens.pb60!;
export const pb64: StyleToken = pbTokens.pb64!;
export const pb72: StyleToken = pbTokens.pb72!;
export const pb80: StyleToken = pbTokens.pb80!;
export const pb96: StyleToken = pbTokens.pb96!;

export const pl0: StyleToken = plTokens.pl0!;
export const plpx: StyleToken = plTokens.plpx!;
export const pl0_5: StyleToken = plTokens.pl0_5!;
export const pl1: StyleToken = plTokens.pl1!;
export const pl1_5: StyleToken = plTokens.pl1_5!;
export const pl2: StyleToken = plTokens.pl2!;
export const pl2_5: StyleToken = plTokens.pl2_5!;
export const pl3: StyleToken = plTokens.pl3!;
export const pl3_5: StyleToken = plTokens.pl3_5!;
export const pl4: StyleToken = plTokens.pl4!;
export const pl5: StyleToken = plTokens.pl5!;
export const pl6: StyleToken = plTokens.pl6!;
export const pl7: StyleToken = plTokens.pl7!;
export const pl8: StyleToken = plTokens.pl8!;
export const pl9: StyleToken = plTokens.pl9!;
export const pl10: StyleToken = plTokens.pl10!;
export const pl11: StyleToken = plTokens.pl11!;
export const pl12: StyleToken = plTokens.pl12!;
export const pl14: StyleToken = plTokens.pl14!;
export const pl16: StyleToken = plTokens.pl16!;
export const pl20: StyleToken = plTokens.pl20!;
export const pl24: StyleToken = plTokens.pl24!;
export const pl28: StyleToken = plTokens.pl28!;
export const pl32: StyleToken = plTokens.pl32!;
export const pl36: StyleToken = plTokens.pl36!;
export const pl40: StyleToken = plTokens.pl40!;
export const pl44: StyleToken = plTokens.pl44!;
export const pl48: StyleToken = plTokens.pl48!;
export const pl52: StyleToken = plTokens.pl52!;
export const pl56: StyleToken = plTokens.pl56!;
export const pl60: StyleToken = plTokens.pl60!;
export const pl64: StyleToken = plTokens.pl64!;
export const pl72: StyleToken = plTokens.pl72!;
export const pl80: StyleToken = plTokens.pl80!;
export const pl96: StyleToken = plTokens.pl96!;

// ============================================
// Individual token exports (flat) - Margin
// ============================================

export const m0: StyleToken = mTokens.m0!;
export const mpx: StyleToken = mTokens.mpx!;
export const m0_5: StyleToken = mTokens.m0_5!;
export const m1: StyleToken = mTokens.m1!;
export const m1_5: StyleToken = mTokens.m1_5!;
export const m2: StyleToken = mTokens.m2!;
export const m2_5: StyleToken = mTokens.m2_5!;
export const m3: StyleToken = mTokens.m3!;
export const m3_5: StyleToken = mTokens.m3_5!;
export const m4: StyleToken = mTokens.m4!;
export const m5: StyleToken = mTokens.m5!;
export const m6: StyleToken = mTokens.m6!;
export const m7: StyleToken = mTokens.m7!;
export const m8: StyleToken = mTokens.m8!;
export const m9: StyleToken = mTokens.m9!;
export const m10: StyleToken = mTokens.m10!;
export const m11: StyleToken = mTokens.m11!;
export const m12: StyleToken = mTokens.m12!;
export const m14: StyleToken = mTokens.m14!;
export const m16: StyleToken = mTokens.m16!;
export const m20: StyleToken = mTokens.m20!;
export const m24: StyleToken = mTokens.m24!;
export const m28: StyleToken = mTokens.m28!;
export const m32: StyleToken = mTokens.m32!;
export const m36: StyleToken = mTokens.m36!;
export const m40: StyleToken = mTokens.m40!;
export const m44: StyleToken = mTokens.m44!;
export const m48: StyleToken = mTokens.m48!;
export const m52: StyleToken = mTokens.m52!;
export const m56: StyleToken = mTokens.m56!;
export const m60: StyleToken = mTokens.m60!;
export const m64: StyleToken = mTokens.m64!;
export const m72: StyleToken = mTokens.m72!;
export const m80: StyleToken = mTokens.m80!;
export const m96: StyleToken = mTokens.m96!;

export const mx0: StyleToken = mxTokens.mx0!;
export const mxpx: StyleToken = mxTokens.mxpx!;
export const mx0_5: StyleToken = mxTokens.mx0_5!;
export const mx1: StyleToken = mxTokens.mx1!;
export const mx1_5: StyleToken = mxTokens.mx1_5!;
export const mx2: StyleToken = mxTokens.mx2!;
export const mx2_5: StyleToken = mxTokens.mx2_5!;
export const mx3: StyleToken = mxTokens.mx3!;
export const mx3_5: StyleToken = mxTokens.mx3_5!;
export const mx4: StyleToken = mxTokens.mx4!;
export const mx5: StyleToken = mxTokens.mx5!;
export const mx6: StyleToken = mxTokens.mx6!;
export const mx7: StyleToken = mxTokens.mx7!;
export const mx8: StyleToken = mxTokens.mx8!;
export const mx9: StyleToken = mxTokens.mx9!;
export const mx10: StyleToken = mxTokens.mx10!;
export const mx11: StyleToken = mxTokens.mx11!;
export const mx12: StyleToken = mxTokens.mx12!;
export const mx14: StyleToken = mxTokens.mx14!;
export const mx16: StyleToken = mxTokens.mx16!;
export const mx20: StyleToken = mxTokens.mx20!;
export const mx24: StyleToken = mxTokens.mx24!;
export const mx28: StyleToken = mxTokens.mx28!;
export const mx32: StyleToken = mxTokens.mx32!;
export const mx36: StyleToken = mxTokens.mx36!;
export const mx40: StyleToken = mxTokens.mx40!;
export const mx44: StyleToken = mxTokens.mx44!;
export const mx48: StyleToken = mxTokens.mx48!;
export const mx52: StyleToken = mxTokens.mx52!;
export const mx56: StyleToken = mxTokens.mx56!;
export const mx60: StyleToken = mxTokens.mx60!;
export const mx64: StyleToken = mxTokens.mx64!;
export const mx72: StyleToken = mxTokens.mx72!;
export const mx80: StyleToken = mxTokens.mx80!;
export const mx96: StyleToken = mxTokens.mx96!;

export const my0: StyleToken = myTokens.my0!;
export const mypx: StyleToken = myTokens.mypx!;
export const my0_5: StyleToken = myTokens.my0_5!;
export const my1: StyleToken = myTokens.my1!;
export const my1_5: StyleToken = myTokens.my1_5!;
export const my2: StyleToken = myTokens.my2!;
export const my2_5: StyleToken = myTokens.my2_5!;
export const my3: StyleToken = myTokens.my3!;
export const my3_5: StyleToken = myTokens.my3_5!;
export const my4: StyleToken = myTokens.my4!;
export const my5: StyleToken = myTokens.my5!;
export const my6: StyleToken = myTokens.my6!;
export const my7: StyleToken = myTokens.my7!;
export const my8: StyleToken = myTokens.my8!;
export const my9: StyleToken = myTokens.my9!;
export const my10: StyleToken = myTokens.my10!;
export const my11: StyleToken = myTokens.my11!;
export const my12: StyleToken = myTokens.my12!;
export const my14: StyleToken = myTokens.my14!;
export const my16: StyleToken = myTokens.my16!;
export const my20: StyleToken = myTokens.my20!;
export const my24: StyleToken = myTokens.my24!;
export const my28: StyleToken = myTokens.my28!;
export const my32: StyleToken = myTokens.my32!;
export const my36: StyleToken = myTokens.my36!;
export const my40: StyleToken = myTokens.my40!;
export const my44: StyleToken = myTokens.my44!;
export const my48: StyleToken = myTokens.my48!;
export const my52: StyleToken = myTokens.my52!;
export const my56: StyleToken = myTokens.my56!;
export const my60: StyleToken = myTokens.my60!;
export const my64: StyleToken = myTokens.my64!;
export const my72: StyleToken = myTokens.my72!;
export const my80: StyleToken = myTokens.my80!;
export const my96: StyleToken = myTokens.my96!;

export const mt0: StyleToken = mtTokens.mt0!;
export const mtpx: StyleToken = mtTokens.mtpx!;
export const mt0_5: StyleToken = mtTokens.mt0_5!;
export const mt1: StyleToken = mtTokens.mt1!;
export const mt1_5: StyleToken = mtTokens.mt1_5!;
export const mt2: StyleToken = mtTokens.mt2!;
export const mt2_5: StyleToken = mtTokens.mt2_5!;
export const mt3: StyleToken = mtTokens.mt3!;
export const mt3_5: StyleToken = mtTokens.mt3_5!;
export const mt4: StyleToken = mtTokens.mt4!;
export const mt5: StyleToken = mtTokens.mt5!;
export const mt6: StyleToken = mtTokens.mt6!;
export const mt7: StyleToken = mtTokens.mt7!;
export const mt8: StyleToken = mtTokens.mt8!;
export const mt9: StyleToken = mtTokens.mt9!;
export const mt10: StyleToken = mtTokens.mt10!;
export const mt11: StyleToken = mtTokens.mt11!;
export const mt12: StyleToken = mtTokens.mt12!;
export const mt14: StyleToken = mtTokens.mt14!;
export const mt16: StyleToken = mtTokens.mt16!;
export const mt20: StyleToken = mtTokens.mt20!;
export const mt24: StyleToken = mtTokens.mt24!;
export const mt28: StyleToken = mtTokens.mt28!;
export const mt32: StyleToken = mtTokens.mt32!;
export const mt36: StyleToken = mtTokens.mt36!;
export const mt40: StyleToken = mtTokens.mt40!;
export const mt44: StyleToken = mtTokens.mt44!;
export const mt48: StyleToken = mtTokens.mt48!;
export const mt52: StyleToken = mtTokens.mt52!;
export const mt56: StyleToken = mtTokens.mt56!;
export const mt60: StyleToken = mtTokens.mt60!;
export const mt64: StyleToken = mtTokens.mt64!;
export const mt72: StyleToken = mtTokens.mt72!;
export const mt80: StyleToken = mtTokens.mt80!;
export const mt96: StyleToken = mtTokens.mt96!;

export const mr0: StyleToken = mrTokens.mr0!;
export const mrpx: StyleToken = mrTokens.mrpx!;
export const mr0_5: StyleToken = mrTokens.mr0_5!;
export const mr1: StyleToken = mrTokens.mr1!;
export const mr1_5: StyleToken = mrTokens.mr1_5!;
export const mr2: StyleToken = mrTokens.mr2!;
export const mr2_5: StyleToken = mrTokens.mr2_5!;
export const mr3: StyleToken = mrTokens.mr3!;
export const mr3_5: StyleToken = mrTokens.mr3_5!;
export const mr4: StyleToken = mrTokens.mr4!;
export const mr5: StyleToken = mrTokens.mr5!;
export const mr6: StyleToken = mrTokens.mr6!;
export const mr7: StyleToken = mrTokens.mr7!;
export const mr8: StyleToken = mrTokens.mr8!;
export const mr9: StyleToken = mrTokens.mr9!;
export const mr10: StyleToken = mrTokens.mr10!;
export const mr11: StyleToken = mrTokens.mr11!;
export const mr12: StyleToken = mrTokens.mr12!;
export const mr14: StyleToken = mrTokens.mr14!;
export const mr16: StyleToken = mrTokens.mr16!;
export const mr20: StyleToken = mrTokens.mr20!;
export const mr24: StyleToken = mrTokens.mr24!;
export const mr28: StyleToken = mrTokens.mr28!;
export const mr32: StyleToken = mrTokens.mr32!;
export const mr36: StyleToken = mrTokens.mr36!;
export const mr40: StyleToken = mrTokens.mr40!;
export const mr44: StyleToken = mrTokens.mr44!;
export const mr48: StyleToken = mrTokens.mr48!;
export const mr52: StyleToken = mrTokens.mr52!;
export const mr56: StyleToken = mrTokens.mr56!;
export const mr60: StyleToken = mrTokens.mr60!;
export const mr64: StyleToken = mrTokens.mr64!;
export const mr72: StyleToken = mrTokens.mr72!;
export const mr80: StyleToken = mrTokens.mr80!;
export const mr96: StyleToken = mrTokens.mr96!;

export const mb0: StyleToken = mbTokens.mb0!;
export const mbpx: StyleToken = mbTokens.mbpx!;
export const mb0_5: StyleToken = mbTokens.mb0_5!;
export const mb1: StyleToken = mbTokens.mb1!;
export const mb1_5: StyleToken = mbTokens.mb1_5!;
export const mb2: StyleToken = mbTokens.mb2!;
export const mb2_5: StyleToken = mbTokens.mb2_5!;
export const mb3: StyleToken = mbTokens.mb3!;
export const mb3_5: StyleToken = mbTokens.mb3_5!;
export const mb4: StyleToken = mbTokens.mb4!;
export const mb5: StyleToken = mbTokens.mb5!;
export const mb6: StyleToken = mbTokens.mb6!;
export const mb7: StyleToken = mbTokens.mb7!;
export const mb8: StyleToken = mbTokens.mb8!;
export const mb9: StyleToken = mbTokens.mb9!;
export const mb10: StyleToken = mbTokens.mb10!;
export const mb11: StyleToken = mbTokens.mb11!;
export const mb12: StyleToken = mbTokens.mb12!;
export const mb14: StyleToken = mbTokens.mb14!;
export const mb16: StyleToken = mbTokens.mb16!;
export const mb20: StyleToken = mbTokens.mb20!;
export const mb24: StyleToken = mbTokens.mb24!;
export const mb28: StyleToken = mbTokens.mb28!;
export const mb32: StyleToken = mbTokens.mb32!;
export const mb36: StyleToken = mbTokens.mb36!;
export const mb40: StyleToken = mbTokens.mb40!;
export const mb44: StyleToken = mbTokens.mb44!;
export const mb48: StyleToken = mbTokens.mb48!;
export const mb52: StyleToken = mbTokens.mb52!;
export const mb56: StyleToken = mbTokens.mb56!;
export const mb60: StyleToken = mbTokens.mb60!;
export const mb64: StyleToken = mbTokens.mb64!;
export const mb72: StyleToken = mbTokens.mb72!;
export const mb80: StyleToken = mbTokens.mb80!;
export const mb96: StyleToken = mbTokens.mb96!;

export const ml0: StyleToken = mlTokens.ml0!;
export const mlpx: StyleToken = mlTokens.mlpx!;
export const ml0_5: StyleToken = mlTokens.ml0_5!;
export const ml1: StyleToken = mlTokens.ml1!;
export const ml1_5: StyleToken = mlTokens.ml1_5!;
export const ml2: StyleToken = mlTokens.ml2!;
export const ml2_5: StyleToken = mlTokens.ml2_5!;
export const ml3: StyleToken = mlTokens.ml3!;
export const ml3_5: StyleToken = mlTokens.ml3_5!;
export const ml4: StyleToken = mlTokens.ml4!;
export const ml5: StyleToken = mlTokens.ml5!;
export const ml6: StyleToken = mlTokens.ml6!;
export const ml7: StyleToken = mlTokens.ml7!;
export const ml8: StyleToken = mlTokens.ml8!;
export const ml9: StyleToken = mlTokens.ml9!;
export const ml10: StyleToken = mlTokens.ml10!;
export const ml11: StyleToken = mlTokens.ml11!;
export const ml12: StyleToken = mlTokens.ml12!;
export const ml14: StyleToken = mlTokens.ml14!;
export const ml16: StyleToken = mlTokens.ml16!;
export const ml20: StyleToken = mlTokens.ml20!;
export const ml24: StyleToken = mlTokens.ml24!;
export const ml28: StyleToken = mlTokens.ml28!;
export const ml32: StyleToken = mlTokens.ml32!;
export const ml36: StyleToken = mlTokens.ml36!;
export const ml40: StyleToken = mlTokens.ml40!;
export const ml44: StyleToken = mlTokens.ml44!;
export const ml48: StyleToken = mlTokens.ml48!;
export const ml52: StyleToken = mlTokens.ml52!;
export const ml56: StyleToken = mlTokens.ml56!;
export const ml60: StyleToken = mlTokens.ml60!;
export const ml64: StyleToken = mlTokens.ml64!;
export const ml72: StyleToken = mlTokens.ml72!;
export const ml80: StyleToken = mlTokens.ml80!;
export const ml96: StyleToken = mlTokens.ml96!;

// Margin auto exports
export const mAuto: StyleToken = marginAutoTokens.mAuto!;
export const mxAuto: StyleToken = marginAutoTokens.mxAuto!;
export const myAuto: StyleToken = marginAutoTokens.myAuto!;
export const mtAuto: StyleToken = marginAutoTokens.mtAuto!;
export const mrAuto: StyleToken = marginAutoTokens.mrAuto!;
export const mbAuto: StyleToken = marginAutoTokens.mbAuto!;
export const mlAuto: StyleToken = marginAutoTokens.mlAuto!;

// ============================================
// Individual token exports (flat) - Gap
// ============================================

export const gap0: StyleToken = gapTokens.gap0!;
export const gappx: StyleToken = gapTokens.gappx!;
export const gap0_5: StyleToken = gapTokens.gap0_5!;
export const gap1: StyleToken = gapTokens.gap1!;
export const gap1_5: StyleToken = gapTokens.gap1_5!;
export const gap2: StyleToken = gapTokens.gap2!;
export const gap2_5: StyleToken = gapTokens.gap2_5!;
export const gap3: StyleToken = gapTokens.gap3!;
export const gap3_5: StyleToken = gapTokens.gap3_5!;
export const gap4: StyleToken = gapTokens.gap4!;
export const gap5: StyleToken = gapTokens.gap5!;
export const gap6: StyleToken = gapTokens.gap6!;
export const gap7: StyleToken = gapTokens.gap7!;
export const gap8: StyleToken = gapTokens.gap8!;
export const gap9: StyleToken = gapTokens.gap9!;
export const gap10: StyleToken = gapTokens.gap10!;
export const gap11: StyleToken = gapTokens.gap11!;
export const gap12: StyleToken = gapTokens.gap12!;
export const gap14: StyleToken = gapTokens.gap14!;
export const gap16: StyleToken = gapTokens.gap16!;
export const gap20: StyleToken = gapTokens.gap20!;
export const gap24: StyleToken = gapTokens.gap24!;
export const gap28: StyleToken = gapTokens.gap28!;
export const gap32: StyleToken = gapTokens.gap32!;
export const gap36: StyleToken = gapTokens.gap36!;
export const gap40: StyleToken = gapTokens.gap40!;
export const gap44: StyleToken = gapTokens.gap44!;
export const gap48: StyleToken = gapTokens.gap48!;
export const gap52: StyleToken = gapTokens.gap52!;
export const gap56: StyleToken = gapTokens.gap56!;
export const gap60: StyleToken = gapTokens.gap60!;
export const gap64: StyleToken = gapTokens.gap64!;
export const gap72: StyleToken = gapTokens.gap72!;
export const gap80: StyleToken = gapTokens.gap80!;
export const gap96: StyleToken = gapTokens.gap96!;

export const gapX0: StyleToken = gapXTokens.gapX0!;
export const gapXpx: StyleToken = gapXTokens.gapXpx!;
export const gapX0_5: StyleToken = gapXTokens.gapX0_5!;
export const gapX1: StyleToken = gapXTokens.gapX1!;
export const gapX1_5: StyleToken = gapXTokens.gapX1_5!;
export const gapX2: StyleToken = gapXTokens.gapX2!;
export const gapX2_5: StyleToken = gapXTokens.gapX2_5!;
export const gapX3: StyleToken = gapXTokens.gapX3!;
export const gapX3_5: StyleToken = gapXTokens.gapX3_5!;
export const gapX4: StyleToken = gapXTokens.gapX4!;
export const gapX5: StyleToken = gapXTokens.gapX5!;
export const gapX6: StyleToken = gapXTokens.gapX6!;
export const gapX7: StyleToken = gapXTokens.gapX7!;
export const gapX8: StyleToken = gapXTokens.gapX8!;
export const gapX9: StyleToken = gapXTokens.gapX9!;
export const gapX10: StyleToken = gapXTokens.gapX10!;
export const gapX11: StyleToken = gapXTokens.gapX11!;
export const gapX12: StyleToken = gapXTokens.gapX12!;
export const gapX14: StyleToken = gapXTokens.gapX14!;
export const gapX16: StyleToken = gapXTokens.gapX16!;
export const gapX20: StyleToken = gapXTokens.gapX20!;
export const gapX24: StyleToken = gapXTokens.gapX24!;
export const gapX28: StyleToken = gapXTokens.gapX28!;
export const gapX32: StyleToken = gapXTokens.gapX32!;
export const gapX36: StyleToken = gapXTokens.gapX36!;
export const gapX40: StyleToken = gapXTokens.gapX40!;
export const gapX44: StyleToken = gapXTokens.gapX44!;
export const gapX48: StyleToken = gapXTokens.gapX48!;
export const gapX52: StyleToken = gapXTokens.gapX52!;
export const gapX56: StyleToken = gapXTokens.gapX56!;
export const gapX60: StyleToken = gapXTokens.gapX60!;
export const gapX64: StyleToken = gapXTokens.gapX64!;
export const gapX72: StyleToken = gapXTokens.gapX72!;
export const gapX80: StyleToken = gapXTokens.gapX80!;
export const gapX96: StyleToken = gapXTokens.gapX96!;

export const gapY0: StyleToken = gapYTokens.gapY0!;
export const gapYpx: StyleToken = gapYTokens.gapYpx!;
export const gapY0_5: StyleToken = gapYTokens.gapY0_5!;
export const gapY1: StyleToken = gapYTokens.gapY1!;
export const gapY1_5: StyleToken = gapYTokens.gapY1_5!;
export const gapY2: StyleToken = gapYTokens.gapY2!;
export const gapY2_5: StyleToken = gapYTokens.gapY2_5!;
export const gapY3: StyleToken = gapYTokens.gapY3!;
export const gapY3_5: StyleToken = gapYTokens.gapY3_5!;
export const gapY4: StyleToken = gapYTokens.gapY4!;
export const gapY5: StyleToken = gapYTokens.gapY5!;
export const gapY6: StyleToken = gapYTokens.gapY6!;
export const gapY7: StyleToken = gapYTokens.gapY7!;
export const gapY8: StyleToken = gapYTokens.gapY8!;
export const gapY9: StyleToken = gapYTokens.gapY9!;
export const gapY10: StyleToken = gapYTokens.gapY10!;
export const gapY11: StyleToken = gapYTokens.gapY11!;
export const gapY12: StyleToken = gapYTokens.gapY12!;
export const gapY14: StyleToken = gapYTokens.gapY14!;
export const gapY16: StyleToken = gapYTokens.gapY16!;
export const gapY20: StyleToken = gapYTokens.gapY20!;
export const gapY24: StyleToken = gapYTokens.gapY24!;
export const gapY28: StyleToken = gapYTokens.gapY28!;
export const gapY32: StyleToken = gapYTokens.gapY32!;
export const gapY36: StyleToken = gapYTokens.gapY36!;
export const gapY40: StyleToken = gapYTokens.gapY40!;
export const gapY44: StyleToken = gapYTokens.gapY44!;
export const gapY48: StyleToken = gapYTokens.gapY48!;
export const gapY52: StyleToken = gapYTokens.gapY52!;
export const gapY56: StyleToken = gapYTokens.gapY56!;
export const gapY60: StyleToken = gapYTokens.gapY60!;
export const gapY64: StyleToken = gapYTokens.gapY64!;
export const gapY72: StyleToken = gapYTokens.gapY72!;
export const gapY80: StyleToken = gapYTokens.gapY80!;
export const gapY96: StyleToken = gapYTokens.gapY96!;

// ============================================
// Namespace export (grouped)
// ============================================

/** All spacing tokens in a namespace */
export const spacing: Record<string, StyleToken | TaggedUtilityFn> = {
  // Padding
  ...pTokens,
  ...pxTokens,
  ...pyTokens,
  ...ptTokens,
  ...prTokens,
  ...pbTokens,
  ...plTokens,
  // Margin
  ...mTokens,
  ...mxTokens,
  ...myTokens,
  ...mtTokens,
  ...mrTokens,
  ...mbTokens,
  ...mlTokens,
  // Margin auto
  ...marginAutoTokens,
  // Gap
  ...gapTokens,
  ...gapXTokens,
  ...gapYTokens,
  // Arbitrary (tagged templates)
  p,
  px,
  py,
  pt,
  pr,
  pb,
  pl,
  m,
  mx,
  my,
  mt,
  mr,
  mb,
  ml,
  gap,
  gapX,
  gapY,
};

// Type for the spacing namespace
export type SpacingNamespace = typeof spacing;
