import type { JSXNode, VNode } from "@semajsx/core";
import type {
  IslandMetadata,
  IslandScriptTransformer,
  RenderToStringOptions,
  SSRResult,
} from "./shared/types";
import { Fragment, createComponentAPI } from "@semajsx/core";
import type { ContextMap } from "@semajsx/core";
import { getIslandMetadata, isIslandVNode } from "./client/island";
import { STYLE_MARKER, LINK_MARKER, ASSET_MARKER } from "./client/resource";
import { isSignal, unwrap } from "@semajsx/signal";
import { isStyleToken } from "@semajsx/style";

/**
 * Render context for collecting islands during traversal
 */
interface RenderContext {
  islands: IslandMetadata[];
  islandCounter: number;
  islandBasePath: string;
  // Whether to generate hydration markers (only when transformer is provided)
  enableHydration: boolean;
  // Cache for component render results to avoid duplicate rendering
  renderCache: WeakMap<VNode, string>;
  // Collected CSS file paths
  css: Set<string>;
  // Collected inline CSS from StyleTokens
  styles: Set<string>;
  // Collected asset file paths
  assets: Set<string>;
  // Root directory for computing component keys
  rootDir: string;
}

/**
 * Cache for module export name maps.
 * Maps module path → (Function → export name) reverse lookup.
 * Cached because the same module path always yields the same exports
 * within a single server process.
 */
const moduleNameCache = new Map<string, Map<Function, string>>();

/**
 * Resolve a module's export names by dynamically importing it.
 *
 * Since the module was already statically imported (to call island()),
 * import() hits the module cache — no I/O, and function references are
 * identity-equal, so Map.get() works directly.
 *
 * Falls back to an empty map if the import fails (e.g. virtual modules
 * only resolvable by Vite).
 */
async function resolveNameMap(modulePath: string): Promise<Map<Function, string>> {
  const cached = moduleNameCache.get(modulePath);
  if (cached) return cached;

  const map = new Map<Function, string>();
  try {
    const mod = await import(modulePath);
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === "function") {
        map.set(value as Function, exportName);
      }
    }
  } catch {
    // Module not resolvable at SSR time (e.g. Vite virtual module).
    // Fall back to Function.name in collectSerializedNode.
  }
  moduleNameCache.set(modulePath, map);
  return map;
}

/**
 * Render a VNode tree to an HTML string with island support
 *
 * @param vnode - The VNode tree to render
 * @param options - Rendering options
 * @returns SSR result with HTML and island metadata
 *
 * @example
 * ```tsx
 * // Static HTML only (no client-side scripts)
 * const result = renderToString(<App />)
 * console.log(result.html) // HTML string
 * console.log(result.islands) // Island metadata
 * console.log(result.scripts) // Empty string
 *
 * // With custom hydration scripts
 * const result = renderToString(<App />, {
 *   transformIslandScript: (island) => {
 *     return `<script type="module" src="${island.basePath}/${island.id}.js"></script>`
 *   }
 * })
 * ```
 */
export async function renderToString(
  vnode: VNode,
  options: RenderToStringOptions = {},
): Promise<SSRResult> {
  const { transformIslandScript, rootDir = process.cwd() } = options;

  // Fixed path for all static assets under /_semajsx/ namespace
  const islandBasePath = "/_semajsx/islands";

  // Create render context to collect islands during single traversal
  const context: RenderContext = {
    islands: [],
    islandCounter: 0,
    islandBasePath,
    // Only enable hydration markers when transformer is provided
    enableHydration: !!transformIslandScript,
    renderCache: new WeakMap(),
    css: new Set(),
    styles: new Set(),
    assets: new Set(),
    rootDir,
  };

  // Render HTML and collect islands in one pass (fixes duplicate rendering)
  const html = await renderVNodeToHTML(vnode, context, new Map());

  // Generate script tags for islands (only if transformer is provided)
  const scripts = generateIslandScripts(context.islands, islandBasePath, transformIslandScript);

  return {
    html,
    islands: context.islands,
    scripts,
    css: Array.from(context.css),
    styles: Array.from(context.styles),
    assets: Array.from(context.assets),
  };
}

/**
 * Serialize props for island hydration
 */
