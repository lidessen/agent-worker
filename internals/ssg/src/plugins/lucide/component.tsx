/** @jsxImportSource @semajsx/dom */

import { h } from "@semajsx/core";
import type { VNode } from "@semajsx/core";
import { Native } from "@semajsx/dom";
import { createElement } from "lucide";
import * as allExports from "lucide";

/**
 * lucide IconNode: array of [tag, attrs] tuples
 * e.g., [["path", { d: "M4.5 16.5..." }], ["circle", { cx: "12", ... }]]
 */
type IconNode = [string, Record<string, string>][];

/**
 * Convert kebab-case icon name to PascalCase for lucide lookup.
 *
 * "arrow-right" → "ArrowRight"
 * "rocket"      → "Rocket"
 */
function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Look up an icon by kebab-case name from lucide's exports.
 * Returns the IconNode data (array of [tag, attrs] tuples) or undefined.
 */
function getIcon(name: string): IconNode | undefined {
  const pascalName = toPascalCase(name);
  const icon = (allExports as Record<string, unknown>)[pascalName];
  // IconNode is an array of tuples; functions (createElement, createIcons) are filtered out
  if (Array.isArray(icon)) return icon as IconNode;
  return undefined;
}

export interface IconProps {
  /** Icon name in kebab-case (e.g., "rocket", "arrow-right", "circle-check") */
  name: string;
  /** Icon size in pixels (default: 24) */
  size?: number;
  /** Stroke color (default: "currentColor") */
  color?: string;
  /** Stroke width (default: 2) */
  strokeWidth?: number;
  /** Additional CSS class */
  class?: string;
}

/**
 * Default SVG attributes matching lucide's defaults.
 */
const SVG_DEFAULTS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

/**
 * Isomorphic Lucide icon component.
 *
 * - **Browser**: uses lucide's `createElement` to produce a real SVGElement,
 *   embedded via `<Native>` for optimal performance.
 * - **Server (SSG/SSR)**: constructs JSX SVG from IconNode data,
 *   rendered to HTML string by the SSR renderer.
 *
 * @example
 * ```mdx
 * <Icon name="rocket" />
 * <Icon name="arrow-right" size={20} color="#007aff" />
 * ```
 */
export function Icon({
  name,
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  class: className,
}: IconProps): VNode {
  const iconNode = getIcon(name);

  if (!iconNode) {
    return (
      <span class="lucide-icon-missing" title={`Unknown icon: ${name}`}>
        {"?"}
      </span>
    );
  }

  const iconClass = className ? `lucide lucide-${name} ${className}` : `lucide lucide-${name}`;

  // Browser: use lucide's createElement + Native
  if (typeof document !== "undefined") {
    const element = createElement(iconNode, {
      width: size,
      height: size,
      stroke: color,
      "stroke-width": strokeWidth,
      class: iconClass,
    });
    return <Native element={element} />;
  }

  // Server: construct SVG from IconNode data
  return h(
    "svg",
    {
      ...SVG_DEFAULTS,
      width: size,
      height: size,
      stroke: color,
      "stroke-width": strokeWidth,
      class: iconClass,
    },
    ...iconNode.map(([tag, attrs]) => h(tag, attrs)),
  );
}
