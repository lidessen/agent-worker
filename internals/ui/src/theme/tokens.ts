/**
 * Default design tokens for @semajsx/ui
 *
 * These tokens define the visual language of the component library.
 * All components reference these tokens via CSS custom properties,
 * enabling runtime theme switching.
 *
 * @example
 * ```ts
 * import { tokens } from "@semajsx/ui/theme";
 *
 * // Use in custom styles
 * const myRule = rule`${c.box} {
 *   color: ${tokens.colors.text};
 *   padding: ${tokens.space.md};
 * }`;
 * ```
 */

import { defineTokens } from "@semajsx/style";
import type { TokenRefs } from "@semajsx/style";

const tokenDefinition = {
  colors: {
    // Brand (Apple blue)
    primary: "#0071e3",
    primaryHover: "#0077ed",
    primaryActive: "#0068d6",

    // Neutral
    background: "#fbfbfd",
    surface: "#f5f5f7",
    border: "rgba(0, 0, 0, 0.08)",
    text: "#1d1d1f",
    textMuted: "#6e6e73",
    textTertiary: "#86868b",

    // Semantic
    danger: "#ff453a",
    dangerHover: "#ff6961",
    success: "#34c759",
    warning: "#ff9f0a",
    info: "#007aff",
    tip: "#af52de",

    // Inverse (for solid buttons, etc.)
    onPrimary: "#ffffff",
    onDanger: "#ffffff",
  },

  space: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2rem",
  },

  radii: {
    sm: "10px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    pill: "980px",
  },

  fonts: {
    base: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },

  fontSizes: {
    xs: "0.8125rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.0625rem",
  },

  fontWeights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  lineHeights: {
    tight: "1.25",
    normal: "1.6",
  },

  shadows: {
    sm: "0 1px 3px rgba(0, 0, 0, 0.03)",
    md: "0 1px 4px rgba(0, 0, 0, 0.04)",
    lg: "0 8px 28px rgba(0, 0, 0, 0.08)",
    primaryGlow: "0 4px 16px rgba(0, 113, 227, 0.3)",
  },

  transitions: {
    fast: "0.2s ease",
    normal: "0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);