function serializeProps(props: any): Record<string, any> {
  if (!props || typeof props !== "object") {
    return {};
  }

  const serialized: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    // Skip children - they will be rendered separately
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

    // Skip functions (event handlers, callbacks)
    if (typeof value === "function") {
      continue;
    }

    // Skip symbols
    if (typeof value === "symbol") {
      continue;
    }

    // Skip undefined
    if (value === undefined) {
      continue;
    }

    // Handle signals - serialize their current value
    if (isSignal(value)) {
      serialized[key] = unwrap(value);
      continue;
    }

    // Handle null, boolean, number, string
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      serialized[key] = value;
      continue;
    }

    // Handle arrays and plain objects
    if (Array.isArray(value) || isPlainObject(value)) {
      try {
        // Test if it's JSON-serializable
        JSON.stringify(value);
        serialized[key] = value;
      } catch (error) {
        console.warn(`Cannot serialize prop "${key}":`, error);
      }
      continue;
    }

    console.warn(`Skipping non-serializable prop "${key}" of type ${typeof value}`);
  }

  return serialized;
}

/**
 * Serialize VNode children for island hydration.
 *
 * Produces a JSON-serializable array that the client can reconstruct into
 * real VNodes using a component registry.
 *
 * Format:
 *  - string          → text node
 *  - null            → skip
 *  - [tag, props?, children?]   → HTML element (e.g. ["div", {"class":"x"}, [...]])
 *  - ["$Name", props?, children?] → component reference ($ prefix)
 */
function serializeVNodeChildren(children: any, nameMap?: Map<Function, string>): any[] | undefined {
  if (children == null) return undefined;
  const nodes = Array.isArray(children) ? children : [children];
  const result: any[] = [];
  for (const node of nodes) {
    collectSerializedNode(node, result, nameMap);
  }
  return result.length > 0 ? result : undefined;
}

function collectSerializedNode(node: any, result: any[], nameMap?: Map<Function, string>): void {
  if (node == null || typeof node === "boolean") return;
  if (typeof node === "string") {
    result.push(node);
    return;
  }
  if (typeof node === "number") {
    result.push(String(node));
    return;
  }
  if (isSignal(node)) {
    collectSerializedNode(unwrap(node), result, nameMap);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectSerializedNode(item, result, nameMap);
    return;
  }

  if (typeof node !== "object" || !("type" in node)) return;
  const vnode = node as VNode;

  // Text node
  if (vnode.type === "#text") {
    result.push(String(vnode.props?.nodeValue ?? ""));
    return;
  }

  // Signal node — unwrap
  if (vnode.type === "#signal") {
    const sig = vnode.props?.signal;
    if (sig && isSignal(sig)) collectSerializedNode(unwrap(sig), result, nameMap);
    return;
  }

  // Fragment — flatten children
  if (vnode.type === Fragment) {
    for (const child of vnode.children) collectSerializedNode(child, result, nameMap);
    return;
  }

  // Nested island — emit placeholder so parent children indices stay correct
  if (isIslandVNode(vnode as any)) {
    result.push(["$island", null, null]);
    return;
  }

  // Serialize child VNodes recursively
  const childrenArr = vnode.children?.length
    ? serializeVNodeChildren(vnode.children, nameMap)
    : undefined;

  // Component — use export name from nameMap, fall back to Function.name
  if (typeof vnode.type === "function") {
    const name = "$" + (nameMap?.get(vnode.type) || vnode.type.name || "Anonymous");
    const props = serializeProps(vnode.props || {});
    result.push([name, Object.keys(props).length > 0 ? props : null, childrenArr ?? null]);
    return;
  }

  // HTML element
  if (typeof vnode.type === "string") {
    const props = serializeProps(vnode.props || {});
    result.push([vnode.type, Object.keys(props).length > 0 ? props : null, childrenArr ?? null]);
    return;
  }
}

/**
 * Check if a value is an async iterator
 */
function isAsyncIterator(value: any): value is AsyncIterableIterator<any> {
  return (
    value &&
    typeof value === "object" &&
    (typeof value[Symbol.asyncIterator] === "function" ||
      (typeof value.next === "function" && typeof value.return === "function"))
  );
}

/**
 * Render VNode to HTML string
 */
