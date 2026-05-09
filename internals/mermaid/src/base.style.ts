import { tokens } from "./tokens";

/**
 * Shared SVG style property fragments.
 *
 * These return plain CSS property strings that can be interpolated into
 * `rule` tagged templates. This eliminates the repeated text-label and
 * box-shape patterns across node, edge, subgraph, and sequence styles.
 *
 * Parameters accept `string | { toString(): string }` to support both
 * plain values and `TokenRef` objects from `@semajsx/style`.
 */

/** Any value that stringifies to valid CSS (plain string or TokenRef). */
type CSSValue = string | number | { toString(): string };

/**
 * Common SVG text label properties.
 * Produces: fill, stroke:none, font-family, font-size, text-anchor, dominant-baseline.
 */
export function textLabel(fill: CSSValue, fontSize: CSSValue): string {
  return `fill: ${fill};
  stroke: none;
  font-family: ${tokens.fontFamily};
  font-size: ${fontSize};
  text-anchor: middle;
  dominant-baseline: central;`;
}

/**
 * Common SVG box/container properties.
 * Produces: fill, stroke, stroke-width.
 */
export function boxShape(fill: CSSValue, stroke: CSSValue, strokeWidth: CSSValue = 1): string {
  return `fill: ${fill};
  stroke: ${stroke};
  stroke-width: ${strokeWidth};`;
}
