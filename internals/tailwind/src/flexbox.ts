/**
 * Flexbox utilities: display, flex, justify, align, etc.
 *
 * Usage:
 * ```ts
 * // Flat exports (recommended)
 * import { flex, flexCol, justifyCenter, itemsCenter, gap4 } from "@semajsx/tailwind";
 * <div class={cx(flex, flexCol, justifyCenter, itemsCenter, gap4)}>
 *
 * // Namespace access
 * import { flexbox } from "@semajsx/tailwind";
 * <div class={cx(flexbox.flex, flexbox.flexCol, flexbox.justifyCenter)}>
 *
 * // Arbitrary values (tagged template)
 * import { basis, order } from "@semajsx/tailwind";
 * <div class={cx(basis`200px`, order`99`)}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createTaggedUtility } from "./core";
import { getConfig } from "./config";

// ============================================
// Scale definitions
// ============================================

// Flex basis scale
const basisScale: Record<string, string> = {
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

// Basis semantic values
const basisSemanticValues: Record<string, string> = {
  auto: "auto",
  full: "100%",
  half: "50%",
  third: "33.333333%",
  twoThirds: "66.666667%",
  quarter: "25%",
  threeQuarters: "75%",
};

// Order scale
const orderScale: Record<string, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  "11": "11",
  "12": "12",
};

// ============================================
// Utility function creators
// ============================================

const flexBasisFn = createUtility("flex-basis", "basis");
const orderFn = createUtility("order", "order");
const flexShorthandFn = createUtility("flex", "flex");

// ============================================
// Token generators
// ============================================

function generateDisplayTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    block: ["block", "block"],
    inlineBlock: ["inline-block", "inline-block"],
    inline: ["inline", "inline"],
    flex: ["flex", "flex"],
    inlineFlex: ["inline-flex", "inline-flex"],
    grid: ["grid", "grid"],
    inlineGrid: ["inline-grid", "inline-grid"],
    contents: ["contents", "contents"],
    hidden: ["hidden", "none"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { display: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateFlexDirectionTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    flexRow: ["flex-row", "row"],
    flexRowReverse: ["flex-row-reverse", "row-reverse"],
    flexCol: ["flex-col", "column"],
    flexColReverse: ["flex-col-reverse", "column-reverse"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { flex-direction: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateFlexWrapTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    flexWrap: ["flex-wrap", "wrap"],
    flexWrapReverse: ["flex-wrap-reverse", "wrap-reverse"],
    flexNowrap: ["flex-nowrap", "nowrap"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { flex-wrap: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateFlexShorthandTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    flex1: ["flex-1", "1 1 0%"],
    flexAuto: ["flex-auto", "1 1 auto"],
    flexInitial: ["flex-initial", "0 1 auto"],
    flexNone: ["flex-none", "none"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { flex: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateGrowShrinkTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  // Grow
  tokens.grow = {
    __kind: "style",
    _: `${prefix}grow`,
    __cssTemplate: `.${prefix}grow { flex-grow: 1; }`,
    toString() {
      return this._;
    },
  };
  tokens.grow0 = {
    __kind: "style",
    _: `${prefix}grow-0`,
    __cssTemplate: `.${prefix}grow-0 { flex-grow: 0; }`,
    toString() {
      return this._;
    },
  };

  // Shrink
  tokens.shrink = {
    __kind: "style",
    _: `${prefix}shrink`,
    __cssTemplate: `.${prefix}shrink { flex-shrink: 1; }`,
    toString() {
      return this._;
    },
  };
  tokens.shrink0 = {
    __kind: "style",
    _: `${prefix}shrink-0`,
    __cssTemplate: `.${prefix}shrink-0 { flex-shrink: 0; }`,
    toString() {
      return this._;
    },
  };

  return tokens;
}

function generateBasisTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  // Number tokens: basis0, basis4, etc.
  // Decimal tokens use underscore: basis0_5, basis1_5, etc.
  for (const [key, value] of Object.entries(basisScale)) {
    const tokenName = `basis${key.replace(".", "_")}`;
    tokens[tokenName] = flexBasisFn(value, key);
  }

  // px token
  tokens.basispx = flexBasisFn("1px", "px");

  // Semantic tokens: basisAuto, basisFull, basisHalf
  for (const [key, value] of Object.entries(basisSemanticValues)) {
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const tokenName = `basis${capKey}`;
    tokens[tokenName] = flexBasisFn(value, key);
  }

  return tokens;
}

function generateJustifyContentTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    justifyNormal: ["justify-normal", "normal"],
    justifyStart: ["justify-start", "flex-start"],
    justifyEnd: ["justify-end", "flex-end"],
    justifyCenter: ["justify-center", "center"],
    justifyBetween: ["justify-between", "space-between"],
    justifyAround: ["justify-around", "space-around"],
    justifyEvenly: ["justify-evenly", "space-evenly"],
    justifyStretch: ["justify-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { justify-content: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateJustifyItemsTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    justifyItemsStart: ["justify-items-start", "start"],
    justifyItemsEnd: ["justify-items-end", "end"],
    justifyItemsCenter: ["justify-items-center", "center"],
    justifyItemsStretch: ["justify-items-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { justify-items: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateJustifySelfTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    justifySelfAuto: ["justify-self-auto", "auto"],
    justifySelfStart: ["justify-self-start", "start"],
    justifySelfEnd: ["justify-self-end", "end"],
    justifySelfCenter: ["justify-self-center", "center"],
    justifySelfStretch: ["justify-self-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { justify-self: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateAlignContentTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    contentNormal: ["content-normal", "normal"],
    contentStart: ["content-start", "flex-start"],
    contentEnd: ["content-end", "flex-end"],
    contentCenter: ["content-center", "center"],
    contentBetween: ["content-between", "space-between"],
    contentAround: ["content-around", "space-around"],
    contentEvenly: ["content-evenly", "space-evenly"],
    contentBaseline: ["content-baseline", "baseline"],
    contentStretch: ["content-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { align-content: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateAlignItemsTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    itemsStart: ["items-start", "flex-start"],
    itemsEnd: ["items-end", "flex-end"],
    itemsCenter: ["items-center", "center"],
    itemsBaseline: ["items-baseline", "baseline"],
    itemsStretch: ["items-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { align-items: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateAlignSelfTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    selfAuto: ["self-auto", "auto"],
    selfStart: ["self-start", "flex-start"],
    selfEnd: ["self-end", "flex-end"],
    selfCenter: ["self-center", "center"],
    selfBaseline: ["self-baseline", "baseline"],
    selfStretch: ["self-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { align-self: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generatePlaceContentTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    placeContentStart: ["place-content-start", "start"],
    placeContentEnd: ["place-content-end", "end"],
    placeContentCenter: ["place-content-center", "center"],
    placeContentBetween: ["place-content-between", "space-between"],
    placeContentAround: ["place-content-around", "space-around"],
    placeContentEvenly: ["place-content-evenly", "space-evenly"],
    placeContentBaseline: ["place-content-baseline", "baseline"],
    placeContentStretch: ["place-content-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { place-content: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generatePlaceItemsTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    placeItemsStart: ["place-items-start", "start"],
    placeItemsEnd: ["place-items-end", "end"],
    placeItemsCenter: ["place-items-center", "center"],
    placeItemsBaseline: ["place-items-baseline", "baseline"],
    placeItemsStretch: ["place-items-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { place-items: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generatePlaceSelfTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};
  const cfg = getConfig();
  const prefix = cfg.prefix ?? "";

  const values: Record<string, [string, string]> = {
    placeSelfAuto: ["place-self-auto", "auto"],
    placeSelfStart: ["place-self-start", "start"],
    placeSelfEnd: ["place-self-end", "end"],
    placeSelfCenter: ["place-self-center", "center"],
    placeSelfStretch: ["place-self-stretch", "stretch"],
  };

  for (const [key, [className, value]] of Object.entries(values)) {
    tokens[key] = {
      __kind: "style",
      _: `${prefix}${className}`,
      __cssTemplate: `.${prefix}${className} { place-self: ${value}; }`,
      toString() {
        return this._;
      },
    };
  }

  return tokens;
}

function generateOrderTokens(): Record<string, StyleToken> {
  const tokens: Record<string, StyleToken> = {};

  // Number tokens: order1, order2, etc.
  for (const [key, value] of Object.entries(orderScale)) {
    const tokenName = `order${key}`;
    tokens[tokenName] = orderFn(value, key);
  }

  // Semantic tokens
  tokens.orderFirst = orderFn("-9999", "first");
  tokens.orderLast = orderFn("9999", "last");
  tokens.orderNone = orderFn("0", "none");

  return tokens;
}

// ============================================
// Generate all tokens
// ============================================

const displayTokens = generateDisplayTokens();
const flexDirectionTokens = generateFlexDirectionTokens();
const flexWrapTokens = generateFlexWrapTokens();
const flexShorthandTokens = generateFlexShorthandTokens();
const growShrinkTokens = generateGrowShrinkTokens();
const basisTokens = generateBasisTokens();
const justifyContentTokens = generateJustifyContentTokens();
const justifyItemsTokens = generateJustifyItemsTokens();
const justifySelfTokens = generateJustifySelfTokens();
const alignContentTokens = generateAlignContentTokens();
const alignItemsTokens = generateAlignItemsTokens();
const alignSelfTokens = generateAlignSelfTokens();
const placeContentTokens = generatePlaceContentTokens();
const placeItemsTokens = generatePlaceItemsTokens();
const placeSelfTokens = generatePlaceSelfTokens();
const orderTokens = generateOrderTokens();

// ============================================
// Tagged template functions for arbitrary values
// ============================================

/** Flex basis - arbitrary value: basis`200px` */
export const basis: TaggedUtilityFn = createTaggedUtility(flexBasisFn);

