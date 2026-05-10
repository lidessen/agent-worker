/**
 * CSS injection utilities for @semajsx/style
 *
 * Uses a single shared <style> element per injection target to batch CSS rules.
 * This avoids N separate <style> createElement + appendChild calls that each
 * trigger a full CSSOM rebuild (especially costly in Safari).
 *
 * Design:
 * - Each injection target (document.head, shadow root, etc.) gets one StyleInjector
 * - StyleInjector manages a single <style> element and tracks which rules are in it
 * - Injection is synchronous — CSS is immediately readable after inject()
 * - cleanup() removes the specific rules that were injected, not the shared element
 * - If the <style> element is removed externally (HMR, teardown), it's recreated
 */

import { isStyleToken } from "./rule";
import type { InjectOptions, StyleToken } from "./types";

/**
 * Per-target style injector.
 *
 * Manages a single <style> element for a given DOM container,
 * batching all CSS rules into it. Tracks individual rules for cleanup.
 */
class StyleInjector {
  private container: Node;
  private styleEl: HTMLStyleElement | null = null;
  private rules: string[] = [];
  /** Reference count per dedup key. Rule is only removed when count reaches 0. */
  private refCounts = new Map<string, number>();
  /** Maps dedup key → rule index in this.rules */
  private keyToIndex = new Map<string, number>();

  constructor(container: Node) {
    this.container = container;
  }

  /** Ensure the <style> element exists and is attached to the container */
  private ensureStyleElement(): HTMLStyleElement {
    // Check if element was removed externally (HMR, teardown, test cleanup)
    if (this.styleEl && !this.styleEl.parentNode) {
      this.styleEl = null;
    }
    if (!this.styleEl) {
      this.styleEl = document.createElement("style");
      this.styleEl.setAttribute("data-semajsx", "");
      this.container.appendChild(this.styleEl);
      // Restore existing rules if element was recreated
      if (this.rules.length > 0) {
        this.styleEl.textContent = this.rules.join("\n");
      }
    }
    return this.styleEl;
  }

  /**
   * Append a CSS rule. Synchronous — immediately readable.
   * Returns the index of the rule for later removal.
   */
  appendRule(css: string): number {
    const index = this.rules.length;
    this.rules.push(css);
    // Rebuild textContent from all rules — single write
    this.ensureStyleElement().textContent = this.rules.join("\n");
    return index;
  }

  /**
   * Remove rules by indices. Rebuilds the <style> content.
   */
  removeRules(indices: number[]): void {
    // Mark removed rules as empty
    for (const i of indices) {
      if (i >= 0 && i < this.rules.length) {
        this.rules[i] = "";
      }
    }
    // Compact: remove trailing empty strings
    while (this.rules.length > 0 && this.rules[this.rules.length - 1] === "") {
      this.rules.pop();
    }
    // Rebuild
    if (this.styleEl && this.styleEl.parentNode) {
      const content = this.rules.join("\n");
      this.styleEl.textContent = content;
      // If all rules removed, detach the element
      if (this.rules.every((r) => r === "")) {
        this.styleEl.remove();
        this.styleEl = null;
        this.rules = [];
      }
    }
  }

  /** Check if a key has already been injected (dedup) */
  hasKey(key: string): boolean {
    return this.refCounts.has(key);
  }

  /** Increment reference count for a key. Returns the rule index. */
  addRef(key: string, ruleIndex: number): void {
    const count = this.refCounts.get(key) ?? 0;
    this.refCounts.set(key, count + 1);
    if (!this.keyToIndex.has(key)) {
      this.keyToIndex.set(key, ruleIndex);
    }
  }

  /**
   * Decrement reference count for a key.
   * Returns the rule index to remove if count reaches 0, or -1 if still referenced.
   */
  releaseRef(key: string): number {
    const count = this.refCounts.get(key) ?? 0;
    if (count <= 1) {
      this.refCounts.delete(key);
      const index = this.keyToIndex.get(key) ?? -1;
      this.keyToIndex.delete(key);
      return index;
    }
    this.refCounts.set(key, count - 1);
    return -1; // still referenced, don't remove
  }
}

/**
 * Cache of StyleInjector instances per container.
 * WeakMap allows GC when containers are removed.
 */
