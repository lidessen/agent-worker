/**
 * JSX automatic runtime for Prompt UI (production)
 * Use with: @jsxImportSource @semajsx/prompt
 */

import { Fragment } from "@semajsx/core";
import type { ComponentAPI, JSXNode, RuntimeComponent, VNode, SignalOr } from "@semajsx/core";

export { jsx, jsxs } from "@semajsx/core";
export { Fragment };

/**
 * Header element attributes
 */
export interface HeaderAttributes {
  key?: string | number;
  children?: JSXNode;
  name?: SignalOr<string>;
  time?: SignalOr<string>;
  event?: SignalOr<string>;
  focus?: SignalOr<string>;
  [key: string]: unknown;
}

/**
 * Section element attributes
 */
export interface SectionAttributes {
  key?: string | number;
  children?: JSXNode;
  title?: SignalOr<string>;
  viewport?: SignalOr<string>;
}

/**
 * Line element attributes
 */
export interface LineAttributes {
  key?: string | number;
  children?: JSXNode;
  prefix?: SignalOr<string>;
}

/**
 * Item element attributes
 */
export interface ItemAttributes {
  key?: string | number;
  children?: JSXNode;
  index?: SignalOr<number>;
  marker?: SignalOr<string>;
}

/**
 * Field element attributes
 */
export interface FieldAttributes {
  key?: string | number;
  children?: JSXNode;
  label: SignalOr<string>;
  value?: SignalOr<string | number>;
}

/**
 * Actions element attributes
 */
export interface ActionsAttributes {
  key?: string | number;
  children?: JSXNode;
  inline?: SignalOr<boolean>;
  label?: SignalOr<string>;
}

/**
 * Action element attributes
 */
export interface ActionAttributes {
  key?: string | number;
  children?: JSXNode;
  label?: SignalOr<string>;
  name: string;
  [key: string]: unknown;
}

/**
 * Viewport element attributes
 */
export interface ViewportAttributes {
  key?: string | number;
  children?: JSXNode;
  current: SignalOr<string | number>;
  total: SignalOr<string | number>;
  scope?: SignalOr<string>;
}

/**
 * Separator element attributes
 */
export interface SeparatorAttributes {
  key?: string | number;
  char?: SignalOr<string>;
}

/**
 * Break element attributes
 */
export interface BrAttributes {
  key?: string | number;
}

/**
 * Indent element attributes
 */
export interface IndentAttributes {
  key?: string | number;
  children?: JSXNode;
  size?: SignalOr<number>;
}

/**
 * Raw text element attributes
 */
export interface RawAttributes {
  key?: string | number;
  children?: JSXNode;
}

/**
 * Text element attributes
 */
export interface TextAttributes {
  key?: string | number;
  children?: JSXNode;
}

/**
 * JSX namespace for Prompt UI elements
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
     * Header element - renders top-level metadata
     *
     * Known props: name (SCREEN), time (TIME), event (EVENT), focus (FOCUS)
     * Any additional props are rendered as KEY VALUE lines.
     *
     * @example
     * <header name="Support Inbox" time="2026-03-12" focus="thread:A" />
     * // SCREEN Support Inbox
     * // TIME 2026-03-12
     * // FOCUS thread:A
     */
    header: HeaderAttributes;

    /**
     * Section element - named content block
     *
     * @example
     * <section title="ROLE">
     *   <line>Support Agent</line>
     * </section>
     * // [ROLE]
     * // Support Agent
     */
    section: SectionAttributes;

    /**
     * Line element - a single line of text
     *
     * @example
     * <line>Hello world</line>
     * // Hello world
     *
     * <line prefix="[19:47 A] ">I need help</line>
     * // [19:47 A] I need help
     */
    line: LineAttributes;

    /**
     * Item element - a list item
     *
     * @example
     * <item>Unordered item</item>
     * // - Unordered item
     *
     * <item index={1}>Ordered item</item>
     * // 1. Ordered item
     */
    item: ItemAttributes;

    /**
     * Field element - a key-value pair
     *
     * @example
     * <field label="Status" value="active" />
     * // Status: active
     */
    field: FieldAttributes;

    /**
     * Actions container - groups actions
     *
     * @example
     * <actions>
     *   <action label="Reply" name="reply" chat="A" />
     *   <action label="Open" name="open" chat="B" />
     * </actions>
     * // Actions: Reply => @act:reply chat=A | Open => @act:open chat=B
     */
    actions: ActionsAttributes;

    /**
     * Action element - a single executable action
     *
     * @example
     * <action label="Reply to A" name="reply" chat="A" />
     * // Reply to A => @act:reply chat=A
     */
    action: ActionAttributes;

    /**
     * Viewport wrapper - adds pagination info
     *
     * @example
     * <viewport current="1-3" total="10" scope="todos">
     *   ...items...
     * </viewport>
     */
    viewport: ViewportAttributes;

    /**
     * Separator - a divider line
     *
     * @example
     * <separator />
     * // ---
     */
    separator: SeparatorAttributes;

    /**
     * Line break
     */
    br: BrAttributes;

    /**
     * Indented block
     *
     * @example
     * <indent size={4}>
     *   <line>indented content</line>
     * </indent>
     */
    indent: IndentAttributes;

    /**
     * Raw text passthrough
     */
    raw: RawAttributes;

    /**
     * Inline text element
     */
    text: TextAttributes;
  }
}