/** Order - arbitrary value: order`99` */
export const order: TaggedUtilityFn = createTaggedUtility(orderFn);

/** Flex shorthand - arbitrary value: flexArb`2 2 0%` */
export const flexArb: TaggedUtilityFn = createTaggedUtility(flexShorthandFn);

// ============================================
// Individual token exports (flat) - Display
// ============================================

export const block: StyleToken = displayTokens.block!;
export const inlineBlock: StyleToken = displayTokens.inlineBlock!;
export const inline: StyleToken = displayTokens.inline!;
export const flex: StyleToken = displayTokens.flex!;
export const inlineFlex: StyleToken = displayTokens.inlineFlex!;
export const grid: StyleToken = displayTokens.grid!;
export const inlineGrid: StyleToken = displayTokens.inlineGrid!;
export const contents: StyleToken = displayTokens.contents!;
export const hidden: StyleToken = displayTokens.hidden!;

// ============================================
// Individual token exports (flat) - Flex Direction
// ============================================

export const flexRow: StyleToken = flexDirectionTokens.flexRow!;
export const flexRowReverse: StyleToken = flexDirectionTokens.flexRowReverse!;
export const flexCol: StyleToken = flexDirectionTokens.flexCol!;
export const flexColReverse: StyleToken = flexDirectionTokens.flexColReverse!;

