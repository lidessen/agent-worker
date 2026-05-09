/**
 * JSX automatic runtime for DOM (production)
 * Use with: @jsxImportSource @semajsx/dom
 */

import { Forward, Fragment, jsx, jsxs } from "@semajsx/core";
import type {
  ComponentAPI,
  JSXNode,
  Ref,
  RuntimeComponent,
  VNode,
  WithKey,
  WithSignals,
} from "@semajsx/core";
import type { Signal } from "@semajsx/signal";
import type { StyleToken, ClassRef } from "@semajsx/style";

export { jsx, jsxs, Forward, Fragment };

/**
 * Class value type - supports strings, StyleTokens, ClassRefs, arrays, and conditionals
 */
export type ClassValue = string | StyleToken | ClassRef | ClassValue[] | false | null | undefined;

/**
 * HTML attribute types (base definitions without Signal support)
 */
interface BaseHTMLAttributes<T = Element> {
  // Ref - special prop for element references
  ref?: Ref<T>;

  // Standard attributes
  id?: string;
  className?: ClassValue;
  class?: ClassValue;
  style?: string | Record<string, string | number>;
  title?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  hidden?: boolean;
  tabIndex?: number;
  accessKey?: string;
  contentEditable?: boolean | "true" | "false";
  draggable?: boolean;
  spellcheck?: boolean;

  // Special React-style props
  dangerouslySetInnerHTML?: { __html: string };

  // ARIA attributes
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-expanded"?: boolean | "true" | "false";
  "aria-selected"?: boolean | "true" | "false";
  "aria-checked"?: boolean | "true" | "false" | "mixed";
  "aria-disabled"?: boolean | "true" | "false";
  "aria-readonly"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  "aria-pressed"?: boolean | "true" | "false" | "mixed";
  "aria-current"?: boolean | "true" | "false" | "page" | "step" | "location" | "date" | "time";

  // Event handlers (React-style camelCase)
  onClick?: (event: MouseEvent) => void;
  onDblClick?: (event: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onMouseMove?: (event: MouseEvent) => void;
  onMouseOver?: (event: MouseEvent) => void;
  onMouseOut?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;

  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onKeyPress?: (event: KeyboardEvent) => void;

  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;

  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
  onSubmit?: (event: Event) => void;

  onScroll?: (event: Event) => void;
  onWheel?: (event: WheelEvent) => void;

  onTouchStart?: (event: TouchEvent) => void;
  onTouchMove?: (event: TouchEvent) => void;
  onTouchEnd?: (event: TouchEvent) => void;
  onTouchCancel?: (event: TouchEvent) => void;

  onDragStart?: (event: DragEvent) => void;
  onDrag?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onDragEnter?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;

  // Event handlers (native DOM lowercase)
  onclick?: (event: MouseEvent) => void;
  ondblclick?: (event: MouseEvent) => void;
  onmousedown?: (event: MouseEvent) => void;
  onmouseup?: (event: MouseEvent) => void;
  onmouseenter?: (event: MouseEvent) => void;
  onmouseleave?: (event: MouseEvent) => void;
  onmousemove?: (event: MouseEvent) => void;
  onmouseover?: (event: MouseEvent) => void;
  onmouseout?: (event: MouseEvent) => void;
  oncontextmenu?: (event: MouseEvent) => void;

  onkeydown?: (event: KeyboardEvent) => void;
  onkeyup?: (event: KeyboardEvent) => void;
  onkeypress?: (event: KeyboardEvent) => void;

  onfocus?: (event: FocusEvent) => void;
  onblur?: (event: FocusEvent) => void;

  onchange?: (event: Event) => void;
  oninput?: (event: Event) => void;
  onsubmit?: (event: Event) => void;

  onscroll?: (event: Event) => void;
  onwheel?: (event: WheelEvent) => void;

  ontouchstart?: (event: TouchEvent) => void;
  ontouchmove?: (event: TouchEvent) => void;
  ontouchend?: (event: TouchEvent) => void;
  ontouchcancel?: (event: TouchEvent) => void;

  ondragstart?: (event: DragEvent) => void;
  ondrag?: (event: DragEvent) => void;
  ondragend?: (event: DragEvent) => void;
  ondragenter?: (event: DragEvent) => void;
  ondragleave?: (event: DragEvent) => void;
  ondragover?: (event: DragEvent) => void;
  ondrop?: (event: DragEvent) => void;

  // Children
  children?: JSXNode;
}

/**
 * HTML attributes with Signal support
 * All non-function properties can accept Signal values
 */
export type HTMLAttributes<T = Element> = WithKey<WithSignals<BaseHTMLAttributes<T>>> & {
  // Data attributes support both plain values and Signals
  [dataAttribute: `data-${string}`]:
    | string
    | number
    | boolean
    | Signal<string | number | boolean>
    | undefined;
};

interface BaseAnchorHTMLAttributes extends BaseHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  download?: string;
  ping?: string;
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";
}

