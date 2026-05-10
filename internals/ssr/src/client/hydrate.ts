/**
 * Client-side hydration for SSR
 * This module runs in the browser and hydrates server-rendered content
 */

import type { VNode } from "@semajsx/core";
import { Fragment, createComponentAPI, h } from "@semajsx/core";
import type { ContextMap } from "@semajsx/core";
import { setProperty, render } from "@semajsx/dom";
import { isSignal } from "@semajsx/signal";

/**
 * Island info collected from the DOM
 */
interface IslandInfo {
  id: string;
  props: Record<string, any>;
  /** Element with data-island-id (single element islands) */
  element?: HTMLElement;
  /** Start comment node (fragment islands) */
  startComment?: Comment;
  /** End comment node (fragment islands) */
  endComment?: Comment;
}

/**
 * Type guard for async iterators
 */
function isAsyncIterator(value: unknown): value is AsyncIterableIterator<unknown> {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string | symbol, unknown>;
  return (
    typeof obj[Symbol.asyncIterator] === "function" ||
    (typeof obj.next === "function" && typeof obj.return === "function")
  );
}

/**
 * Hydrate a server-rendered DOM tree with client-side interactivity
 * Unlike render(), this preserves existing DOM and only attaches event listeners
 *
 * @param vnode - The VNode to hydrate
 * @param container - The DOM container with server-rendered content
 * @returns The hydrated root node
 *
 * @example
 * ```tsx
 * const vnode = <Counter initial={5} />
 * const container = document.querySelector('[data-island-id="island-0"]')
 * hydrate(vnode, container)
 * ```
 */
export function hydrate(vnode: VNode, container: Element): Node | null {
  // Standard hydration: hydrate container's first child
  const nodeToHydrate = container.firstChild;

  if (!nodeToHydrate) {
    console.warn("[Hydrate] Container is empty, falling back to render");
    const rendered = renderNode(vnode, container, new Map());
    if (rendered) {
      container.appendChild(rendered);
    }
    return rendered;
  }

  // Hydrate the VNode tree onto the existing DOM
  try {
    hydrateNode(vnode, nodeToHydrate, container, new Map());
    return nodeToHydrate;
  } catch (error) {
    console.error("[Hydrate] Error during hydration:", error);
    // Fall back to client-side rendering if hydration fails
    console.warn("[Hydrate] Falling back to client-side rendering");
    container.innerHTML = "";
    return renderNode(vnode, container, new Map());
  }
}

/**
 * Hydrate a VNode onto an existing DOM node
 */