// ============================================
// Individual token exports (flat) - Flex Wrap
// ============================================

export const flexWrap: StyleToken = flexWrapTokens.flexWrap!;
export const flexWrapReverse: StyleToken = flexWrapTokens.flexWrapReverse!;
export const flexNowrap: StyleToken = flexWrapTokens.flexNowrap!;

// ============================================
// Individual token exports (flat) - Flex Shorthand
// ============================================

export const flex1: StyleToken = flexShorthandTokens.flex1!;
export const flexAuto: StyleToken = flexShorthandTokens.flexAuto!;
export const flexInitial: StyleToken = flexShorthandTokens.flexInitial!;
export const flexNone: StyleToken = flexShorthandTokens.flexNone!;

// ============================================
// Individual token exports (flat) - Grow/Shrink
// ============================================

export const grow: StyleToken = growShrinkTokens.grow!;
export const grow0: StyleToken = growShrinkTokens.grow0!;
export const shrink: StyleToken = growShrinkTokens.shrink!;
export const shrink0: StyleToken = growShrinkTokens.shrink0!;

// ============================================
// Individual token exports (flat) - Basis
// ============================================

export const basis0: StyleToken = basisTokens.basis0!;
export const basis0_5: StyleToken = basisTokens.basis0_5!;
export const basispx: StyleToken = basisTokens.basispx!;
export const basis1: StyleToken = basisTokens.basis1!;
export const basis1_5: StyleToken = basisTokens.basis1_5!;
export const basis2: StyleToken = basisTokens.basis2!;
export const basis2_5: StyleToken = basisTokens.basis2_5!;
export const basis3: StyleToken = basisTokens.basis3!;
export const basis3_5: StyleToken = basisTokens.basis3_5!;
export const basis4: StyleToken = basisTokens.basis4!;
export const basis5: StyleToken = basisTokens.basis5!;
export const basis6: StyleToken = basisTokens.basis6!;
export const basis7: StyleToken = basisTokens.basis7!;
export const basis8: StyleToken = basisTokens.basis8!;
export const basis9: StyleToken = basisTokens.basis9!;
export const basis10: StyleToken = basisTokens.basis10!;
export const basis11: StyleToken = basisTokens.basis11!;
export const basis12: StyleToken = basisTokens.basis12!;
export const basis14: StyleToken = basisTokens.basis14!;
export const basis16: StyleToken = basisTokens.basis16!;
export const basis20: StyleToken = basisTokens.basis20!;
export const basis24: StyleToken = basisTokens.basis24!;
export const basis28: StyleToken = basisTokens.basis28!;
export const basis32: StyleToken = basisTokens.basis32!;
export const basis36: StyleToken = basisTokens.basis36!;
export const basis40: StyleToken = basisTokens.basis40!;
export const basis44: StyleToken = basisTokens.basis44!;
export const basis48: StyleToken = basisTokens.basis48!;
export const basis52: StyleToken = basisTokens.basis52!;
export const basis56: StyleToken = basisTokens.basis56!;
export const basis60: StyleToken = basisTokens.basis60!;
export const basis64: StyleToken = basisTokens.basis64!;
export const basis72: StyleToken = basisTokens.basis72!;
export const basis80: StyleToken = basisTokens.basis80!;
export const basis96: StyleToken = basisTokens.basis96!;
export const basisAuto: StyleToken = basisTokens.basisAuto!;
export const basisFull: StyleToken = basisTokens.basisFull!;
export const basisHalf: StyleToken = basisTokens.basisHalf!;
export const basisThird: StyleToken = basisTokens.basisThird!;
export const basisTwoThirds: StyleToken = basisTokens.basisTwoThirds!;
export const basisQuarter: StyleToken = basisTokens.basisQuarter!;
export const basisThreeQuarters: StyleToken = basisTokens.basisThreeQuarters!;

