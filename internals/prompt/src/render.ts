/**
 * Render functions for Prompt UI
 *
 * Provides both one-shot and reactive rendering of JSX to plain text.
 */

import type { VNode } from "@semajsx/core";
import { type ContextMap, createRenderer, type RenderStrategy } from "@semajsx/core";
import type { RenderedNode } from "@semajsx/core";
import type { Signal } from "@semajsx/signal";
import type { PromptNode } from "./types";
import {
  createElement,
  createTextNode,
  createComment,
  appendChild,
  removeChild,
  insertBefore,
  replaceNode,
  getParent,
  getNextSibling,
  createRoot,
} from "./operations";
import { setProperty } from "./properties";
import { serialize } from "./serialize";

/**
 * Recursively collect all actual PromptNode instances from a rendered tree.
 * Handles fragments, signal markers, and components that have node=null by walking children.
 */
function collectRenderedNodes(rendered: RenderedNode<PromptNode>): PromptNode[] {
  // Signal marker: include marker node + content children
  if (rendered.vnode.type === "#signal") {
    const nodes: PromptNode[] = [];
    if (rendered.node) {
      nodes.push(rendered.node);
    }
    for (const child of rendered.children) {
      nodes.push(...collectRenderedNodes(child));
    }
    return nodes;
  }

  if (rendered.node) {
    return [rendered.node];
  }
  const nodes: PromptNode[] = [];
  for (const child of rendered.children) {
    nodes.push(...collectRenderedNodes(child));
  }
  return nodes;
}

/**
 * Set of active change notification callbacks.
 * Each reactive render instance registers its own scheduleFlush here.
 * When any signal or tree mutation occurs, all active renders are notified
 * so each can re-serialize its own root and check for changes.
 */
const changeCallbacks = new Set<() => void>();

function notifyChange(): void {
  for (const cb of changeCallbacks) {
    cb();
  }
}

/**
 * Signal-aware property setter that notifies the active render of changes.
 */
function setSignalPropertyWithNotify<T = unknown>(
  node: PromptNode,
  key: string,
  signal: Signal<T>,
): () => void {
  // Set initial value
  setProperty(node, key, signal.value);

  // Subscribe to changes - call setProperty AND notify
  return signal.subscribe((value: T) => {
    setProperty(node, key, value);
    notifyChange();
  });
}

/**
 * Prompt UI render strategy for core's createRenderer
 *
 * Tree-mutating operations (insertBefore, appendChild, removeChild, replaceNode)
 * are wrapped to notify the active render of changes. This catches both:
 * - Signal prop changes (via setSignalPropertyWithNotify)
 * - Signal child changes (via core's #signal VNode handling which mutates the tree)
 */
const promptStrategy: RenderStrategy<PromptNode> = {
  createTextNode,
  createComment,
  createElement,
  getParent,
  getNextSibling,
  insertBefore(parent, newNode, beforeNode) {
    insertBefore(parent, newNode, beforeNode);
    notifyChange();
  },
  appendChild(parent, child) {
    appendChild(parent, child);
    notifyChange();
  },
  removeChild(node) {
    removeChild(node);
    notifyChange();
  },
  replaceNode(oldNode, newNode) {
    replaceNode(oldNode, newNode);
    notifyChange();
  },
  setProperty,
  setSignalProperty: setSignalPropertyWithNotify,
};

// Create the renderer using core's createRenderer
const { renderNode, cleanupSubscriptions } = createRenderer(promptStrategy);

/**
 * Result of a reactive render
 */
export interface RenderResult {
  /**
   * Get the current rendered text
   */
  toString(): string;

  /**
   * Wait for pending reactive updates to settle, then return the rendered text.
   */
  toStringAsync(): Promise<string>;

  /**
   * Subscribe to re-renders. Callback is invoked whenever
   * signal changes cause the tree to update.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (text: string) => void): () => void;

  /**
   * Trigger a manual re-serialization and notify subscribers
   */
  refresh(): void;

  /**
   * Unmount the tree and clean up all subscriptions
   */
  unmount(): void;
}

/**
 * Render a VNode tree to a reactive text output.
 *
 * The returned RenderResult tracks signal changes and re-serializes
 * the tree automatically. Use .toString() to get the current text,
 * or .subscribe() to be notified of updates.
 *
 * @example
 * const count = signal(0);
 * const result = render(
 *   <section title="STATUS">
 *     <line>Count: {count}</line>
 *   </section>
 * );
 *
 * result.subscribe((text) => {
 *   // Called whenever count changes
 *   sendToLLM(text);
 * });
 *
 * count.value = 1; // triggers re-render
 */
export function render(element: VNode): RenderResult {
  const root = createRoot();
  const initialContext: ContextMap = new Map();
  const rendered = renderNode(element, initialContext);

  const nodes = collectRenderedNodes(rendered);
  for (const node of nodes) {
    appendChild(root, node);
  }

  let currentText = serialize(root);
  const listeners = new Set<(text: string) => void>();
  let disposed = false;
  let dirty = false;
  let flushScheduled = false;
  let settleResolvers: Array<(text: string) => void> = [];

  function resolveSettled(): void {
    if (settleResolvers.length === 0) return;
    const resolvers = settleResolvers;
    settleResolvers = [];
    for (const resolve of resolvers) {
      resolve(currentText);
    }
  }

  function flush(): void {
    flushScheduled = false;
    if (disposed) return;
    if (!dirty) {
      resolveSettled();
      return;
    }

    dirty = false;
    const newText = serialize(root);
    if (newText !== currentText) {
      currentText = newText;
      for (const listener of listeners) {
        listener(currentText);
      }
    }
    resolveSettled();
  }

  function scheduleFlush(): void {
    if (disposed) return;
    dirty = true;
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 0);
    }
  }

  // Register this instance's change notification
  changeCallbacks.add(scheduleFlush);

  return {
    toString() {
      if (dirty && !disposed) {
        currentText = serialize(root);
        dirty = false;
      }
      return currentText;
    },

    async toStringAsync() {
      if (disposed) return currentText;

      // Give signal/computed microtasks a chance to mark this render dirty
      // and schedule a commit before deciding whether we can return immediately.
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!dirty && !flushScheduled) {
        return this.toString();
      }

      return new Promise((resolve) => {
        settleResolvers.push(resolve);
      });
    },

    subscribe(callback: (text: string) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    refresh() {
      const newText = serialize(root);
      dirty = false;
      if (newText !== currentText) {
        currentText = newText;
        for (const listener of listeners) {
          listener(currentText);
        }
      }
      resolveSettled();
    },

    unmount() {
      disposed = true;
      listeners.clear();
      changeCallbacks.delete(scheduleFlush);
      resolveSettled();
      cleanupSubscriptions(rendered);
    },
  };
}

/**
 * Render a VNode tree to a string (one-shot, no reactivity).
 *
 * This is the simplest API for static prompt generation.
 * Signals are read for their current value but not subscribed to.
 *
 * @example
 * const text = renderToString(
 *   <section title="ROLE">
 *     <line>Support Agent</line>
 *   </section>
 * );
 * // => "[ROLE]\nSupport Agent"
 */
export function renderToString(element: VNode): string {
  const root = createRoot();
  const initialContext: ContextMap = new Map();
  const rendered = renderNode(element, initialContext);

  const nodes = collectRenderedNodes(rendered);
  for (const node of nodes) {
    appendChild(root, node);
  }

  const text = serialize(root);

  // Clean up subscriptions (signals read once, not tracked)
  cleanupSubscriptions(rendered);

  return text;
}
