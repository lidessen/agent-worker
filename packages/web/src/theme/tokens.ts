/**
 * Dark-first design tokens for @agent-worker/web
 *
 * All components reference these tokens via CSS custom properties,
 * enabling runtime theme switching.
 */

import { defineTokens, createTheme, inject } from "semajsx/style";
import type { TokenRefs } from "semajsx/style";

const tokenDefinition = {
  colors: {
    background: "#090909",
    backgroundElevated: "#101010",
    surface: "rgba(24, 24, 24, 0.78)",
    surfaceHover: "rgba(30, 30, 30, 0.88)",
    surfaceActive: "rgba(38, 38, 38, 0.92)",
    surfaceSecondary: "rgba(255, 255, 255, 0.035)",
    surfaceTertiary: "rgba(255, 255, 255, 0.055)",
    border: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.14)",
    borderHover: "rgba(255, 255, 255, 0.18)",
    text: "#f3f1ee",
    textMuted: "rgba(243, 241, 238, 0.74)",
    textDim: "rgba(243, 241, 238, 0.5)",

    primary: "#f3f1ee",
    primaryHover: "#ffffff",
    accent: "#ff8a4c",
    accentSoft: "rgba(255, 138, 76, 0.18)",
    panel: "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.025) 100%)",
    panelHover: "linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.04) 100%)",
    panelStrong: "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.055) 100%)",
    input: "linear-gradient(180deg, rgba(30, 30, 30, 0.92) 0%, rgba(22, 22, 22, 0.92) 100%)",
    badge: "rgba(255, 255, 255, 0.06)",
    dangerSurface: "rgba(255, 69, 58, 0.14)",
    warningSurface: "rgba(255, 214, 10, 0.14)",
    successSurface: "rgba(48, 209, 88, 0.14)",

    success: "#30d158",
    warning: "#ffd60a",
    danger: "#ff453a",

    agentIdle: "#737373",
    agentRunning: "#30d158",
    agentProcessing: "#0a84ff",
    agentError: "#ff453a",
    agentCompleted: "#30d158",
  },

  space: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2rem",
    xxxl: "3rem",
  },

  radii: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "20px",
    xxl: "28px",
    pill: "980px",
  },

  fonts: {
    base: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },

  fontSizes: {
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.5rem",
    xxl: "2.5rem",
  },

  fontWeights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  transitions: {
    fast: "0.15s ease",
    normal: "0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
  },

  shadows: {
    panel: "0 22px 60px rgba(0, 0, 0, 0.45)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    glow: "0 0 0 1px rgba(255, 255, 255, 0.03), 0 12px 30px rgba(0, 0, 0, 0.24)",
    focusRing: "0 0 0 4px rgba(255, 255, 255, 0.04)",
  },
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);

// Inject CSS custom properties into :root
const theme = createTheme(tokens);
inject(theme);
