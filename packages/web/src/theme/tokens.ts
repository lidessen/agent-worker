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
    background: "#0a0a0a",
    surface: "#141414",
    surfaceHover: "#1a1a1a",
    surfaceActive: "#222222",
    border: "rgba(255, 255, 255, 0.08)",
    borderHover: "rgba(255, 255, 255, 0.15)",
    text: "#e5e5e5",
    textMuted: "#737373",
    textDim: "#525252",

    primary: "#0a84ff",
    primaryHover: "#409cff",

    success: "#30d158",
    warning: "#ffd60a",
    danger: "#ff453a",

    agentIdle: "#737373",
    agentRunning: "#0a84ff",
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
  },

  radii: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "20px",
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
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);

// Inject CSS custom properties into :root
const theme = createTheme(tokens);
inject(theme);