const injectors = new WeakMap<Node, StyleInjector>();

function getInjector(container: Node): StyleInjector {
  let injector = injectors.get(container);
  if (!injector) {
    injector = new StyleInjector(container);
    injectors.set(container, injector);
  }
  return injector;
}

/**
 * Resolve a target to its style container node.
 */
function resolveTarget(target?: Element | ShadowRoot | Document | null): Node {
  if (!target) return document.head;
  if (target === document) return document.head;
  if (target instanceof HTMLIFrameElement && target.contentDocument) {
    return target.contentDocument.head;
  }
  return target;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Inject CSS into a target element.
 *
 * CSS is written synchronously and is immediately readable.
 * Uses a shared <style> element per target for performance.
 *
 * @param css - The CSS string to inject
 * @param target - The target element (defaults to document.head)
 * @returns The <style> element containing the CSS
 */
export function injectStyles(css: string, target?: Element | ShadowRoot): HTMLStyleElement {
  const container = resolveTarget(target);
  const injector = getInjector(container);
  injector.appendRule(css);
  return injector["ensureStyleElement"]();
}

/**
 * Inject a StyleToken into the DOM.
 *
 * Deduplicates by className — if the same token has been injected
 * to the same target, it won't be injected again.
 */
function injectToken(token: StyleToken, container: Node, ruleIndices: number[]): void {
  const injector = getInjector(container);
  const key = token._ ?? token.__cssTemplate;

  if (!injector.hasKey(key)) {
    // First time this key is injected — append the CSS rule
    let css = token.__cssTemplate;
    if (token.__bindingDefs) {
      for (const def of token.__bindingDefs) {
        css = css.replaceAll(`{{${def.index}}}`, `var(--style-${def.index})`);
      }
    }
    const index = injector.appendRule(css);
    ruleIndices.push(index);
    injector.addRef(key, index);
  } else {
    // Already injected — just bump the reference count
    injector.addRef(key, -1);
  }
}

/**
 * Inject styles into the DOM.
 *
 * Supports single token, array of tokens, or object containing tokens.
 * Returns a cleanup function that removes the injected rules.
 *
 * @example
 * ```ts
 * // Single token
 * const cleanup = inject(button.root);
 *
 * // Array of tokens
 * inject([button.root, button.icon]);
 *
 * // Object — extracts all StyleTokens
 * inject(button);
 *
 * // With target (shadow DOM, iframe)
 * inject(button, { target: shadowRoot });
 *
 * // Cleanup
 * const cleanup = inject(button);
 * cleanup(); // removes the injected rules
 * ```
 */
export function inject(
  tokens: StyleToken | StyleToken[] | Record<string, StyleToken>,
  options?: InjectOptions,
): () => void {
  const container = resolveTarget(options?.target);
  const injector = getInjector(container);

  let tokenArray: StyleToken[];

  if (isStyleToken(tokens)) {
    tokenArray = [tokens];
  } else if (Array.isArray(tokens)) {
    tokenArray = tokens;
  } else {
    tokenArray = Object.values(tokens).filter(isStyleToken);
  }

  const ruleIndices: number[] = [];
  for (const token of tokenArray) {
    injectToken(token, container, ruleIndices);
  }

  // Return cleanup that decrements ref counts and removes rules only when no longer referenced
  let cleaned = false;
  return () => {
    if (cleaned) return; // idempotent
    cleaned = true;
    const indicesToRemove: number[] = [];
    for (const token of tokenArray) {
      const key = token._ ?? token.__cssTemplate;
      const index = injector.releaseRef(key);
      if (index >= 0) {
        indicesToRemove.push(index);
      }
    }
    if (indicesToRemove.length > 0) {
      injector.removeRules(indicesToRemove);
    }
  };
}

/**
 * Preload styles for better performance.
 *
 * Call at app startup or route entry to batch inject all needed styles
 * before rendering starts.
 *
 * @example
 * ```ts
 * preload(button, card, input);
 * ```
 */
export function preload(
  ...styles: (StyleToken | StyleToken[] | Record<string, StyleToken>)[]
): void {
  for (const style of styles) {
    inject(style);
  }
}