function hydrateNode(
  vnode: VNode | any,
  domNode: Node,
  parentElement: Element,
  parentContext: ContextMap,
): void {
  // Handle null/undefined
  if (vnode == null) {
    return;
  }

  // Handle signals - unwrap and subscribe
  if (isSignal(vnode)) {
    // For signal VNodes, we need to hydrate the current value
    // and set up reactivity to update when signal changes
    hydrateSignalNode(vnode, domNode, parentElement, parentContext);
    return;
  }

  // Handle primitives (text nodes)
  if (typeof vnode === "string" || typeof vnode === "number") {
    if (domNode.nodeType === Node.TEXT_NODE) {
      // Text node already exists, verify content matches
      const expectedText = String(vnode);
      if (domNode.textContent !== expectedText) {
        console.warn("[Hydrate] Text mismatch, updating:", domNode.textContent, "->", expectedText);
        domNode.textContent = expectedText;
      }
    }
    return;
  }

  // Handle arrays
  if (Array.isArray(vnode)) {
    let currentDomNode: Node | null = domNode;
    for (const child of vnode) {
      if (currentDomNode) {
        hydrateNode(child, currentDomNode, parentElement, parentContext);
        currentDomNode = currentDomNode.nextSibling;
      }
    }
    return;
  }

  // Must be a VNode object
  if (typeof vnode !== "object" || !("type" in vnode)) {
    return;
  }

  const vnodeTyped = vnode as VNode;

  // Handle signal nodes - special reactive nodes
  if (vnodeTyped.type === "#signal") {
    const signal = vnodeTyped.props?.signal;
    if (signal && isSignal(signal)) {
      hydrateSignalNode(signal, domNode, parentElement, parentContext);
    }
    return;
  }

  // Handle fragments
  if (vnodeTyped.type === Fragment) {
    let currentDomNode: Node | null = domNode;
    for (const child of vnodeTyped.children) {
      if (currentDomNode) {
        hydrateNode(child, currentDomNode, parentElement, parentContext);
        currentDomNode = currentDomNode.nextSibling;
      }
    }
    return;
  }

  // Handle function components - render and hydrate result
  if (typeof vnodeTyped.type === "function") {
    // Merge vnode.children into props.children (mirrors renderVNodeToHTML)
    const props =
      vnodeTyped.children && vnodeTyped.children.length > 0
        ? { ...vnodeTyped.props, children: vnodeTyped.children }
        : vnodeTyped.props || {};
    const currentContext = resolveComponentContext(vnodeTyped.type, props, parentContext);
    let result = vnodeTyped.type(props, createComponentAPI(currentContext));

    // Handle async component
    if (result instanceof Promise) {
      result.then((resolved) => hydrateNode(resolved, domNode, parentElement, currentContext));
      return;
    }

    // Handle async iterator (streaming component)
    if (isAsyncIterator(result)) {
      result.next().then(({ value }) => {
        hydrateNode(value, domNode, parentElement, currentContext);
      });
      return;
    }

    hydrateNode(result, domNode, parentElement, currentContext);
    return;
  }

  // Handle DOM elements
  if (typeof vnodeTyped.type === "string") {
    // Skip validation for text nodes - they can legitimately be text in the DOM
    // This happens when signal values or other dynamic content renders as text
    if (domNode.nodeType === Node.TEXT_NODE) {
      // Text node in place of element - possible mismatch, but might be intentional
      // Skip hydration for this node
      return;
    }

    if (domNode.nodeType !== Node.ELEMENT_NODE) {
      console.warn("[Hydrate] Expected element, got:", domNode.nodeType);
      return;
    }

    const element = domNode as Element;

    // Verify tag matches
    if (element.tagName.toLowerCase() !== vnodeTyped.type.toLowerCase()) {
      console.warn("[Hydrate] Tag mismatch:", element.tagName, "vs", vnodeTyped.type);
      return;
    }

    // Hydrate properties (especially event listeners and reactive props)
    hydrateProperties(element, vnodeTyped.props || {});

    // Hydrate children
    hydrateChildren(element, vnodeTyped.children, parentContext);
    return;
  }
}

/**
 * Hydrate properties onto an element
 * This is where we attach event listeners and set up reactive properties
 */
function hydrateProperties(element: Element, props: Record<string, any>): void {
  for (const [key, value] of Object.entries(props)) {
    // Skip special props
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

    // Handle event listeners - these need to be attached
    if (key.startsWith("on")) {
      const eventName = key.slice(2).toLowerCase();
      if (typeof value === "function") {
        element.addEventListener(eventName, value as EventListener);
      }
      continue;
    }

    // Handle reactive properties (signals)
    if (isSignal(value)) {
      // Set initial value
      setProperty(element, key, value.value);

      // Set up reactivity using subscribe
      value.subscribe((newValue: any) => {
        setProperty(element, key, newValue);
      });
      continue;
    }

    // For static properties, they should already be set by SSR
    // We can optionally verify them, but usually we trust SSR output
    // to avoid unnecessary DOM operations
  }

  // Handle refs
  if (props.ref) {
    if (typeof props.ref === "function") {
      props.ref(element);
    } else if (typeof props.ref === "object" && props.ref !== null) {
      props.ref.current = element;
    }
  }
}

/**
 * Hydrate children elements
 */
function hydrateChildren(element: Element, children: any[], parentContext: ContextMap): void {
  let currentDomNode = element.firstChild;

  for (const child of children) {
    if (!currentDomNode) {
      // Mismatch: VNode has more children than DOM
      // Fall back to appending new nodes
      console.warn("[Hydrate] Missing DOM node for child, appending");
      const newNode = renderNode(child, element, parentContext);
      if (newNode) {
        element.appendChild(newNode);
      }
      continue;
    }

    hydrateNode(child, currentDomNode, element, parentContext);
    currentDomNode = currentDomNode.nextSibling;
  }

  // If DOM has extra nodes, we could warn or remove them
  // For now, we leave them (progressive enhancement)
}