export type AnchorHTMLAttributes = WithKey<WithSignals<BaseAnchorHTMLAttributes>>;

interface BaseButtonHTMLAttributes extends BaseHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  value?: string;
  name?: string;
  form?: string;
  formAction?: string;
  formEnctype?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
}

export type ButtonHTMLAttributes = WithKey<WithSignals<BaseButtonHTMLAttributes>>;

interface BaseInputHTMLAttributes extends BaseHTMLAttributes<HTMLInputElement> {
  accept?: string;
  alt?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  capture?: boolean | "user" | "environment";
  checked?: boolean;
  defaultChecked?: boolean;
  defaultValue?: string | number;
  disabled?: boolean;
  form?: string;
  formAction?: string;
  formEnctype?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  max?: number | string;
  maxLength?: number;
  min?: number | string;
  minLength?: number;
  multiple?: boolean;
  name?: string;
  pattern?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  size?: number;
  src?: string;
  step?: number | string;
  type?: string;
  value?: string | number;
}

export type InputHTMLAttributes = WithKey<WithSignals<BaseInputHTMLAttributes>>;

interface BaseTextareaHTMLAttributes extends BaseHTMLAttributes<HTMLTextAreaElement> {
  autoComplete?: string;
  autoFocus?: boolean;
  cols?: number;
  disabled?: boolean;
  form?: string;
  maxLength?: number;
  minLength?: number;
  name?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  rows?: number;
  value?: string;
  wrap?: "hard" | "soft" | "off";
}

export type TextareaHTMLAttributes = WithKey<WithSignals<BaseTextareaHTMLAttributes>>;

interface BaseSelectHTMLAttributes extends BaseHTMLAttributes<HTMLSelectElement> {
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  form?: string;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  size?: number;
  value?: string | string[];
}

export type SelectHTMLAttributes = WithKey<WithSignals<BaseSelectHTMLAttributes>>;

interface BaseOptionHTMLAttributes extends BaseHTMLAttributes<HTMLOptionElement> {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: string | number;
}

export type OptionHTMLAttributes = WithKey<WithSignals<BaseOptionHTMLAttributes>>;

interface BaseLabelHTMLAttributes extends BaseHTMLAttributes<HTMLLabelElement> {
  for?: string;
  htmlFor?: string;
  form?: string;
}

export type LabelHTMLAttributes = WithKey<WithSignals<BaseLabelHTMLAttributes>>;

interface BaseFormHTMLAttributes extends BaseHTMLAttributes<HTMLFormElement> {
  acceptCharset?: string;
  action?: string;
  autoComplete?: string;
  enctype?: string;
  method?: "get" | "post" | "dialog";
  name?: string;
  noValidate?: boolean;
  target?: "_blank" | "_self" | "_parent" | "_top";
}

export type FormHTMLAttributes = WithKey<WithSignals<BaseFormHTMLAttributes>>;

interface BaseImgHTMLAttributes extends BaseHTMLAttributes<HTMLImageElement> {
  alt?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  decoding?: "async" | "auto" | "sync";
  height?: number | string;
  loading?: "eager" | "lazy";
  referrerPolicy?: string;
  sizes?: string;
  src?: string;
  srcSet?: string;
  useMap?: string;
  width?: number | string;
}

export type ImgHTMLAttributes = WithKey<WithSignals<BaseImgHTMLAttributes>>;

interface BaseVideoHTMLAttributes extends BaseHTMLAttributes<HTMLVideoElement> {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  height?: number | string;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  poster?: string;
  preload?: "none" | "metadata" | "auto" | "";
  src?: string;
  width?: number | string;
}

export type VideoHTMLAttributes = WithKey<WithSignals<BaseVideoHTMLAttributes>>;

interface BaseAudioHTMLAttributes extends BaseHTMLAttributes<HTMLAudioElement> {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto" | "";
  src?: string;
}

export type AudioHTMLAttributes = WithKey<WithSignals<BaseAudioHTMLAttributes>>;

interface BaseCanvasHTMLAttributes extends BaseHTMLAttributes<HTMLCanvasElement> {
  height?: number | string;
  width?: number | string;
}

