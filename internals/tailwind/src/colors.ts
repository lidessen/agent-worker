/**
 * Color utilities: background, text, border colors
 *
 * Usage:
 * ```ts
 * // Predefined values (via Proxy)
 * import { bg, text, border } from "@semajsx/tailwind";
 * <div class={[bg.blue500, text.white, border.gray200]}>
 *
 * // Destructuring works
 * const { blue500, red600 } = bg;
 *
 * // Arbitrary values (tagged template - same function!)
 * <div class={[bg`#ff5500`, text`currentColor`]}>
 * ```
 */

import type { StyleToken, TaggedUtilityFn } from "./types";
import { createUtility, createTaggedUtility } from "./core";

/** Type for color value records */
export type ColorValues = Record<string, StyleToken>;

// Tailwind color palette (all shades)
const colorPalette: Record<string, Record<string, string>> = {
  slate: {
    "50": "#f8fafc",
    "100": "#f1f5f9",
    "200": "#e2e8f0",
    "300": "#cbd5e1",
    "400": "#94a3b8",
    "500": "#64748b",
    "600": "#475569",
    "700": "#334155",
    "800": "#1e293b",
    "900": "#0f172a",
    "950": "#020617",
  },
  gray: {
    "50": "#f9fafb",
    "100": "#f3f4f6",
    "200": "#e5e7eb",
    "300": "#d1d5db",
    "400": "#9ca3af",
    "500": "#6b7280",
    "600": "#4b5563",
    "700": "#374151",
    "800": "#1f2937",
    "900": "#111827",
    "950": "#030712",
  },
  zinc: {
    "50": "#fafafa",
    "100": "#f4f4f5",
    "200": "#e4e4e7",
    "300": "#d4d4d8",
    "400": "#a1a1aa",
    "500": "#71717a",
    "600": "#52525b",
    "700": "#3f3f46",
    "800": "#27272a",
    "900": "#18181b",
    "950": "#09090b",
  },
  neutral: {
    "50": "#fafafa",
    "100": "#f5f5f5",
    "200": "#e5e5e5",
    "300": "#d4d4d4",
    "400": "#a3a3a3",
    "500": "#737373",
    "600": "#525252",
    "700": "#404040",
    "800": "#262626",
    "900": "#171717",
    "950": "#0a0a0a",
  },
  stone: {
    "50": "#fafaf9",
    "100": "#f5f5f4",
    "200": "#e7e5e4",
    "300": "#d6d3d1",
    "400": "#a8a29e",
    "500": "#78716c",
    "600": "#57534e",
    "700": "#44403c",
    "800": "#292524",
    "900": "#1c1917",
    "950": "#0c0a09",
  },
  red: {
    "50": "#fef2f2",
    "100": "#fee2e2",
    "200": "#fecaca",
    "300": "#fca5a5",
    "400": "#f87171",
    "500": "#ef4444",
    "600": "#dc2626",
    "700": "#b91c1c",
    "800": "#991b1b",
    "900": "#7f1d1d",
    "950": "#450a0a",
  },
  orange: {
    "50": "#fff7ed",
    "100": "#ffedd5",
    "200": "#fed7aa",
    "300": "#fdba74",
    "400": "#fb923c",
    "500": "#f97316",
    "600": "#ea580c",
    "700": "#c2410c",
    "800": "#9a3412",
    "900": "#7c2d12",
    "950": "#431407",
  },
  amber: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    "950": "#451a03",
  },
  yellow: {
    "50": "#fefce8",
    "100": "#fef9c3",
    "200": "#fef08a",
    "300": "#fde047",
    "400": "#facc15",
    "500": "#eab308",
    "600": "#ca8a04",
    "700": "#a16207",
    "800": "#854d0e",
    "900": "#713f12",
    "950": "#422006",
  },
  lime: {
    "50": "#f7fee7",
    "100": "#ecfccb",
    "200": "#d9f99d",
    "300": "#bef264",
    "400": "#a3e635",
    "500": "#84cc16",
    "600": "#65a30d",
    "700": "#4d7c0f",
    "800": "#3f6212",
    "900": "#365314",
    "950": "#1a2e05",
  },
  green: {
    "50": "#f0fdf4",
    "100": "#dcfce7",
    "200": "#bbf7d0",
    "300": "#86efac",
    "400": "#4ade80",
    "500": "#22c55e",
    "600": "#16a34a",
    "700": "#15803d",
    "800": "#166534",
    "900": "#14532d",
    "950": "#052e16",
  },
  emerald: {
    "50": "#ecfdf5",
    "100": "#d1fae5",
    "200": "#a7f3d0",
    "300": "#6ee7b7",
    "400": "#34d399",
    "500": "#10b981",
    "600": "#059669",
    "700": "#047857",
    "800": "#065f46",
    "900": "#064e3b",
    "950": "#022c22",
  },
  teal: {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    "950": "#042f2e",
  },
  cyan: {
    "50": "#ecfeff",
    "100": "#cffafe",
    "200": "#a5f3fc",
    "300": "#67e8f9",
    "400": "#22d3ee",
    "500": "#06b6d4",
    "600": "#0891b2",
    "700": "#0e7490",
    "800": "#155e75",
    "900": "#164e63",
    "950": "#083344",
  },
  sky: {
    "50": "#f0f9ff",
    "100": "#e0f2fe",
    "200": "#bae6fd",
    "300": "#7dd3fc",
    "400": "#38bdf8",
    "500": "#0ea5e9",
    "600": "#0284c7",
    "700": "#0369a1",
    "800": "#075985",
    "900": "#0c4a6e",
    "950": "#082f49",
  },
  blue: {
    "50": "#eff6ff",
    "100": "#dbeafe",
    "200": "#bfdbfe",
    "300": "#93c5fd",
    "400": "#60a5fa",
    "500": "#3b82f6",
    "600": "#2563eb",
    "700": "#1d4ed8",
    "800": "#1e40af",
    "900": "#1e3a8a",
    "950": "#172554",
  },
  indigo: {
    "50": "#eef2ff",
    "100": "#e0e7ff",
    "200": "#c7d2fe",
    "300": "#a5b4fc",
    "400": "#818cf8",
    "500": "#6366f1",
    "600": "#4f46e5",
    "700": "#4338ca",
    "800": "#3730a3",
    "900": "#312e81",
    "950": "#1e1b4b",
  },
  violet: {
    "50": "#f5f3ff",
    "100": "#ede9fe",
    "200": "#ddd6fe",
    "300": "#c4b5fd",
    "400": "#a78bfa",
    "500": "#8b5cf6",
    "600": "#7c3aed",
    "700": "#6d28d9",
    "800": "#5b21b6",
    "900": "#4c1d95",
    "950": "#2e1065",
  },
  purple: {
    "50": "#faf5ff",
    "100": "#f3e8ff",
    "200": "#e9d5ff",
    "300": "#d8b4fe",
    "400": "#c084fc",
    "500": "#a855f7",
    "600": "#9333ea",
    "700": "#7e22ce",
    "800": "#6b21a8",
    "900": "#581c87",
    "950": "#3b0764",
  },
  fuchsia: {
    "50": "#fdf4ff",
    "100": "#fae8ff",
    "200": "#f5d0fe",
    "300": "#f0abfc",
    "400": "#e879f9",
    "500": "#d946ef",
    "600": "#c026d3",
    "700": "#a21caf",
    "800": "#86198f",
    "900": "#701a75",
    "950": "#4a044e",
  },
  pink: {
    "50": "#fdf2f8",
    "100": "#fce7f3",
    "200": "#fbcfe8",
    "300": "#f9a8d4",
    "400": "#f472b6",
    "500": "#ec4899",
    "600": "#db2777",
    "700": "#be185d",
    "800": "#9d174d",
    "900": "#831843",
    "950": "#500724",
  },
  rose: {
    "50": "#fff1f2",
    "100": "#ffe4e6",
    "200": "#fecdd3",
    "300": "#fda4af",
    "400": "#fb7185",
    "500": "#f43f5e",
    "600": "#e11d48",
    "700": "#be123c",
    "800": "#9f1239",
    "900": "#881337",
    "950": "#4c0519",
  },
};

