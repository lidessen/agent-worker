import type { SSGPlugin } from "../../types";
import { Icon, type IconProps } from "./component";

export type { IconProps } from "./component";
export { Icon };

export interface LucidePluginOptions {
  /** Default icon size in pixels (default: 24) */
  size?: number;
  /** Default stroke color (default: "currentColor") */
  color?: string;
  /** Default stroke width (default: 2) */
  strokeWidth?: number;
}

/**
 * Lucide icon plugin for SSG.
 *
 * Registers the `<Icon>` component for use in MDX content.
 * Optionally configure default icon properties.
 *
 * @example
 * ```tsx
 * import { createSSG } from "@semajsx/ssg";
 * import { lucide } from "@semajsx/ssg/plugins/lucide";
 *
 * const ssg = createSSG({
 *   plugins: [lucide()],
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With custom defaults
 * const ssg = createSSG({
 *   plugins: [lucide({ size: 20, color: "#333" })],
 * });
 * ```
 *
 * @example
 * ```mdx
 * <Icon name="rocket" />
 * <Icon name="arrow-right" size={16} color="#007aff" />
 * ```
 */
export function lucide(options: LucidePluginOptions = {}): SSGPlugin {
  const { size, color, strokeWidth } = options;
  const hasDefaults = size !== undefined || color !== undefined || strokeWidth !== undefined;

  // Wrap Icon with custom defaults if any options are provided
  const IconComponent = hasDefaults
    ? (props: IconProps) =>
        Icon({
          ...props,
          size: props.size ?? size,
          color: props.color ?? color,
          strokeWidth: props.strokeWidth ?? strokeWidth,
        })
    : Icon;

  return {
    name: "lucide",
    config() {
      return {
        mdx: {
          components: { Icon: IconComponent },
        },
      };
    },
  };
}
