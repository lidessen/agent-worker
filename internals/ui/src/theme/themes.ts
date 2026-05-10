/**
 * Built-in themes for @semajsx/ui
 *
 * Provides light (default) and dark themes. Custom themes can be
 * created using createTheme() from @semajsx/style.
 *
 * @example
 * ```tsx
 * import { lightTheme, darkTheme } from "@semajsx/ui/theme";
 * import { inject } from "@semajsx/style";
 *
 * // Apply default (light) theme to :root
 * inject(lightTheme);
 *
 * // Scope dark theme to an element
 * <div class={darkTheme}>
 *   <Button>Dark button</Button>
 * </div>
 * ```
 */

import { createTheme } from "@semajsx/style";
import type { StyleToken } from "@semajsx/style";
import { tokens } from "./tokens";

/**
 * Light theme - applies token defaults to :root
 */
export const lightTheme: StyleToken = createTheme(tokens);

/**
 * Dark theme - scoped to a CSS class
 */
export const darkTheme: StyleToken = createTheme(tokens, {
  colors: {
    primary: "#2997ff",
    primaryHover: "#5ab4ff",
    primaryActive: "#0071e3",

    background: "#000000",
    surface: "#1c1c1e",
    border: "rgba(255, 255, 255, 0.12)",
    text: "#f5f5f7",
    textMuted: "#a1a1a6",
    textTertiary: "#6e6e73",

    danger: "#ff453a",
    dangerHover: "#ff6961",
    success: "#30d158",
    warning: "#ffd60a",
    info: "#0a84ff",
    tip: "#bf5af2",

    onPrimary: "#ffffff",
    onDanger: "#ffffff",
  },

  shadows: {
    sm: "0 1px 3px rgba(0, 0, 0, 0.2)",
    md: "0 1px 4px rgba(0, 0, 0, 0.3)",
    lg: "0 8px 28px rgba(0, 0, 0, 0.4)",
    primaryGlow: "0 4px 16px rgba(41, 151, 255, 0.3)",
  },
});
