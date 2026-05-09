import type { VNode, Ref } from "./types";
import { Fragment, Forward, Portal } from "./types";
import { isSignal } from "@semajsx/signal";
import { isVNode } from "./vnode";
import { resource, stream } from "./helpers";
import { type ComponentRuntimeState, type ContextMap, createComponentAPI } from "./context";
import { normalizeChildrenProp, normalizeComponentResult } from "./component";

/**
 * Generic rendered node structure
 */
export interface RenderedNode<TNode> {
  vnode: VNode;
  node: TNode | null;
  subscriptions: Array<() => void>;
  children: RenderedNode<TNode>[];
}

/**
 * Operations strategy for different rendering targets
 */
export interface RenderStrategy<TNode> {
  /**
   * Create a text node
   */
  createTextNode(text: string): TNode;

  /**
   * Create a comment node (used for markers)
   */
  createComment(text: string): TNode;

  /**
   * Create an element node
   */
  createElement(type: string): TNode;

  /**
   * Get the parent node of a node
   */
  getParent(node: TNode): TNode | null;

  /**
   * Get the next sibling of a node
   */
  getNextSibling(node: TNode): TNode | null;

  /**
   * Insert a node before another node
   */
  insertBefore(parent: TNode, newNode: TNode, beforeNode: TNode | null): void;

  /**
   * Append child to parent
   */
  appendChild(parent: TNode, child: TNode): void;

  /**
   * Remove child from its parent
   */
  removeChild(node: TNode): void;

  /**
   * Replace old node with new node
   */
  replaceNode(oldNode: TNode, newNode: TNode): void;

  /**
   * Set a property on a node
   */
  setProperty(node: TNode, key: string, value: unknown): void;

  /**
   * Set a signal property on a node (returns unsubscribe function)
   */
  setSignalProperty(node: TNode, key: string, signal: any): () => void;

  /**
   * Optional: Set a ref on a node (returns cleanup function)
   * This is only used for DOM rendering
   */
  setRef?(node: TNode, ref: Ref<TNode>): () => void;

  /**
   * Optional: Try to reuse an existing node instead of replacing it
   * Returns true if the node was successfully reused
   * This is used for DOM optimization but not needed for terminal
   */
  tryReuseNode?(
    oldNode: TNode,
    newNode: TNode,
    oldRendered: RenderedNode<TNode>,
    newRendered: RenderedNode<TNode>,
  ): boolean;
}

/**
 * Check if a value is a Promise
 */
export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === "function";
}

/**
 * Check if a value is an AsyncIterator
 */
export function isAsyncIterator<T>(value: any): value is AsyncIterableIterator<T> {
  return value && typeof value[Symbol.asyncIterator] === "function";
}

/**
 * Core rendering logic - works for both DOM and Terminal
 */