/**
 * Hydrate a signal VNode
 * Set up reactivity to replace content when signal changes
 */
function hydrateSignalNode(
  signal: any,
  domNode: Node,
  parentElement: Element,
  parentContext: ContextMap,
): void {
  // Get current signal value
  const currentValue = signal.value;

  // Handle empty/null signal values - server renders as <!--signal-empty--> comment
  if (
    currentValue == null ||
    currentValue === false ||
    (Array.isArray(currentValue) && currentValue.length === 0)
  ) {
    // Expect a comment node marker
    if (domNode.nodeType === Node.COMMENT_NODE) {
      // Comment marker is correct, nothing to validate
    } else {
      console.warn("[Hydrate] Expected comment marker for empty signal, got:", domNode.nodeType);
    }
  } // For simple values (string, number), the server renders them as text nodes
  else if (typeof currentValue === "string" || typeof currentValue === "number") {
    if (domNode.nodeType === Node.TEXT_NODE) {
      const expectedText = String(currentValue);
      if (domNode.textContent !== expectedText) {
        console.warn("[Hydrate] Signal text mismatch:", domNode.textContent, "->", expectedText);
        domNode.textContent = expectedText;
      }
    }
  } else {
    // For complex values (VNodes, etc.), do full hydration
    hydrateNode(currentValue, domNode, parentElement, parentContext);
  }

  // Set up reactivity to handle signal changes
  // Use an anchor comment node to track position in DOM
  // This is necessary because arrays render as DocumentFragments which can't be tracked
  let anchor: Comment;
  let currentNodes: Node[] = [];

  if (domNode.nodeType === Node.COMMENT_NODE) {
    // Already a comment (empty signal), use as anchor
    anchor = domNode as Comment;
  } else {
    // Create anchor and insert it before current node
    anchor = document.createComment("signal-anchor");
    if (domNode.parentNode) {
      domNode.parentNode.insertBefore(anchor, domNode);
    }
    currentNodes = [domNode];
  }

  signal.subscribe((newValue: any) => {
    const parent = anchor.parentNode;
    if (!parent) {
      return;
    }

    // Remove old nodes
    for (const node of currentNodes) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    currentNodes = [];

    // Render and insert new content after anchor
    const newNode = renderNode(newValue, parentElement, parentContext);
    if (newNode) {
      if (newNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        // Fragment: insert all children after anchor in correct order
        const fragment = newNode as DocumentFragment;
        const children = Array.from(fragment.childNodes);

        // Insert in order by tracking the last inserted node
        let insertAfter: Node | null = anchor;
        for (const child of children) {
          parent.insertBefore(child, insertAfter.nextSibling);
          insertAfter = child;
          currentNodes.push(child);
        }
      } else {
        // Single node: insert after anchor
        parent.insertBefore(newNode, anchor.nextSibling);
        currentNodes = [newNode];
      }
    }
  });
}

/**
 * Render a VNode to a DOM node (fallback when hydration fails)
 * This is a simplified version of render() just for hydration fallback
 */
