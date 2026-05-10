/**
 * Configuration management for @semajsx/tailwind
 */

import type { TailwindConfig } from "./types";

/**
 * Default configuration - no prefix, matches native Tailwind class names
 */
const defaultConfig: TailwindConfig = {
  prefix: "",
};

/**
 * Global configuration state
 */
let globalConfig: TailwindConfig = { ...defaultConfig };

/**
 * Configure Tailwind utilities globally.
 * Call this once at app initialization before using any utilities.
 *
 * @example
 * ```ts
 * // No prefix (default) - native Tailwind class names
 * configureTailwind({ prefix: "" });
 * // Result: p-4, bg-blue-500
 *
 * // With prefix for namespace isolation
 * configureTailwind({ prefix: "s-" });
 * // Result: s-p-4, s-bg-blue-500
 * ```
 */
export function configureTailwind(config: Partial<TailwindConfig>): void {
  globalConfig = { ...defaultConfig, ...config };
}

/**
 * Get the current global configuration
 */
export function getConfig(): TailwindConfig {
  return globalConfig;
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetConfig(): void {
  globalConfig = { ...defaultConfig };
}

/**
 * Get the default configuration
 */
export function getDefaultConfig(): TailwindConfig {
  return { ...defaultConfig };
}