async function renderVNodeToHTML(
  vnode: VNode | JSXNode,
  context: RenderContext,
  parentContext: ContextMap,
): Promise<string> {
  // Handle null/undefined
  if (vnode == null) {
    return "";
  }

  // Handle signals
  if (isSignal(vnode)) {
    return renderVNodeToHTML(unwrap(vnode), context, parentContext);
  }

  // Handle primitives
  if (typeof vnode === "string" || typeof vnode === "number") {
    return escapeHTML(String(vnode));
  }

  if (typeof vnode === "boolean") {
    return "";
  }

  // Handle arrays
  if (Array.isArray(vnode)) {
    const results = await Promise.all(
      vnode.map((child) => renderVNodeToHTML(child, context, parentContext)),
    );
    return results.join("");
  }

  // Must be a VNode at this point
  if (typeof vnode !== "object" || !("type" in vnode)) {
    return "";
  }

  const vnodeTyped = vnode as VNode;

  // Handle text nodes
  if (vnodeTyped.type === "#text") {
    return escapeHTML(String(vnodeTyped.props?.nodeValue || ""));
  }

  // Handle signal nodes - unwrap and render the signal's value
  if (vnodeTyped.type === "#signal") {
    const signal = vnodeTyped.props?.signal;
    if (signal && isSignal<VNode>(signal)) {
      const unwrapped = unwrap(signal);
      const rendered = await renderVNodeToHTML(unwrapped, context, parentContext);
      // If signal renders to empty content, use a comment marker for hydration
      // This ensures the client can find a DOM node to attach the signal subscription to
      return rendered || "<!--signal-empty-->";
    }
    return "<!--signal-empty-->";
  }

  // Handle islands - render content AND mark for hydration
  if (isIslandVNode(vnodeTyped)) {
    return renderIsland(vnodeTyped, context, parentContext);
  }

  // Handle Style resource - collect CSS path, render nothing
  if (vnodeTyped.type === STYLE_MARKER) {
    const href = vnodeTyped.props?.href;
    if (href && typeof href === "string") {
      context.css.add(href);
    }
    return "";
  }

  // Handle Link resource - collect CSS path for stylesheets
  if (vnodeTyped.type === LINK_MARKER) {
    const href = vnodeTyped.props?.href;
    const rel = vnodeTyped.props?.rel;
    if (href && typeof href === "string" && rel === "stylesheet") {
      context.css.add(href);
    }
    return "";
  }

  // Handle Asset resource - collect asset path
  if (vnodeTyped.type === ASSET_MARKER) {
    const src = vnodeTyped.props?.src;
    if (src && typeof src === "string") {
      context.assets.add(src);
    }
    return "";
  }

  // Handle native nodes - serialize via outerHTML when available
  if (vnodeTyped.type === "#native") {
    const nativeNode = vnodeTyped.props?.__nativeNode;
    if (nativeNode && typeof (nativeNode as { outerHTML?: string }).outerHTML === "string") {
      return (nativeNode as { outerHTML: string }).outerHTML;
    }
    return "";
  }

  // Handle fragments
  if (vnodeTyped.type === Fragment) {
    const results = await Promise.all(
      vnodeTyped.children.map((child: JSXNode) => renderVNodeToHTML(child, context, parentContext)),
    );
    return results.join("");
  }

  // Handle function components
  if (typeof vnodeTyped.type === "function") {
    try {
      // Pass children to component as part of props
      const props =
        vnodeTyped.children && vnodeTyped.children.length > 0
          ? { ...vnodeTyped.props, children: vnodeTyped.children }
          : vnodeTyped.props || {};

      const currentContext = resolveComponentContext(vnodeTyped.type, props, parentContext);
      let result: any = vnodeTyped.type(props, createComponentAPI(currentContext));

      // Handle async component - await the Promise
      if (result instanceof Promise) {
        result = await result;
      }

      // Handle async iterator - take only the first yield
      if (isAsyncIterator(result)) {
        const { value } = await result.next();
        result = value;
      }

      // Handle signal return - unwrap the value
      if (isSignal(result)) {
        result = unwrap(result);
      }

      return renderVNodeToHTML(result, context, currentContext);
    } catch (error) {
      console.error("Error rendering component:", error);
      // Return error fallback
      return renderErrorFallback(error, vnodeTyped);
    }
  }

  // Handle DOM elements
  if (typeof vnodeTyped.type === "string") {
    return renderElement(vnodeTyped, context, parentContext);
  }

  return "";
}