// ============================================
// Individual token exports (flat) - Justify Content
// ============================================

export const justifyNormal: StyleToken = justifyContentTokens.justifyNormal!;
export const justifyStart: StyleToken = justifyContentTokens.justifyStart!;
export const justifyEnd: StyleToken = justifyContentTokens.justifyEnd!;
export const justifyCenter: StyleToken = justifyContentTokens.justifyCenter!;
export const justifyBetween: StyleToken = justifyContentTokens.justifyBetween!;
export const justifyAround: StyleToken = justifyContentTokens.justifyAround!;
export const justifyEvenly: StyleToken = justifyContentTokens.justifyEvenly!;
export const justifyStretch: StyleToken = justifyContentTokens.justifyStretch!;

// ============================================
// Individual token exports (flat) - Justify Items
// ============================================

export const justifyItemsStart: StyleToken = justifyItemsTokens.justifyItemsStart!;
export const justifyItemsEnd: StyleToken = justifyItemsTokens.justifyItemsEnd!;
export const justifyItemsCenter: StyleToken = justifyItemsTokens.justifyItemsCenter!;
export const justifyItemsStretch: StyleToken = justifyItemsTokens.justifyItemsStretch!;

// ============================================
// Individual token exports (flat) - Justify Self
// ============================================

export const justifySelfAuto: StyleToken = justifySelfTokens.justifySelfAuto!;
export const justifySelfStart: StyleToken = justifySelfTokens.justifySelfStart!;
export const justifySelfEnd: StyleToken = justifySelfTokens.justifySelfEnd!;
export const justifySelfCenter: StyleToken = justifySelfTokens.justifySelfCenter!;
export const justifySelfStretch: StyleToken = justifySelfTokens.justifySelfStretch!;