// oxlint-disable-next-line only-used-in-recursion
function renderNode(vnode: any, parentElement: Element, parentContext: ContextMap): Node | null {
  if (vnode == null || vnode === false || vnode === true) {
    return document.createComment("empty");
  }

  if (isSignal(vnode)) {
    return renderNode(vnode.value, parentElement, parentContext);
  }

  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode));
  }

  if (Array.isArray(vnode)) {
    // Empty array should render as a comment marker
    if (vnode.length === 0) {
      return document.createComment("empty");
    }

    const fragment = document.createDocumentFragment();
    for (const child of vnode) {
      const node = renderNode(child, parentElement, parentContext);
      if (node) {
        fragment.appendChild(node);
      }
    }
    return fragment;
  }

  if (typeof vnode === "object" && "type" in vnode) {
    const vnodeTyped = vnode as VNode;

    // Handle special VNode types
    if (vnodeTyped.type === "#text") {
      return document.createTextNode(String(vnodeTyped.props?.nodeValue || ""));
    }

    if (vnodeTyped.type === "#signal") {
      const signal = vnodeTyped.props?.signal;
      if (signal && isSignal(signal)) {
        return renderNode(signal.value, parentElement, parentContext);
      }
      return document.createTextNode("");
    }

    if (vnodeTyped.type === Fragment) {
      const fragment = document.createDocumentFragment();
      for (const child of vnodeTyped.children) {
        const node = renderNode(child, parentElement, parentContext);
        if (node) {
          fragment.appendChild(node);
        }
      }
      return fragment;
    }

    if (typeof vnodeTyped.type === "function") {
      const props =
        vnodeTyped.children && vnodeTyped.children.length > 0
          ? { ...vnodeTyped.props, children: vnodeTyped.children }
          : vnodeTyped.props || {};
      const currentContext = resolveComponentContext(vnodeTyped.type, props, parentContext);
      const result = vnodeTyped.type(props, createComponentAPI(currentContext));
      return renderNode(result, parentElement, currentContext);
    }

    if (typeof vnodeTyped.type === "string") {
      const element = document.createElement(vnodeTyped.type);

      // Set properties
      const props = vnodeTyped.props || {};
      for (const [key, value] of Object.entries(props)) {
        if (key === "children" || key === "key") continue;
        setProperty(element, key, value);
      }

      // Render children
      for (const child of vnodeTyped.children) {
        const childNode = renderNode(child, element, parentContext);
        if (childNode) {
          element.appendChild(childNode);
        }
      }

      return element;
    }
  }

  return null;
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
 * Hydrate an island by ID
 * Handles both single-element islands (with data-island-id) and fragment islands (with comment markers)
 *
 * @param islandId - The island ID to hydrate
 * @param Component - The component function to render
 * @param markHydrated - Callback to mark the island as hydrated
 *
 * @example
 * ```tsx
 * import { hydrateIsland, markIslandHydrated } from '@semajsx/ssr/client';
 * import Counter from './Counter';
 *
 * hydrateIsland('counter-0', Counter, markIslandHydrated);
 * ```
 */
export function hydrateIsland(
  islandId: string,
  Component: Function,
  markHydrated: (id: string) => void,
): void {
  // Try single-element island first (has data-island-id on root element)
  const element = document.querySelector(`[data-island-id="${islandId}"]`);

  if (element) {
    // Single-element island: replace the element with rendered content
    const props = JSON.parse(element.getAttribute("data-island-props") || "{}");
    const parent = element.parentNode;
    if (!parent) return;

    // Create VNode for the component
    const vnode: VNode = {
      type: Component as VNode["type"],
      props,
      children: [],
    };

    // Render into temp container
    const temp = document.createElement("div");
    render(vnode, temp);

    // Replace original element with rendered content
    const children = Array.from(temp.childNodes);
    for (const child of children) {
      parent.insertBefore(child, element);
    }
    parent.removeChild(element);

    markHydrated(islandId);
    return;
  }

  // Fragment island: find by comment marker
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  let startComment: Comment | null = null;
  let comment: Comment | null;
  while ((comment = walker.nextNode() as Comment | null)) {
    if (comment.textContent === `island:${islandId}`) {
      startComment = comment;
      break;
    }
  }

  if (startComment) {
    // Get props from script tag
    const script = document.querySelector(`script[data-island="${islandId}"]`);
    const props = script ? JSON.parse(script.textContent || "{}") : {};

    // Find end comment and collect nodes between markers
    const nodesToRemove: Node[] = [];
    let sibling = startComment.nextSibling;
    let endComment: Comment | null = null;
    while (sibling) {
      if (sibling.nodeType === Node.COMMENT_NODE && sibling.textContent === `/island:${islandId}`) {
        endComment = sibling as Comment;
        break;
      }
      nodesToRemove.push(sibling);
      sibling = sibling.nextSibling;
    }

    // Remove old nodes
    for (const node of nodesToRemove) {
      node.parentNode?.removeChild(node);
    }

    // Render new content with full reactivity
    const vnode: VNode = {
      type: Component as VNode["type"],
      props,
      children: [],
    };
    const parent = startComment.parentNode;
    if (parent) {
      // Create temp container and use full render for reactivity
      const temp = document.createElement("div");
      render(vnode, temp);

      // Move rendered nodes after start comment
      const children = Array.from(temp.childNodes);
      for (const child of children) {
        parent.insertBefore(child, endComment);
      }
    }

    // Remove markers and script
    startComment.parentNode?.removeChild(startComment);
    if (endComment) endComment.parentNode?.removeChild(endComment);
    if (script) script.parentNode?.removeChild(script);

    markHydrated(islandId);
  }
}

