/** @jsxImportSource @semajsx/dom */

import { Native } from "@semajsx/dom";
import type { VNode } from "@semajsx/core";
import { createElement, type IconNode } from "lucide";

export interface IconProps {
  /** Lucide icon node data — import from "@semajsx/icons" */
  icon: IconNode;
  /** Icon size in pixels (default: 16) */
  size?: number;
  /** Additional CSS class */
  class?: string;
  /** Inline style string */
  style?: string;
  /** Stroke width override */
  strokeWidth?: number;
}

/**
 * Render a Lucide icon using lucide's native createElement + semajsx Native.
 *
 * @example
 * ```tsx
 * import { Icon, Bot, Wrench } from "@semajsx/icons";
 *
 * <Icon icon={Bot} size={20} />
 * <Icon icon={Wrench} class="text-muted" />
 * ```
 */
export function Icon(props: IconProps): VNode {
  const attrs: Record<string, string> = {
    width: String(props.size ?? 16),
    height: String(props.size ?? 16),
  };
  if (props.strokeWidth !== undefined) {
    attrs["stroke-width"] = String(props.strokeWidth);
  }

  const el = createElement(props.icon, attrs);

  if (props.class) el.setAttribute("class", props.class);
  if (props.style) el.setAttribute("style", props.style);

  return Native({ element: el });
}