/**
 * Check if a VNode result is a single DOM element (not Fragment, array, or primitive)
 */
function isSingleElement(result: VNode | JSXNode): result is VNode {
  if (result == null || typeof result !== "object") {
    return false;
  }
  if (Array.isArray(result)) {
    return false;
  }
  if (!("type" in result)) {
    return false;
  }
  const vnode = result as VNode;
  // Must be a string type (DOM element), not Fragment or function component
  return typeof vnode.type === "string";
}

/**
 * Generate a component key from path for use as identifier
 * Example: "/home/user/project/src/components/Counter.tsx" -> "components/Counter"
 */
function getComponentKey(componentPath: string, rootDir: string): string {
  // Convert file:// URL to path
  let path = componentPath;
  if (path.startsWith("file://")) {
    path = new URL(path).pathname;
  }

  // Make relative to root and remove src/ prefix
  if (path.startsWith(rootDir)) {
    path = path.slice(rootDir.length);
  }
  path = path.replace(/^\/?(src\/)?/, "");

  // Remove extension
  path = path.replace(/\.\w+$/, "");

  // Sanitize for use as attribute value
  path = path.replace(/[^a-zA-Z0-9/_-]/g, "_");

  return path;
}

/**
 * Inject island attributes into the first tag of rendered HTML
 */
function injectIslandAttrs(
  html: string,
  islandId: string,
  componentKey: string,
  propsJson: string,
): string {
  // Find the first > of the opening tag
  const firstTagEnd = html.indexOf(">");
  if (firstTagEnd === -1) {
    return html;
  }

  const escapedProps = escapeHTML(propsJson);
  const attrs = ` data-island-id="${islandId}" data-island-src="${componentKey}" data-island-props="${escapedProps}"`;

  // Handle self-closing tags
  if (html[firstTagEnd - 1] === "/") {
    return html.slice(0, firstTagEnd - 1) + attrs + " />" + html.slice(firstTagEnd + 1);
  }

  return html.slice(0, firstTagEnd) + attrs + html.slice(firstTagEnd);
}

/**
 * Render an island component
 * - Renders the full HTML content on server (for SEO and no-JS users)
 * - If hydration disabled: renders as plain HTML (no markers)
 * - If hydration enabled: adds markers for client-side hydration
 */
async function renderIsland(
  vnode: VNode,
  context: RenderContext,
  parentContext: ContextMap,
): Promise<string> {
  const metadata = getIslandMetadata(vnode);
  if (!metadata) {
    return "";
  }

  // Extract component name for better debugging
  const componentName =
    typeof metadata.component === "function" ? metadata.component.name || "Anonymous" : "Unknown";

  // Render the island's content on the server
  let content = "";
  let result: any;
  try {
    const props = metadata.props || {};
    const currentContext = resolveComponentContext(metadata.component, props, parentContext);
    result = metadata.component(props, createComponentAPI(currentContext));

    // Handle async component - await the Promise
    if (result instanceof Promise) {
      result = await result;
    }

    // Handle async iterator - take only the first yield
    if (isAsyncIterator(result)) {
      const { value } = await result.next();
      result = value;
    }

    // Handle signal return - unwrap the value
    if (isSignal(result)) {
      result = unwrap(result);
    }

    content = await renderVNodeToHTML(result, context, currentContext);
  } catch (error) {
    console.error(`[SSR] Error rendering island (${componentName}):`, error);
    return renderErrorFallback(error, vnode);
  }

  // If hydration is disabled, just return the plain HTML
  if (!context.enableHydration) {
    return content;
  }

  // Generate unique island ID using component name
  const islandId = generateIslandId(componentName, context.islandCounter++);

  // Generate component key for grouping islands by component
  const componentKey = getComponentKey(metadata.modulePath, context.rootDir);

  // Serialize props for hydration
  const serializedProps = serializeProps(metadata.props);

  // Store island metadata
  const islandMetadata: IslandMetadata = {
    id: islandId,
    path: metadata.modulePath,
    props: serializedProps,
    componentName,
  };
  context.islands.push(islandMetadata);

  const propsJson = JSON.stringify(serializedProps);

  // Resolve module export names for stable component identifiers.
  // This maps Function references to their export names so serialized
  // children use export names (matching the client registry) instead of
  // potentially-fragile Function.name values.
  const nameMap = await resolveNameMap(metadata.modulePath);

  // Serialize children VNodes so the client can reconstruct the full tree
  const serializedChildren = serializeVNodeChildren(metadata.props?.children, nameMap);
  const childrenScript = serializedChildren
    ? `<script type="application/json" data-island-children="${islandId}">${JSON.stringify(serializedChildren)}</script>`
    : "";

  // Single DOM element: inject attrs directly (no wrapper div)
  if (isSingleElement(result)) {
    return injectIslandAttrs(content, islandId, componentKey, propsJson) + childrenScript;
  }

  // Fragment or other: use comment markers + script tag
  // Use unique end marker to support nested islands
  return `<!--island:${islandId}-->${content}<!--/island:${islandId}--><script type="application/json" data-island="${islandId}" data-island-src="${componentKey}">${propsJson}</script>${childrenScript}`;
}