/**
 * Find all islands on the page (both element and fragment types)
 */
function findAllIslands(): IslandInfo[] {
  const islands: IslandInfo[] = [];

  // Find element-based islands (single root element)
  const elements = document.querySelectorAll("[data-island-id]");
  for (const el of elements) {
    const id = el.getAttribute("data-island-id");
    const propsStr = el.getAttribute("data-island-props");
    if (id) {
      islands.push({
        id,
        props: propsStr ? JSON.parse(propsStr) : {},
        element: el as HTMLElement,
      });
    }
  }

  // Find fragment-based islands (comment markers + script)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);

  let comment: Comment | null;
  while ((comment = walker.nextNode() as Comment | null)) {
    const match = comment.textContent?.match(/^island:(.+)$/);
    if (match && match[1]) {
      const id = match[1];
      // Find end comment (matches /island:${id})
      let endComment: Comment | null = null;
      let sibling = comment.nextSibling;
      while (sibling) {
        if (sibling.nodeType === Node.COMMENT_NODE && sibling.textContent === `/island:${id}`) {
          endComment = sibling as Comment;
          break;
        }
        sibling = sibling.nextSibling;
      }

      // Find props from script tag
      const script = document.querySelector(`script[type="application/json"][data-island="${id}"]`);
      const props = script ? JSON.parse(script.textContent || "{}") : {};

      islands.push({
        id,
        props,
        startComment: comment,
        endComment: endComment || undefined,
      });
    }
  }

  return islands;
}

/**
 * Hydrate all islands on the page
 * This function is typically called once after the page loads
 *
 * @example
 * ```tsx
 * // In your client entry point
 * import { hydrateIslands } from '@semajsx/ssr/client'
 *
 * // Wait for DOM to be ready
 * if (document.readyState === 'loading') {
 *   document.addEventListener('DOMContentLoaded', hydrateIslands)
 * } else {
 *   hydrateIslands()
 * }
 * ```
 */
export async function hydrateIslands(): Promise<void> {
  const islands = findAllIslands();

  if (islands.length === 0) {
    return;
  }

  console.log(`[SemaJSX] Found ${islands.length} islands to hydrate`);

  // Hydrate islands in parallel for better performance
  const hydrations = islands.map((island) => waitForIslandScript(island));

  await Promise.all(hydrations);

  console.log(`[SemaJSX] All islands hydrated`);
}

/**
 * Wait for an island's script to load and hydrate it
 * The actual hydration is performed by the island's entry point script
 * This function just waits for it to complete
 */
async function waitForIslandScript(island: IslandInfo): Promise<void> {
  const { id: islandId, element, startComment } = island;

  // Check if island is already hydrated
  if (element?.hasAttribute("data-hydrated")) {
    return;
  }
  if (startComment?.parentElement?.querySelector(`[data-island-hydrated="${islandId}"]`)) {
    return;
  }

  // Wait for hydration to complete (set by island entry point)
  return new Promise((resolve) => {
    // Check every 50ms for up to 10 seconds
    const maxAttempts = 200;
    let attempts = 0;

    const checkInterval = setInterval(() => {
      const isHydrated = element
        ? element.hasAttribute("data-hydrated")
        : document.querySelector(`[data-island-hydrated="${islandId}"]`) !== null;

      if (isHydrated) {
        clearInterval(checkInterval);
        resolve();
      } else if (++attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn(`[SemaJSX] Island ${islandId} hydration timeout`);
        resolve();
      }
    }, 50);
  });
}

/**
 * Get island info by ID
 */
export function getIslandInfo(islandId: string): IslandInfo | null {
  // Try element-based first
  const element = document.querySelector(`[data-island-id="${islandId}"]`) as HTMLElement | null;

  if (element) {
    const propsStr = element.getAttribute("data-island-props");
    return {
      id: islandId,
      props: propsStr ? JSON.parse(propsStr) : {},
      element,
    };
  }

  // Try fragment-based
  const script = document.querySelector(
    `script[type="application/json"][data-island="${islandId}"]`,
  );

  if (script) {
    const props = JSON.parse(script.textContent || "{}");
    // Find start comment
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    let comment: Comment | null;
    while ((comment = walker.nextNode() as Comment | null)) {
      if (comment.textContent === `island:${islandId}`) {
        return {
          id: islandId,
          props,
          startComment: comment,
        };
      }
    }
  }

  return null;
}

