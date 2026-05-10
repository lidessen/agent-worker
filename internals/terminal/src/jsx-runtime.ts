/**
 * JSX automatic runtime for Terminal (production)
 * Use with: @jsxImportSource @semajsx/terminal
 */

import { Fragment } from "@semajsx/core";
import type { ComponentAPI, JSXNode, RuntimeComponent, VNode, WithSignals } from "@semajsx/core";
import type { TerminalStyle } from "./types";

export { jsx, jsxs } from "@semajsx/core";
export { Fragment };

/**
 * Base terminal element attributes (without Signal support)
 */
interface BaseTerminalAttributes extends TerminalStyle {
  // Special props
  key?: string | number;
  children?: JSXNode;
}

/**
 * Terminal element attributes with Signal support
 * All style properties can accept Signal values
 */
export type TerminalAttributes = WithSignals<BaseTerminalAttributes>;

/**
 * Box element attributes
 * Used for layout containers with flexbox support
 *
 * All properties support both plain values and Signals:
 * - flexDirection, justifyContent, alignItems
 * - flexGrow, flexShrink, flexBasis
 * - width, height, minWidth, minHeight, maxWidth, maxHeight
 * - margin, marginLeft, marginRight, marginTop, marginBottom
 * - padding, paddingLeft, paddingRight, paddingTop, paddingBottom
 * - border, borderColor
 * - backgroundColor
 */
export type BoxAttributes = TerminalAttributes;

/**
 * Text element attributes
 * Used for displaying styled text content
 *
 * All properties support both plain values and Signals:
 * - color: Text color
 * - bold: Bold text
 * - italic: Italic text
 * - underline: Underlined text
 * - strikethrough: Strikethrough text
 * - dim: Dimmed text
 * - Layout props: flexGrow, flexShrink, flexBasis, margin, etc.
 */
export type TextAttributes = TerminalAttributes;

/**
 * JSX namespace for Terminal elements
 */
export namespace JSX {
  export type Element = VNode;

  export type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => JSXNode)
    | RuntimeComponent<any>
    | ((props: any, ctx: ComponentAPI) => JSXNode);

  export interface ElementChildrenAttribute {
    children: {};
  }

  export interface IntrinsicAttributes {
    key?: string | number;
  }

  export interface IntrinsicElements {
    /**
     * Box component for layout and containers
     *
     * Supports flexbox layout with Yoga:
     * - flexDirection: 'row' | 'column' | 'row-reverse' | 'column-reverse'
     * - justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
     * - alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch'
     *
     * Supports sizing:
     * - width, height: number | string (e.g., '50%')
     * - minWidth, minHeight, maxWidth, maxHeight: number
     *
     * Supports spacing:
     * - margin, marginLeft, marginRight, marginTop, marginBottom: number
     * - padding, paddingLeft, paddingRight, paddingTop, paddingBottom: number
     *
     * Supports borders:
     * - border: 'single' | 'double' | 'round' | 'bold' | 'none'
     * - borderColor: string (color name or hex)
     *
     * Supports background:
     * - backgroundColor: string (color name or hex)
     *
     * @example
     * <box border="round" padding={1} borderColor="green">
     *   <text>Content</text>
     * </box>
     */
    box: BoxAttributes;

    /**
     * Row component — shorthand for `<box flexDirection="row">`
     *
     * @example
     * <row>
     *   <text color="green">✓ </text>
     *   <text>Task name</text>
     * </row>
     */
    row: BoxAttributes;

    /**
     * Column component — shorthand for `<box flexDirection="column">`
     *
     * @example
     * <column>
     *   <text>Line 1</text>
     *   <text>Line 2</text>
     * </column>
     */
    column: BoxAttributes;

    /**
     * Text component for displaying styled text
     *
     * Supports text styling:
     * - color: string (color name or hex)
     * - bold: boolean
     * - italic: boolean
     * - underline: boolean
     * - strikethrough: boolean
     * - dim: boolean
     *
     * Supports layout from parent box:
     * - flexGrow, flexShrink, flexBasis
     * - margin, marginLeft, marginRight, marginTop, marginBottom
     *
     * @example
     * <text color="green" bold>
     *   Success message
     * </text>
     */
    text: TextAttributes;
  }
}