/**
 * Render a DOM element to HTML
 */
async function renderElement(
  vnode: VNode,
  context: RenderContext,
  parentContext: ContextMap,
): Promise<string> {
  const tag = vnode.type as string;
  const props = vnode.props || {};

  // Handle dangerouslySetInnerHTML
  if (props.dangerouslySetInnerHTML?.__html != null) {
    const attrs = renderAttributes(props, context);
    return `<${tag}${attrs}>${props.dangerouslySetInnerHTML.__html}</${tag}>`;
  }

  // Self-closing tags
  const selfClosing = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ];

  // Build attributes
  const attrs = renderAttributes(props, context);

  // Self-closing tag
  if (selfClosing.includes(tag)) {
    return `<${tag}${attrs} />`;
  }

  // Raw text elements: content must NOT be HTML-escaped
  if (tag === "style" || tag === "script") {
    const rawChildren = (vnode.children || []).map((child: JSXNode) => extractRawText(child));
    return `<${tag}${attrs}>${rawChildren.join("")}</${tag}>`;
  }

  // Regular tag with children
  const childResults = await Promise.all(
    (vnode.children || []).map((child: JSXNode) =>
      renderVNodeToHTML(child, context, parentContext),
    ),
  );
  const children = childResults.join("");

  return `<${tag}${attrs}>${children}</${tag}>`;
}

/**
 * Extract raw text from a VNode without HTML escaping.
 * Used for <style> and <script> content.
 */
function extractRawText(vnode: JSXNode): string {
  if (vnode == null || typeof vnode === "boolean") return "";
  if (typeof vnode === "string" || typeof vnode === "number") return String(vnode);
  if (Array.isArray(vnode)) return vnode.map(extractRawText).join("");
  if (typeof vnode === "object" && "type" in vnode) {
    const v = vnode as VNode;
    if (v.type === "#text") return String(v.props?.nodeValue ?? "");
    if (v.type === "#signal") {
      const signal = v.props?.signal;
      if (signal && isSignal(signal)) return String(unwrap(signal));
      return "";
    }
    // Flatten children
    return (v.children || []).map(extractRawText).join("");
  }
  return "";
}

function resolveComponentContext(
  component: Function,
  props: Record<string, any>,
  parentContext: ContextMap,
): ContextMap {
  const isContextProvider = (component as any).__isContextProvider;
  if (!isContextProvider) {
    return parentContext;
  }

  const currentContext = new Map(parentContext);
  const provide = (props as any).provide;
  if (!provide) {
    return currentContext;
  }

  const isSingle = provide.length === 2 && typeof provide[0] === "symbol";
  if (isSingle) {
    const [context, value] = provide;
    currentContext.set(context, value);
    return currentContext;
  }

  for (const [context, value] of provide) {
    currentContext.set(context, value);
  }
  return currentContext;
}