// ============================================
// Individual token exports (flat) - Align Content
// ============================================

export const contentNormal: StyleToken = alignContentTokens.contentNormal!;
export const contentStart: StyleToken = alignContentTokens.contentStart!;
export const contentEnd: StyleToken = alignContentTokens.contentEnd!;
export const contentCenter: StyleToken = alignContentTokens.contentCenter!;
export const contentBetween: StyleToken = alignContentTokens.contentBetween!;
export const contentAround: StyleToken = alignContentTokens.contentAround!;
export const contentEvenly: StyleToken = alignContentTokens.contentEvenly!;
export const contentBaseline: StyleToken = alignContentTokens.contentBaseline!;
export const contentStretch: StyleToken = alignContentTokens.contentStretch!;

// ============================================
// Individual token exports (flat) - Align Items
// ============================================

export const itemsStart: StyleToken = alignItemsTokens.itemsStart!;
export const itemsEnd: StyleToken = alignItemsTokens.itemsEnd!;
export const itemsCenter: StyleToken = alignItemsTokens.itemsCenter!;
export const itemsBaseline: StyleToken = alignItemsTokens.itemsBaseline!;
export const itemsStretch: StyleToken = alignItemsTokens.itemsStretch!;

// ============================================
// Individual token exports (flat) - Align Self
// ============================================

export const selfAuto: StyleToken = alignSelfTokens.selfAuto!;
export const selfStart: StyleToken = alignSelfTokens.selfStart!;
export const selfEnd: StyleToken = alignSelfTokens.selfEnd!;
export const selfCenter: StyleToken = alignSelfTokens.selfCenter!;
export const selfBaseline: StyleToken = alignSelfTokens.selfBaseline!;
export const selfStretch: StyleToken = alignSelfTokens.selfStretch!;

// ============================================
// Individual token exports (flat) - Place Content
// ============================================

export const placeContentStart: StyleToken = placeContentTokens.placeContentStart!;
export const placeContentEnd: StyleToken = placeContentTokens.placeContentEnd!;
export const placeContentCenter: StyleToken = placeContentTokens.placeContentCenter!;
export const placeContentBetween: StyleToken = placeContentTokens.placeContentBetween!;
export const placeContentAround: StyleToken = placeContentTokens.placeContentAround!;
export const placeContentEvenly: StyleToken = placeContentTokens.placeContentEvenly!;
export const placeContentBaseline: StyleToken = placeContentTokens.placeContentBaseline!;
export const placeContentStretch: StyleToken = placeContentTokens.placeContentStretch!;

// ============================================
// Individual token exports (flat) - Place Items
// ============================================

export const placeItemsStart: StyleToken = placeItemsTokens.placeItemsStart!;
export const placeItemsEnd: StyleToken = placeItemsTokens.placeItemsEnd!;
export const placeItemsCenter: StyleToken = placeItemsTokens.placeItemsCenter!;
export const placeItemsBaseline: StyleToken = placeItemsTokens.placeItemsBaseline!;
export const placeItemsStretch: StyleToken = placeItemsTokens.placeItemsStretch!;