// Special color values
const specialColors: Record<string, string> = {
  inherit: "inherit",
  current: "currentColor",
  transparent: "transparent",
  black: "#000",
  white: "#fff",
};

// Create utility functions
const bgFn = createUtility("background-color", "bg");
const textFn = createUtility("color", "text");
const borderFn = createUtility("border-color", "border");

// Get color value by key (e.g., "white", "blue500", "gray-200")
function getColorValue(colorKey: string): string | undefined {
  // Check special colors first (lowercase)
  const lowerKey = colorKey.toLowerCase();
  if (lowerKey in specialColors) {
    return specialColors[lowerKey];
  }

  // Try to parse as colorName + shade (e.g., "blue500" or "blue-500")
  // Pattern: letters followed by numbers, or letters-numbers
  const match = colorKey.match(/^([a-zA-Z]+)-?(\d+)$/);
  if (match) {
    const [, colorName, shade] = match;
    const palette = colorPalette[colorName!.toLowerCase()];
    if (palette && shade! in palette) {
      return palette[shade!];
    }
  }

  return undefined;
}

// Get all color keys for enumeration
function getAllColorKeys(): string[] {
  const keys: string[] = Object.keys(specialColors);
  for (const [colorName, shades] of Object.entries(colorPalette)) {
    for (const shade of Object.keys(shades)) {
      // Use format "colorName + shade" (e.g., "blue500")
      keys.push(`${colorName}${shade}`);
    }
  }
  return keys;
}