export type CanvasHTMLAttributes = WithKey<WithSignals<BaseCanvasHTMLAttributes>>;

interface BaseIframeHTMLAttributes extends BaseHTMLAttributes<HTMLIFrameElement> {
  allow?: string;
  allowFullScreen?: boolean;
  height?: number | string;
  loading?: "eager" | "lazy";
  name?: string;
  referrerPolicy?: string;
  sandbox?: string;
  src?: string;
  srcDoc?: string;
  width?: number | string;
}

export type IframeHTMLAttributes = WithKey<WithSignals<BaseIframeHTMLAttributes>>;

interface BaseTableHTMLAttributes extends BaseHTMLAttributes<HTMLTableElement> {
  cellPadding?: number | string;
  cellSpacing?: number | string;
}

export type TableHTMLAttributes = WithKey<WithSignals<BaseTableHTMLAttributes>>;

interface BaseTdHTMLAttributes extends BaseHTMLAttributes<HTMLTableCellElement> {
  colSpan?: number;
  headers?: string;
  rowSpan?: number;
}

export type TdHTMLAttributes = WithKey<WithSignals<BaseTdHTMLAttributes>>;

interface BaseThHTMLAttributes extends BaseHTMLAttributes<HTMLTableCellElement> {
  abbr?: string;
  colSpan?: number;
  headers?: string;
  rowSpan?: number;
  scope?: "col" | "row" | "colgroup" | "rowgroup";
}

export type ThHTMLAttributes = WithKey<WithSignals<BaseThHTMLAttributes>>;

interface BaseStyleHTMLAttributes extends BaseHTMLAttributes<HTMLStyleElement> {
  media?: string;
  scoped?: boolean;
  type?: string;
}

export type StyleHTMLAttributes = WithKey<WithSignals<BaseStyleHTMLAttributes>>;

interface BaseScriptHTMLAttributes extends BaseHTMLAttributes<HTMLScriptElement> {
  async?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  defer?: boolean;
  integrity?: string;
  noModule?: boolean;
  referrerPolicy?: string;
  src?: string;
  type?: string;
}

export type ScriptHTMLAttributes = WithKey<WithSignals<BaseScriptHTMLAttributes>>;

interface BaseLinkHTMLAttributes extends BaseHTMLAttributes<HTMLLinkElement> {
  as?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  href?: string;
  hrefLang?: string;
  integrity?: string;
  media?: string;
  referrerPolicy?: string;
  rel?: string;
  sizes?: string;
  type?: string;
}

export type LinkHTMLAttributes = WithKey<WithSignals<BaseLinkHTMLAttributes>>;

interface BaseMetaHTMLAttributes extends BaseHTMLAttributes<HTMLMetaElement> {
  charSet?: string;
  content?: string;
  httpEquiv?: string;
  name?: string;
}

export type MetaHTMLAttributes = WithKey<WithSignals<BaseMetaHTMLAttributes>>;

/**
 * SVG element attributes — permissive to cover SVG's large attribute set
 */
export type SVGAttributes = HTMLAttributes<SVGElement> & {
  [key: string]: unknown;
};

/**
 * JSX namespace for DOM elements
 */
export namespace JSX {
  // JSX factory returns sync VNodes
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
    // Document structure
    html: HTMLAttributes<HTMLHtmlElement>;
    head: HTMLAttributes<HTMLHeadElement>;
    body: HTMLAttributes<HTMLBodyElement>;
    title: HTMLAttributes<HTMLTitleElement>;
    meta: MetaHTMLAttributes;
    link: LinkHTMLAttributes;
    style: StyleHTMLAttributes;
    script: ScriptHTMLAttributes;

    // Content sectioning
    header: HTMLAttributes<HTMLElement>;
    footer: HTMLAttributes<HTMLElement>;
    main: HTMLAttributes<HTMLElement>;
    nav: HTMLAttributes<HTMLElement>;
    section: HTMLAttributes<HTMLElement>;
    article: HTMLAttributes<HTMLElement>;
    aside: HTMLAttributes<HTMLElement>;
    h1: HTMLAttributes<HTMLHeadingElement>;
    h2: HTMLAttributes<HTMLHeadingElement>;
    h3: HTMLAttributes<HTMLHeadingElement>;
    h4: HTMLAttributes<HTMLHeadingElement>;
    h5: HTMLAttributes<HTMLHeadingElement>;
    h6: HTMLAttributes<HTMLHeadingElement>;