// ============================================
// Individual token exports (flat) - Place Self
// ============================================

export const placeSelfAuto: StyleToken = placeSelfTokens.placeSelfAuto!;
export const placeSelfStart: StyleToken = placeSelfTokens.placeSelfStart!;
export const placeSelfEnd: StyleToken = placeSelfTokens.placeSelfEnd!;
export const placeSelfCenter: StyleToken = placeSelfTokens.placeSelfCenter!;
export const placeSelfStretch: StyleToken = placeSelfTokens.placeSelfStretch!;

// ============================================
// Individual token exports (flat) - Order
// ============================================

export const order1: StyleToken = orderTokens.order1!;
export const order2: StyleToken = orderTokens.order2!;
export const order3: StyleToken = orderTokens.order3!;
export const order4: StyleToken = orderTokens.order4!;
export const order5: StyleToken = orderTokens.order5!;
export const order6: StyleToken = orderTokens.order6!;
export const order7: StyleToken = orderTokens.order7!;
export const order8: StyleToken = orderTokens.order8!;
export const order9: StyleToken = orderTokens.order9!;
export const order10: StyleToken = orderTokens.order10!;
export const order11: StyleToken = orderTokens.order11!;
export const order12: StyleToken = orderTokens.order12!;
export const orderFirst: StyleToken = orderTokens.orderFirst!;
export const orderLast: StyleToken = orderTokens.orderLast!;
export const orderNone: StyleToken = orderTokens.orderNone!;

// ============================================
// Namespace export (grouped)
// ============================================

/** All flexbox tokens in a namespace */
export const flexbox: Record<string, StyleToken | TaggedUtilityFn> = {
  // Display
  ...displayTokens,
  // Flex direction
  ...flexDirectionTokens,
  // Flex wrap
  ...flexWrapTokens,
  // Flex shorthand
  ...flexShorthandTokens,
  // Grow/Shrink
  ...growShrinkTokens,
  // Basis
  ...basisTokens,
  // Justify content
  ...justifyContentTokens,
  // Justify items
  ...justifyItemsTokens,
  // Justify self
  ...justifySelfTokens,
  // Align content
  ...alignContentTokens,
  // Align items
  ...alignItemsTokens,
  // Align self
  ...alignSelfTokens,
  // Place content
  ...placeContentTokens,
  // Place items
  ...placeItemsTokens,
  // Place self
  ...placeSelfTokens,
  // Order
  ...orderTokens,
  // Arbitrary (tagged templates)
  basis,
  order,
  flexArb,
};

// Type for the flexbox namespace
export type FlexboxNamespace = typeof flexbox;

// Legacy type exports for backwards compatibility
export type FlexValues = Record<string, StyleToken>;
export type FlexboxGroup = FlexboxNamespace;

// Legacy exports for backwards compatibility
export const flexboxArb: Record<string, TaggedUtilityFn> = {
  basis,
  order,
  flex: flexArb,
};

// Legacy proxy exports (for backwards compatibility)
export const display: Record<string, StyleToken> = displayTokens;
export const flexDirection: Record<string, StyleToken> = flexDirectionTokens;
export const flexWrapProxy: Record<string, StyleToken> = flexWrapTokens;
export const justify: Record<string, StyleToken> = justifyContentTokens;
export const justifyItems: Record<string, StyleToken> = justifyItemsTokens;
export const justifySelf: Record<string, StyleToken> = justifySelfTokens;
export const content: Record<string, StyleToken> = alignContentTokens;
export const items: Record<string, StyleToken> = alignItemsTokens;
export const self: Record<string, StyleToken> = alignSelfTokens;
export const placeContent: Record<string, StyleToken> = placeContentTokens;
export const placeItems: Record<string, StyleToken> = placeItemsTokens;
export const placeSelf: Record<string, StyleToken> = placeSelfTokens;