// Parse property name (e.g., "blue500", "white", "gray200")
function parseColorProp(prop: string): string | null {
  if (getColorValue(prop) !== undefined) {
    return prop;
  }
  return null;
}

/**
 * Create a color utility that works as both:
 * - Proxy namespace for predefined values: bg.blue500
 * - Tagged template function for arbitrary values: bg`#ff5500`
 */
function createColorUtility(
  utilityFn: (value: string, valueName?: string) => StyleToken,
  _classPrefix: string,
): TaggedUtilityFn & ColorValues {
  // Cache for generated tokens
  const tokenCache = new Map<string, StyleToken>();

  // Create the tagged template function
  const taggedFn = createTaggedUtility(utilityFn);

  // Create proxy handler for property access
  const handler: ProxyHandler<TaggedUtilityFn> = {
    get(target, prop: string): StyleToken | undefined {
      // Handle function properties
      if (prop === "length" || prop === "name" || prop === "prototype") {
        return (target as unknown as Record<string, unknown>)[prop] as StyleToken | undefined;
      }

      // Check cache first
      if (tokenCache.has(prop)) {
        return tokenCache.get(prop);
      }

      // Try to resolve as color
      const cssValue = getColorValue(prop);
      if (cssValue) {
        // Convert prop to Tailwind-style class name
        // "blue500" -> "blue-500", "white" -> "white"
        const className = prop.match(/^([a-zA-Z]+)(\d+)$/)
          ? prop.replace(/([a-zA-Z]+)(\d+)/, "$1-$2").toLowerCase()
          : prop.toLowerCase();

        const token = utilityFn(cssValue, className);
        tokenCache.set(prop, token);
        return token;
      }

      return undefined;
    },

    has(_target, prop: string): boolean {
      return parseColorProp(prop) !== null;
    },

    apply(target, thisArg, args) {
      // Handle tagged template call
      return Reflect.apply(target, thisArg, args);
    },

    ownKeys(): string[] {
      return getAllColorKeys();
    },

    getOwnPropertyDescriptor(_target, prop: string) {
      if (parseColorProp(prop)) {
        return {
          enumerable: true,
          configurable: true,
          get: () => this.get!(_target, prop, _target),
        };
      }
      return undefined;
    },
  };

  return new Proxy(taggedFn, handler) as TaggedUtilityFn & ColorValues;
}

// ============================================
// Color Utilities (both namespace and tagged template)
// ============================================

/**
 * Background color utility
 *
 * @example
 * ```ts
 * // Predefined values
 * bg.blue500    // background-color: #3b82f6
 * bg.white      // background-color: #fff
 *
 * // Arbitrary values
 * bg`#ff5500`   // background-color: #ff5500
 * ```
 */
export const bg: TaggedUtilityFn & ColorValues = createColorUtility(bgFn, "bg");

/**
 * Text color utility
 *
 * @example
 * ```ts
 * // Predefined values
 * text.gray700  // color: #374151
 * text.white    // color: #fff
 *
 * // Arbitrary values
 * text`#333`    // color: #333
 * ```
 */
export const text: TaggedUtilityFn & ColorValues = createColorUtility(textFn, "text");

/**
 * Border color utility
 *
 * @example
 * ```ts
 * // Predefined values
 * border.gray200  // border-color: #e5e7eb
 * border.red500   // border-color: #ef4444
 *
 * // Arbitrary values
 * border`rgba(0,0,0,0.1)`  // border-color: rgba(0,0,0,0.1)
 * ```
 */
export const border: TaggedUtilityFn & ColorValues = createColorUtility(borderFn, "border");

// ============================================
// Grouped exports for convenient destructuring
// ============================================

/** Colors namespace type */
export interface ColorsNamespace {
  [key: string]: StyleToken;
}

/** Grouped color predefined values */
export interface ColorGroup {
  bg: TaggedUtilityFn & ColorValues;
  text: TaggedUtilityFn & ColorValues;
  border: TaggedUtilityFn & ColorValues;
}

/** Grouped color arbitrary functions */
export interface ColorArbGroup {
  bg: TaggedUtilityFn;
  text: TaggedUtilityFn;
  border: TaggedUtilityFn;
}

// Grouped exports
export const colors: ColorGroup = {
  bg,
  text,
  border,
};

export const colorsArb: ColorArbGroup = {
  bg,
  text,
  border,
};