/**
 * Manual hydration for a specific island
 * Useful for lazy-loading islands on interaction
 *
 * @param islandId - The island ID to hydrate
 *
 * @example
 * ```tsx
 * // Lazy load an island on click
 * button.addEventListener('click', () => {
 *   hydrateIslandById('island-0')
 * })
 * ```
 */
export async function hydrateIslandById(islandId: string): Promise<void> {
  const island = getIslandInfo(islandId);

  if (!island) {
    console.error(`[SemaJSX] Island not found: ${islandId}`);
    return;
  }

  await waitForIslandScript(island);
}

/**
 * Check if islands are present on the page
 */
export function hasIslands(): boolean {
  // Check for element-based islands
  if (document.querySelectorAll("[data-island-id]").length > 0) {
    return true;
  }
  // Check for fragment-based islands
  return document.querySelectorAll('script[type="application/json"][data-island]').length > 0;
}

/**
 * Get all island IDs on the page
 */
export function getIslandIds(): string[] {
  const ids: string[] = [];

  // Element-based islands
  const elements = document.querySelectorAll("[data-island-id]");
  for (const el of elements) {
    const id = el.getAttribute("data-island-id");
    if (id) ids.push(id);
  }

  // Fragment-based islands
  const scripts = document.querySelectorAll('script[type="application/json"][data-island]');
  for (const script of scripts) {
    const id = script.getAttribute("data-island");
    if (id) ids.push(id);
  }

  return ids;
}

/**
 * Mark an island as hydrated
 * This should be called by the island entry point after hydration completes
 */
export function markIslandHydrated(islandId: string): void {
  // Try element-based first
  const element = document.querySelector(`[data-island-id="${islandId}"]`);
  if (element) {
    element.setAttribute("data-hydrated", "true");
    return;
  }

  // For fragment-based, remove the script tag (no longer needed)
  const script = document.querySelector(
    `script[type="application/json"][data-island="${islandId}"]`,
  );
  if (script) {
    // Mark as hydrated before removal (for any watchers)
    script.setAttribute("data-island-hydrated", islandId);
    // Remove script - props already parsed, no longer needed
    script.remove();
  }
}

/**
 * Reconstruct VNode children from serialized JSON data.
 *
 * Uses the island module's exports as a registry to resolve component names
 * (prefixed with "$") back to their actual functions.
 *
 * @param serialized - Serialized children array from SSR
 * @param registry - Module exports mapping component names to functions
 */
function reconstructChildren(serialized: any[], registry: Record<string, any>): any[] {
  const result: any[] = [];
  for (const node of serialized) {
    if (node === null) continue;
    if (typeof node === "string") {
      result.push(node);
      continue;
    }
    if (Array.isArray(node) && node.length === 3 && typeof node[0] === "string") {
      const [type, props, children] = node;

      // Nested island placeholder — these hydrate independently,
      // push null to preserve children index positions.
      if (type === "$island") {
        result.push(null);
        continue;
      }

      const resolvedChildren = children ? reconstructChildren(children, registry) : [];

      if (type.startsWith("$")) {
        // Component reference — look up in registry
        const name = type.slice(1);
        const component = registry[name];
        if (!component || typeof component !== "function") {
          console.warn(`[Hydrate] Unknown component "${name}" in island children`);
          continue;
        }
        result.push(h(component, props || {}, ...resolvedChildren));
      } else {
        // HTML element
        result.push(h(type, props || {}, ...resolvedChildren));
      }
    }
  }
  return result;
}

/**
 * Hydrate all islands with a given component source
 * Finds all elements with data-island-src and hydrates them
 *
 * @param componentSrc - The component source key (e.g., "components/Counter")
 * @param Component - The component function to render
 * @param registry - Optional module exports for reconstructing island children
 *
 * @example
 * ```tsx
 * import { hydrateAllIslands } from '@semajsx/ssr/client';
 * import * as CounterModule from './Counter';
 *
 * hydrateAllIslands('components/Counter', CounterModule.Counter, CounterModule);
 * ```
 */
