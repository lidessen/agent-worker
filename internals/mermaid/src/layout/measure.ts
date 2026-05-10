import type { LayoutOptions, Size } from "../types";

/**
 * Per-character width multipliers relative to fontSize, derived from
 * font metrics of common sans-serif typefaces (Helvetica / Arial).
 * Covers ASCII printable range; anything outside falls back to a
 * sensible default (0.55 for Latin, 1.0 for CJK / fullwidth).
 */
const CHAR_WIDTH: Record<string, number> = {
  // Narrow characters
  " ": 0.28,
  "!": 0.28,
  "'": 0.19,
  ",": 0.28,
  ".": 0.28,
  ":": 0.28,
  ";": 0.28,
  i: 0.22,
  j: 0.22,
  l: 0.22,
  f: 0.28,
  r: 0.33,
  t: 0.33,
  I: 0.22,
  "|": 0.22,

  // Medium characters
  a: 0.5,
  b: 0.55,
  c: 0.5,
  d: 0.55,
  e: 0.5,
  g: 0.55,
  h: 0.55,
  k: 0.5,
  n: 0.55,
  o: 0.55,
  p: 0.55,
  q: 0.55,
  s: 0.5,
  u: 0.55,
  v: 0.5,
  x: 0.5,
  y: 0.5,
  z: 0.5,
  "0": 0.55,
  "1": 0.55,
  "2": 0.55,
  "3": 0.55,
  "4": 0.55,
  "5": 0.55,
  "6": 0.55,
  "7": 0.55,
  "8": 0.55,
  "9": 0.55,
  "-": 0.33,
  "(": 0.33,
  ")": 0.33,
  "/": 0.28,

  // Wide characters
  m: 0.83,
  w: 0.72,
  M: 0.72,
  W: 0.83,
  A: 0.67,
  B: 0.67,
  C: 0.67,
  D: 0.72,
  E: 0.61,
  F: 0.56,
  G: 0.72,
  H: 0.72,
  J: 0.5,
  K: 0.67,
  L: 0.56,
  N: 0.72,
  O: 0.72,
  P: 0.67,
  Q: 0.72,
  R: 0.67,
  S: 0.67,
  T: 0.61,
  U: 0.72,
  V: 0.67,
  X: 0.67,
  Y: 0.67,
  Z: 0.61,
  "@": 0.92,
  "#": 0.55,
  $: 0.55,
  "%": 0.89,
  "&": 0.67,
  "+": 0.58,
  "=": 0.58,
  "<": 0.58,
  ">": 0.58,
  _: 0.55,
  "{": 0.33,
  "}": 0.33,
  "[": 0.28,
  "]": 0.28,
  '"': 0.35,
  "~": 0.58,
  "^": 0.47,
  "*": 0.39,
  "\\": 0.28,
  "`": 0.33,
  "?": 0.56,
};

/** Default multiplier for unlisted Latin / symbol characters. */
const DEFAULT_CHAR_WIDTH = 0.55;

/**
 * Check whether a code point is in a CJK / fullwidth Unicode range.
 * These characters are typically rendered at roughly 1em width.
 */
function isCJKOrFullwidth(code: number): boolean {
  return (
    (code >= 0x2e80 && code <= 0x9fff) || // CJK radicals, Kangxi, ideographs
    (code >= 0xf900 && code <= 0xfaff) || // CJK compat ideographs
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK compat forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
    (code >= 0x20000 && code <= 0x2fa1f) || // CJK extension B+
    (code >= 0x3000 && code <= 0x303f) || // CJK symbols & punctuation
    (code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
    (code >= 0xac00 && code <= 0xd7af) // Hangul syllables
  );
}

/**
 * Estimate text dimensions using per-character width tables.
 * Falls back to this when no Canvas / DOM measurement is available.
 */
export function estimateTextSize(text: string, fontSize: number): Size {
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const known = CHAR_WIDTH[ch];
    if (known !== undefined) {
      totalWidth += known;
    } else {
      const code = ch.charCodeAt(0);
      totalWidth += isCJKOrFullwidth(code) ? 1.0 : DEFAULT_CHAR_WIDTH;
    }
  }
  return {
    width: totalWidth * fontSize,
    height: fontSize * 1.4,
  };
}

/**
 * Canvas-based text measurement. Creates a shared offscreen canvas
 * on first call and reuses it. Returns precise pixel dimensions
 * for the given text and font size (assumes sans-serif family).
 */
interface MeasureContext {
  font: string;
  measureText(text: string): { width: number };
}

let _ctx: MeasureContext | undefined | null;

export function canvasMeasureText(text: string, fontSize: number): Size {
  if (_ctx === undefined) {
    _ctx = null;
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        _ctx = new OffscreenCanvas(1, 1).getContext("2d") as MeasureContext | null;
      } else if (typeof document !== "undefined") {
        _ctx = document.createElement("canvas").getContext("2d") as MeasureContext | null;
      }
    } catch {
      // No canvas available (SSR / worker without OffscreenCanvas)
    }
  }
  if (_ctx) {
    _ctx.font = `${fontSize}px sans-serif`;
    const metrics = _ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSize * 1.2,
    };
  }
  // Fallback to character-table estimation
  return estimateTextSize(text, fontSize);
}

/** Measure a node label (default 14px). */
export function measureNode(label: string, opts: LayoutOptions): Size {
  const measure = opts.measureText ?? canvasMeasureText;
  const textSize = measure(label, 14);
  return {
    width: Math.max(textSize.width + opts.nodePadding * 2, opts.nodeWidth),
    height: Math.max(textSize.height + opts.nodePadding * 2, opts.nodeHeight),
  };
}

/** Measure an edge / message label (default 12px). */
export function measureLabel(text: string, opts: LayoutOptions): Size {
  const measure = opts.measureText ?? canvasMeasureText;
  return measure(text, 12);
}