export function createRenderer<TNode>(strategy: RenderStrategy<TNode>): {
  renderNode: (vnode: VNode, parentContext: ContextMap) => RenderedNode<TNode>;
  unmount: (node: RenderedNode<TNode>) => void;
  cleanupSubscriptions: (node: RenderedNode<TNode>) => void;
} {
  /**
   * Helper to recursively collect all actual DOM nodes from a rendered node
   * Handles fragments and signal nodes that may not have their own DOM node
   */
  function collectNodes(rendered: RenderedNode<TNode>): TNode[] {
    const nodes: TNode[] = [];

    // Fragment: no node, only children
    if (rendered.vnode.type === Fragment) {
      for (const child of rendered.children) {
        nodes.push(...collectNodes(child));
      }
      return nodes;
    }

    // Portal: children are rendered into a different container,
    // so they should not be collected in the parent tree
    if (rendered.vnode.type === Portal) {
      return nodes;
    }

    // Signal marker: include marker node + content children
    if (rendered.vnode.type === "#signal") {
      if (rendered.node) {
        nodes.push(rendered.node); // marker
      }
      // Collect content children (after marker)
      for (const child of rendered.children) {
        nodes.push(...collectNodes(child));
      }
      return nodes;
    }

    // Regular elements and text nodes: just the node itself
    // Children are already attached to the node
    if (rendered.node) {
      nodes.push(rendered.node);
    } else if (rendered.children.length > 0) {
      // Component returned a Fragment or other node-less structure:
      // recurse into children to collect actual nodes
      for (const child of rendered.children) {
        nodes.push(...collectNodes(child));
      }
    }

    return nodes;
  }

  /**
   * Render a single VNode
   */
  function renderNode(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    const { type } = vnode;

    // Text node
    if (type === "#text") {
      return renderTextNode(vnode);
    }

    // Signal VNode
    if (type === "#signal") {
      return renderSignalNode(vnode, parentContext);
    }

    // Fragment
    if (type === Fragment) {
      return renderFragment(vnode, parentContext);
    }

    // Portal
    if (type === Portal) {
      return renderPortal(vnode, parentContext);
    }

    // Forward
    if (type === Forward) {
      return renderForward(vnode, parentContext);
    }

    // Native node (pre-created element from external libraries)
    if (type === "#native") {
      return renderNativeNode(vnode);
    }

    // Component
    if (typeof type === "function") {
      return renderComponent(vnode, parentContext);
    }

    // Element
    if (typeof type === "string") {
      return renderElement(vnode, parentContext);
    }

    throw new Error(`Unknown VNode type: ${String(type)}`);
  }

  /**
   * Render a text node
   */
  function renderTextNode(vnode: VNode): RenderedNode<TNode> {
    const text = vnode.props?.nodeValue || "";
    const node = strategy.createTextNode(text);

    return {
      vnode,
      node,
      subscriptions: [],
      children: [],
    };
  }

  /**
   * Render a signal VNode
   */
  function renderSignalNode(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    const signal = vnode.props?.signal;
    // Use captured context if available (for async components), otherwise parent context
    const contextForSignal = vnode.props?.context || parentContext;

    if (!isSignal(signal)) {
      throw new Error("Signal VNode must have a signal prop");
    }

    // Create a comment node as a marker to track the signal's position in the DOM
    // This is necessary because signal content might be a Fragment (no direct node)
    // or might be empty initially
    const marker = strategy.createComment("signal");

    // Get initial value and render it
    const initialValue = signal.value;
    let currentRendered = renderValueToNode(initialValue, contextForSignal);
    let previousValue: unknown = initialValue;

    const subscriptions: Array<() => void> = [];

    // Subscribe to signal changes
    const unsubscribe = signal.subscribe((value) => {
      // Fast path: array append detection
      if (
        Array.isArray(value) &&
        Array.isArray(previousValue) &&
        value.length > previousValue.length
      ) {
        const oldLen = (previousValue as unknown[]).length;
        let isAppend = true;
        for (let i = 0; i < oldLen; i++) {
          if (value[i] !== (previousValue as unknown[])[i]) {
            isAppend = false;
            break;
          }
        }

        if (isAppend) {
          const newItems = value.slice(oldLen).filter(isVNode);
          if (newItems.length > 0) {
            const appendFragment: VNode = {
              type: Fragment,
              props: {},
              children: newItems,
            };
            const appendRendered = renderNode(appendFragment, contextForSignal);
            const appendNodes = collectNodes(appendRendered);

            const parent = strategy.getParent(marker);
            if (parent) {
              // Insert after last existing content node (or after marker if none)
              const existingNodes = collectNodes(currentRendered);
              const lastNode =
                existingNodes.length > 0 ? existingNodes[existingNodes.length - 1] : marker;
              let insertRef = strategy.getNextSibling(lastNode!);

              for (const node of appendNodes) {
                strategy.insertBefore(parent, node, insertRef);
                insertRef = strategy.getNextSibling(node);
              }

              // Extend currentRendered's children so future unmount/collectNodes works
              currentRendered.children.push(...appendRendered.children);
              // Also extend subscriptions
              currentRendered.subscriptions.push(...appendRendered.subscriptions);
            }
          }
          previousValue = value;
          return; // Skip full re-render
        }
      }

      // Slow path: full replacement (existing code unchanged)
      previousValue = value;
      const newRendered = renderValueToNode(value, contextForSignal);

      // Collect actual DOM nodes from old and new rendered trees
      const oldContentNodes = collectNodes(currentRendered);
      const newContentNodes = collectNodes(newRendered);

      // Get the parent from the marker
      const parent = strategy.getParent(marker);
      if (!parent) {
        console.warn("[Signal] Marker not in DOM, cannot update");
        return;
      }

      // Remove all old content nodes
      for (const node of oldContentNodes) {
        strategy.removeChild(node);
      }

      // Insert new content nodes after the marker
      let insertAfter = strategy.getNextSibling(marker);
      for (const node of newContentNodes) {
        strategy.insertBefore(parent, node, insertAfter);
        // Update insertAfter to maintain order (insert at the position after the last inserted)
        insertAfter = strategy.getNextSibling(node);
      }

      // Unmount old rendered tree: cleans up subscriptions AND removes
      // portal children from their containers (cleanupSubscriptions alone
      // would leave portal content orphaned in the portal container)
      unmount(currentRendered);

      currentRendered = newRendered;
    });

    subscriptions.push(unsubscribe);

    return {
      vnode,
      node: marker,
      subscriptions,
      children: currentRendered ? [currentRendered] : [],
    };
  }

  /**
   * Helper to convert a signal value to a rendered node
   */
  function renderValueToNode(value: unknown, context: ContextMap): RenderedNode<TNode> {
    let newVNode: VNode;

    // Convert value to VNode
    if (isVNode(value)) {
      newVNode = value;
    } else if (Array.isArray(value)) {
      // Support arrays - wrap in Fragment automatically
      // This allows: computed(todos, list => list.map(...))
      // Without requiring manual Fragment wrapping
      newVNode = {
        type: Fragment,
        props: {},
        children: value.filter(isVNode), // Filter out non-VNodes
      };
    } else if (typeof value === "string" || typeof value === "number") {
      newVNode = {
        type: "#text",
        props: { nodeValue: String(value) },
        children: [],
      };
    } else if (value == null || typeof value === "boolean") {
      // Render empty text for null/undefined/boolean
      // This works for both DOM and terminal
      newVNode = {
        type: "#text",
        props: { nodeValue: "" },
        children: [],
      };
    } else {
      throw new Error(`Invalid signal value type: ${typeof value}`);
    }

    return renderNode(newVNode, context);
  }

  /**
   * Render a fragment
   */
  function renderFragment(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    const children = vnode.children.map((child) => renderNode(child, parentContext));

    // Fragment has no node of its own
    return {
      vnode,
      node: null,
      subscriptions: [],
      children,
    };
  }

  /**
   * Render a portal
   * Portal renders its children into a different container
   */
  function renderPortal(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    const container = vnode.props?.container;

    if (!container) {
      throw new Error("Portal must have a container prop");
    }

    // Render children with same context
    const children = vnode.children.map((child) => renderNode(child, parentContext));

    // Append all child nodes to the portal container (recursively handles fragments)
    for (const child of children) {
      const nodes = collectNodes(child);
      for (const node of nodes) {
        strategy.appendChild(container, node);
      }
    }

    // Portal has no node in the parent tree
    return {
      vnode,
      node: null,
      subscriptions: [],
      children,
    };
  }

  /**
   * Merge Forward's props into the child's props
   * - class/className: concatenated (array)
   * - style: merged objects (Forward overrides per-property)
   * - on* events: chained (both handlers run)
   * - other props: Forward overrides child
   */
  function mergeForwardProps(
    childProps: Record<string, any>,
    forwardProps: Record<string, any>,
  ): Record<string, any> {
    const merged = { ...childProps };

    for (const [key, value] of Object.entries(forwardProps)) {
      if (key === "key" || key === "children") continue;

      if ((key === "class" || key === "className") && merged[key] != null) {
        // Concatenate class values as array — renderers resolve arrays
        merged[key] = [merged[key], value];
      } else if (key === "style" && typeof merged[key] === "object" && typeof value === "object") {
        // Merge style objects (Forward properties override)
        merged[key] = { ...merged[key], ...value };
      } else if (
        key.startsWith("on") &&
        typeof value === "function" &&
        typeof merged[key] === "function"
      ) {
        // Chain event handlers: Forward's runs first, then child's
        const existing = merged[key];
        merged[key] = (...args: unknown[]) => {
          value(...args);
          existing(...args);
        };
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Render a Forward node
   * Forward merges its props onto its single child and renders it directly
   */
  function renderForward(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    const child = vnode.children[0];

    if (!child || vnode.children.length !== 1) {
      throw new Error("Forward must have exactly one child element");
    }

    const forwardProps = vnode.props || {};

    // Create a new VNode with merged props
    const mergedChild: VNode = {
      ...child,
      props: mergeForwardProps(child.props || {}, forwardProps),
    };

    // Render the merged child directly — Forward is completely transparent
    return renderNode(mergedChild, parentContext);
  }

  /**
   * Render a native node (pre-created element from external libraries)
   * The element is used directly without creating a new one.
   * Additional props are applied via the strategy's setProperty/setSignalProperty.
   */
  function renderNativeNode(vnode: VNode): RenderedNode<TNode> {
    const nativeNode = vnode.props?.__nativeNode as TNode;

    if (!nativeNode) {
      throw new Error("Native VNode must have an __nativeNode prop");
    }

    const subscriptions: Array<() => void> = [];

    // Apply additional props to the native node
    const props = vnode.props || {};
    for (const [key, value] of Object.entries(props)) {
      if (key === "__nativeNode" || key === "key" || key === "children") continue;

      if (isSignal(value)) {
        const unsub = strategy.setSignalProperty(nativeNode, key, value);
        subscriptions.push(unsub);
      } else {
        strategy.setProperty(nativeNode, key, value);
      }
    }

    return {
      vnode,
      node: nativeNode,
      subscriptions,
      children: [],
    };
  }

  /**
   * Render a component
   */
  function renderComponent(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    if (typeof vnode.type !== "function") {
      throw new Error("Component vnode must have a function type");
    }

    const Component = vnode.type;
    const props = {
      ...vnode.props,
      children: normalizeChildrenProp(vnode.children),
    };

    // Prepare current component's context
    let currentContext = parentContext;

    // Check if this is a Context Provider
    const isContextProvider = (Component as any).__isContextProvider;

    if (isContextProvider) {
      // Context Provider: create new context map with provided values
      currentContext = new Map(parentContext);
      const provide = (props as any).provide;

      if (provide) {
        // Check if it's a single provide [Context, value] or multiple [[Context, value], ...]
        const isSingle = provide.length === 2 && typeof provide[0] === "symbol";

        if (isSingle) {
          // Single: [Context, value]
          const [context, value] = provide;
          currentContext.set(context, value);
        } else {
          // Multiple: [[Context, value], ...]
          for (const [context, value] of provide) {
            currentContext.set(context, value);
          }
        }
      }
    }

    const componentState: ComponentRuntimeState = {
      cleanupCallbacks: [],
      disposed: false,
    };

    // Create ComponentAPI
    const ctx = createComponentAPI(currentContext, componentState);

    const disposeComponent = () => {
      if (componentState.disposed) return;
      componentState.disposed = true;
      const cleanupCallbacks = componentState.cleanupCallbacks.splice(0);
      for (const cleanup of cleanupCallbacks) {
        cleanup();
      }
    };

    // Call component function with props and ctx
    let result;
    try {
      result = Component(props, ctx);
    } catch (err) {
      throw err;
    }

    // Handle async component (Promise<VNode>)
    if (isPromise(result)) {
      const pending: VNode = {
        type: "#text",
        props: { nodeValue: "" },
        children: [],
      };
      const resultSignal = resource(result, pending);
      const signalVNode: VNode = {
        type: "#signal",
        props: { signal: resultSignal, context: currentContext },
        children: [],
      };
      const rendered = renderNode(signalVNode, currentContext);
      return {
        vnode,
        node: rendered.node,
        subscriptions: [disposeComponent],
        children: [rendered],
      };
    }

    // Handle async generator component (AsyncIterableIterator<VNode>)
    if (isAsyncIterator(result)) {
      const pending: VNode = {
        type: "#text",
        props: { nodeValue: "" },
        children: [],
      };
      const resultSignal = stream(result, pending);
      const signalVNode: VNode = {
        type: "#signal",
        props: { signal: resultSignal, context: currentContext },
        children: [],
      };
      const rendered = renderNode(signalVNode, currentContext);
      return {
        vnode,
        node: rendered.node,
        subscriptions: [disposeComponent],
        children: [rendered],
      };
    }

    // Handle signal component (Signal<VNode>)
    if (isSignal(result)) {
      const signalVNode: VNode = {
        type: "#signal",
        props: { signal: result, context: currentContext },
        children: [],
      };
      const rendered = renderNode(signalVNode, currentContext);
      // Return node: null so collectNodes recurses into children and finds the
      // #signal rendered node, which correctly collects marker + content children.
      return {
        vnode,
        node: null,
        subscriptions: [disposeComponent],
        children: [rendered],
      };
    }

    // Handle normal sync component (VNode)
    const componentName = Component.name || (Component as any).displayName;
    const normalizedResult = normalizeComponentResult(result, componentName);
    const rendered = renderNode(normalizedResult, currentContext);

    return {
      vnode,
      node: rendered.node,
      subscriptions: [disposeComponent],
      children: [rendered],
    };
  }

  /**
   * Render an element
   */
  function renderElement(vnode: VNode, parentContext: ContextMap): RenderedNode<TNode> {
    if (typeof vnode.type !== "string") {
      throw new Error("Element vnode must have a string type");
    }

    const element = strategy.createElement(vnode.type);
    const subscriptions: Array<() => void> = [];

    // Apply props
    const props = vnode.props || {};
    for (const [key, value] of Object.entries(props)) {
      if (key === "key" || key === "children") continue;

      // Handle ref separately
      if (key === "ref") {
        if (strategy.setRef && value != null) {
          const cleanup = strategy.setRef(element, value as Ref<TNode>);
          subscriptions.push(cleanup);
        }
        continue;
      }

      if (isSignal(value)) {
        const unsub = strategy.setSignalProperty(element, key, value);
        subscriptions.push(unsub);
      } else {
        strategy.setProperty(element, key, value);
      }
    }

    // Render children with same context
    const children = vnode.children.map((child) => renderNode(child, parentContext));

    // Append all child nodes (recursively handles fragments and signal wrappers)
    for (const child of children) {
      const nodes = collectNodes(child);
      for (const node of nodes) {
        strategy.appendChild(element, node);
      }
    }

    return {
      vnode,
      node: element,
      subscriptions,
      children,
    };
  }

  /**
   * Unmount a rendered node
   */
  function unmount(node: RenderedNode<TNode>): void {
    // Cleanup subscriptions (error-isolated so one failure doesn't abort the rest)
    for (const unsub of node.subscriptions) {
      try {
        unsub();
      } catch {
        /* cleanup errors must not prevent other cleanups */
      }
    }

    // Recursively unmount children
    for (const child of node.children) {
      unmount(child);
    }

    // Remove from tree
    if (node.node) {
      strategy.removeChild(node.node);
    }
  }

  /**
   * Clean up subscriptions without removing nodes from tree
   */
  function cleanupSubscriptions(node: RenderedNode<TNode>): void {
    // Cleanup subscriptions (error-isolated)
    for (const unsub of node.subscriptions) {
      try {
        unsub();
      } catch {
        /* cleanup errors must not prevent other cleanups */
      }
    }

    // Recursively cleanup children
    for (const child of node.children) {
      cleanupSubscriptions(child);
    }
  }

  return {
    renderNode: renderNode,
    unmount: unmount,
    cleanupSubscriptions: cleanupSubscriptions,
  };
}