/**
 * Resolve a class value to a string for SSR output.
 *
 * Handles strings, StyleToken objects, arrays, and falsy values.
 * When a StyleToken is encountered, its CSS rule is collected into
 * the render context for inclusion in the output.
 */
function resolveClass(value: unknown, context?: RenderContext): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (isStyleToken(value)) {
    if (context && value.__cssTemplate) {
      context.styles.add(value.__cssTemplate);
    }
    return value._ ?? "";
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => resolveClass(v, context))
      .filter(Boolean)
      .join(" ");
  }

  return String(value);
}

/**
 * Render element attributes
 */
function renderAttributes(props: Record<string, any>, context?: RenderContext): string {
  const attrs: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    // Skip special props
    if (key === "children" || key === "key" || key === "ref" || key === "dangerouslySetInnerHTML") {
      continue;
    }

    // Skip event handlers
    if (key.startsWith("on")) {
      continue;
    }

    // Skip functions
    if (typeof value === "function") {
      continue;
    }

    // Skip null/undefined
    if (value == null) {
      continue;
    }

    // Handle signals
    let attrValue = value;
    if (isSignal(value)) {
      attrValue = unwrap(value);
    }

    // Boolean attributes
    if (typeof attrValue === "boolean") {
      if (attrValue) {
        attrs.push(key);
      }
      continue;
    }

    // Handle JSX -> HTML attribute name mapping
    const attrName =
      key === "className"
        ? "class"
        : key === "htmlFor"
          ? "for"
          : key === "charSet"
            ? "charset"
            : key === "crossOrigin"
              ? "crossorigin"
              : key === "httpEquiv"
                ? "http-equiv"
                : key;

    // Handle class/className — resolve arrays and StyleToken objects
    if (attrName === "class") {
      const resolved = resolveClass(attrValue, context);
      if (resolved) {
        attrs.push(`class="${escapeHTML(resolved)}"`);
      }
      continue;
    }

    // Handle style object
    if (attrName === "style" && typeof attrValue === "object") {
      const styleStr = Object.entries(attrValue)
        .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
        .join("; ");
      attrs.push(`style="${escapeHTML(styleStr)}"`);
      continue;
    }

    // Regular attributes
    attrs.push(`${attrName}="${escapeHTML(String(attrValue))}"`);
  }

  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

/**
 * Generate script tags for loading islands
 *
 * If no transformer is provided, returns empty string (static HTML only).
 * If transformer is provided, calls it for each island to generate custom scripts.
 */
function generateIslandScripts(
  islands: IslandMetadata[],
  basePath: string,
  transformer?: IslandScriptTransformer,
): string {
  // No islands or no transformer = no scripts (static HTML only)
  if (islands.length === 0 || !transformer) {
    return "";
  }

  const scripts: string[] = [];

  for (const island of islands) {
    const script = transformer({
      id: island.id,
      path: island.path,
      props: island.props,
      componentName: island.componentName || "Unknown",
      basePath,
    });

    if (script) {
      scripts.push(script);
    }
  }

  return scripts.join("\n");
}

/**
 * Render error fallback
 */
function renderErrorFallback(error: any, vnode?: VNode): string {
  const message = error?.message || String(error);
  const componentName = vnode && typeof vnode.type === "function" ? vnode.type.name : "Unknown";

  return `<div style="border: 2px solid red; padding: 10px; margin: 10px; background: #fee;">
    <strong>Error rendering component: ${escapeHTML(componentName)}</strong>
    <pre>${escapeHTML(message)}</pre>
  </div>`;
}

/**
 * Generate a unique island ID from component name and counter
 * Examples: "Counter-0", "todo-list-1", "my-component-2"
 */
function generateIslandId(componentName: string, counter: number): string {
  // Convert to kebab-case and sanitize for use as HTML attribute
  const kebabName = camelToKebab(componentName)
    .toLowerCase()
    // Remove leading dash if component name started with uppercase
    .replace(/^-/, "")
    // Replace any non-alphanumeric characters (except dash) with dash
    .replace(/[^a-z0-9-]/g, "-")
    // Remove consecutive dashes
    .replace(/-+/g, "-")
    // Remove trailing dashes
    .replace(/-$/, "");

  return `${kebabName}-${counter}`;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Check if a value is a plain object
 */
function isPlainObject(value: any): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