export function hydrateAllIslands(
  componentSrc: string,
  Component: Function,
  registry?: Record<string, any>,
): void {
  // Find all elements with this component source
  const elements = document.querySelectorAll(`[data-island-src="${componentSrc}"]`);

  // Also find fragment-based islands (script tags with data-island-src)
  const scripts = document.querySelectorAll(
    `script[type="application/json"][data-island-src="${componentSrc}"]`,
  );

  // Hydrate each element-based island
  elements.forEach((element) => {
    const islandId = element.getAttribute("data-island-id");
    if (!islandId) return;

    // Skip if already hydrated
    if (element.hasAttribute("data-hydrated")) return;

    try {
      const props = JSON.parse(element.getAttribute("data-island-props") || "{}");

      // Reconstruct children from serialized VNode data if available
      if (registry) {
        const childrenScript = document.querySelector(
          `script[type="application/json"][data-island-children="${islandId}"]`,
        );
        if (childrenScript) {
          try {
            const serialized = JSON.parse(childrenScript.textContent || "[]");
            props.children = reconstructChildren(serialized, registry);
          } catch (e) {
            console.warn("[Hydrate] Failed to reconstruct island children:", e);
          }
          childrenScript.remove();
        }
      }

      // Create VNode for the component
      const vnode: VNode = {
        type: Component as VNode["type"],
        props,
        children: [],
      };

      // Hydrate in-place: attach event listeners, signal subscriptions,
      // and refs while preserving existing DOM and SSR-rendered children.
      hydrateNode(vnode, element, element.parentNode as Element, new Map());
      element.setAttribute("data-hydrated", "true");
    } catch (error) {
      // SSR content is preserved — the island stays as static HTML
      console.error(`[Hydrate] Island "${islandId}" hydration failed:`, error);
      element.setAttribute("data-hydration-error", "true");
    }
  });

  // Hydrate each fragment-based island
  scripts.forEach((script) => {
    const islandId = script.getAttribute("data-island");
    if (!islandId) return;

    // Skip if already hydrated
    if (script.hasAttribute("data-island-hydrated")) return;

    try {
      const props = JSON.parse(script.textContent || "{}");

      // Reconstruct children from serialized VNode data if available
      if (registry) {
        const childrenScript = document.querySelector(
          `script[type="application/json"][data-island-children="${islandId}"]`,
        );
        if (childrenScript) {
          try {
            const serialized = JSON.parse(childrenScript.textContent || "[]");
            props.children = reconstructChildren(serialized, registry);
          } catch (e) {
            console.warn("[Hydrate] Failed to reconstruct island children:", e);
          }
          childrenScript.remove();
        }
      }

      // Find the comment markers
      const startMarker = `island:${islandId}`;
      const endMarker = `/island:${islandId}`;

      // Find and process the fragment
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);

      let startNode: Comment | null = null;
      let endNode: Comment | null = null;
      let node: Node | null;

      while ((node = walker.nextNode())) {
        if (node.nodeValue === startMarker) {
          startNode = node as Comment;
        } else if (node.nodeValue === endMarker) {
          endNode = node as Comment;
          break;
        }
      }

      if (startNode && endNode && startNode.parentNode) {
        const parent = startNode.parentNode;

        // Non-destructive hydration: move existing nodes into a temp
        // container, hydrate against the existing DOM, then move back.
        // This preserves SSR content and only attaches event listeners
        // and signal subscriptions — matching element-based island behavior.
        const container = document.createElement("div");
        let current: Node | null = startNode.nextSibling;
        while (current && current !== endNode) {
          const next = current.nextSibling;
          container.appendChild(current); // moves node, doesn't clone
          current = next;
        }

        // Create VNode and hydrate against existing DOM
        const vnode: VNode = {
          type: Component as VNode["type"],
          props,
          children: [],
        };
        hydrateNode(vnode, container, container, new Map());

        // Move hydrated nodes back between markers
        while (container.firstChild) {
          parent.insertBefore(container.firstChild, endNode);
        }

        // Mark as hydrated
        script.setAttribute("data-island-hydrated", islandId);
        script.remove();
      }
    } catch (error) {
      // SSR content is preserved — the fragment stays as static HTML
      console.error(`[Hydrate] Fragment island "${islandId}" hydration failed:`, error);
    }
  });
}

// Export types
export type { IslandInfo };