    // Text content
    div: HTMLAttributes<HTMLDivElement>;
    p: HTMLAttributes<HTMLParagraphElement>;
    span: HTMLAttributes<HTMLSpanElement>;
    pre: HTMLAttributes<HTMLPreElement>;
    code: HTMLAttributes<HTMLElement>;
    blockquote: HTMLAttributes<HTMLQuoteElement>;
    hr: HTMLAttributes<HTMLHRElement>;
    br: HTMLAttributes<HTMLBRElement>;

    // Lists
    ul: HTMLAttributes<HTMLUListElement>;
    ol: HTMLAttributes<HTMLOListElement>;
    li: HTMLAttributes<HTMLLIElement>;
    dl: HTMLAttributes<HTMLDListElement>;
    dt: HTMLAttributes<HTMLElement>;
    dd: HTMLAttributes<HTMLElement>;

    // Inline text semantics
    a: AnchorHTMLAttributes;
    strong: HTMLAttributes<HTMLElement>;
    em: HTMLAttributes<HTMLElement>;
    b: HTMLAttributes<HTMLElement>;
    i: HTMLAttributes<HTMLElement>;
    u: HTMLAttributes<HTMLElement>;
    s: HTMLAttributes<HTMLElement>;
    small: HTMLAttributes<HTMLElement>;
    mark: HTMLAttributes<HTMLElement>;
    abbr: HTMLAttributes<HTMLElement>;
    cite: HTMLAttributes<HTMLElement>;
    q: HTMLAttributes<HTMLQuoteElement>;
    kbd: HTMLAttributes<HTMLElement>;
    sub: HTMLAttributes<HTMLElement>;
    sup: HTMLAttributes<HTMLElement>;
    time: HTMLAttributes<HTMLTimeElement>;

    // Forms
    form: FormHTMLAttributes;
    input: InputHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    button: ButtonHTMLAttributes;
    select: SelectHTMLAttributes;
    option: OptionHTMLAttributes;
    optgroup: HTMLAttributes<HTMLOptGroupElement>;
    label: LabelHTMLAttributes;
    fieldset: HTMLAttributes<HTMLFieldSetElement>;
    legend: HTMLAttributes<HTMLLegendElement>;

    // Tables
    table: TableHTMLAttributes;
    thead: HTMLAttributes<HTMLTableSectionElement>;
    tbody: HTMLAttributes<HTMLTableSectionElement>;
    tfoot: HTMLAttributes<HTMLTableSectionElement>;
    tr: HTMLAttributes<HTMLTableRowElement>;
    th: ThHTMLAttributes;
    td: TdHTMLAttributes;
    caption: HTMLAttributes<HTMLTableCaptionElement>;
    colgroup: HTMLAttributes<HTMLTableColElement>;
    col: HTMLAttributes<HTMLTableColElement>;

    // Media
    img: ImgHTMLAttributes;
    video: VideoHTMLAttributes;
    audio: AudioHTMLAttributes;
    source: HTMLAttributes<HTMLSourceElement>;
    track: HTMLAttributes<HTMLTrackElement>;
    canvas: CanvasHTMLAttributes;
    svg: SVGAttributes;

    // SVG child elements
    circle: SVGAttributes;
    clipPath: SVGAttributes;
    defs: SVGAttributes;
    ellipse: SVGAttributes;
    g: SVGAttributes;
    line: SVGAttributes;
    linearGradient: SVGAttributes;
    mask: SVGAttributes;
    path: SVGAttributes;
    pattern: SVGAttributes;
    foreignObject: SVGAttributes;
    marker: SVGAttributes;
    polygon: SVGAttributes;
    polyline: SVGAttributes;
    radialGradient: SVGAttributes;
    rect: SVGAttributes;
    stop: SVGAttributes;
    symbol: SVGAttributes;
    text: SVGAttributes;
    tspan: SVGAttributes;
    use: SVGAttributes;

    // Embedded content
    iframe: IframeHTMLAttributes;
    embed: HTMLAttributes<HTMLEmbedElement>;
    object: HTMLAttributes<HTMLObjectElement>;
    param: HTMLAttributes<HTMLParamElement>;
    picture: HTMLAttributes<HTMLPictureElement>;

    // Interactive elements
    details: HTMLAttributes<HTMLDetailsElement>;
    summary: HTMLAttributes<HTMLElement>;
    dialog: HTMLAttributes<HTMLDialogElement>;
    menu: HTMLAttributes<HTMLMenuElement>;

    // Web Components
    slot: HTMLAttributes<HTMLSlotElement>;
    template: HTMLAttributes<HTMLTemplateElement>;
  }
}
