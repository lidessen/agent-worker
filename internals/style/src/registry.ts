/**
 * StyleRegistry - Core class that manages all style state
 *
 * Can be used directly in vanilla JS or wrapped by framework integrations
 */

import type { ReadableSignal } from "@semajsx/signal";
import { injectStyles } from "./inject";
import { isStyleToken } from "./rule";
import { uniqueId } from "./hash";
import type { RegistryOptions, StyleToken } from "./types";

/**
 * StyleRegistry - Manages all style-related state and side effects
 *
 * Responsibilities:
 * 1. Signal → CSS variable name mapping (scoped to this registry)
 * 2. CSS injection deduplication
 * 3. Signal subscriptions and cleanup
 */
export class StyleRegistry {
  /** Signal → CSS variable name mapping */
  private signalVars = new WeakMap<ReadableSignal<unknown>, string>();

  /** Already injected classNames (for deduplication) */
  private injectedClasses = new Set<string>();

  /** Active subscriptions (for cleanup) */
  private subscriptions = new Set<() => void>();

  /** Track which signals have been subscribed to prevent duplicates */
  private subscribedSignals = new WeakSet<ReadableSignal<unknown>>();

  /** Injection target */
  private target: Element | ShadowRoot;

  /** Element for CSS variable values (optional, for reactive styles) */
  private anchorElement: HTMLElement | null = null;

  constructor(options: RegistryOptions = {}) {
    this.target = options.target ?? document.head;
  }

  /**
   * Set anchor element for CSS variable values
   *
   * The anchor element is where CSS variables are set when signals change.
   * CSS variables cascade to descendants via CSS inheritance.
   */
  setAnchorElement(element: HTMLElement): void {
    this.anchorElement = element;
  }

  /**
   * Get or create a CSS variable name for a signal
   */
  private getSignalVarName(signal: ReadableSignal<unknown>): string {
    let varName = this.signalVars.get(signal);
    if (!varName) {
      varName = `--sig-${uniqueId()}`;
      this.signalVars.set(signal, varName);
    }
    return varName;
  }

  /**
   * Process a token: generate CSS, inject, set up signal bindings
   *
   * @returns The className for the token (or empty string if none)
   */
  processToken(token: StyleToken): string {
    // 1. Generate final CSS with var() references
    let css = token.__cssTemplate;
    const bindings: Array<{ signal: ReadableSignal<unknown>; varName: string }> = [];

    if (token.__bindingDefs) {
      for (const def of token.__bindingDefs) {
        const varName = this.getSignalVarName(def.signal);
        css = css.replaceAll(`{{${def.index}}}`, `var(${varName})`);
        bindings.push({ signal: def.signal, varName });
      }
    }

    // 2. Inject CSS if className not already injected
    const className = token._;
    if (className && !this.injectedClasses.has(className)) {
      injectStyles(css, this.target);
      this.injectedClasses.add(className);
    } else if (!className) {
      // For rules without className (combined rules, pseudo-selectors)
      // Use CSS content as dedup key
      const cssKey = css;
      if (!this.injectedClasses.has(cssKey)) {
        injectStyles(css, this.target);
        this.injectedClasses.add(cssKey);
      }
    }

    // 3. Set up signal subscriptions on the anchor element
    if (this.anchorElement && bindings.length > 0) {
      for (const { signal, varName } of bindings) {
        // Always update the current value
        this.anchorElement.style.setProperty(varName, String(signal.value));

        // Only subscribe if not already subscribed (prevents duplicates)
        if (!this.subscribedSignals.has(signal)) {
          this.subscribedSignals.add(signal);
          const unsub = signal.subscribe((newValue: unknown) => {
            this.anchorElement?.style.setProperty(varName, String(newValue));
          });
          this.subscriptions.add(unsub);
        }
      }
    }

    return token._ ?? "";
  }

  /**
   * Inject styles (without processing signal bindings)
   */
  inject(token: StyleToken | StyleToken[] | Record<string, StyleToken>): void {
    let tokenArray: StyleToken[];

    if (isStyleToken(token)) {
      tokenArray = [token];
    } else if (Array.isArray(token)) {
      tokenArray = token;
    } else {
      tokenArray = Object.values(token).filter(isStyleToken);
    }

    for (const t of tokenArray) {
      this.processToken(t);
    }
  }

  /**
   * Clear all injected styles and subscriptions
   */
  clear(): void {
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions.clear();
    this.injectedClasses.clear();
  }

  /**
   * Dispose the registry (cleanup all subscriptions)
   */
  dispose(): void {
    this.clear();
  }
}

/**
 * Create a style registry
 *
 * @example
 * ```ts
 * const registry = createRegistry({
 *   target: document.head,
 *   dedupe: true,
 * });
 *
 * registry.inject(button);
 * registry.inject(card);
 * registry.clear();
 * ```
 */
export function createRegistry(options?: RegistryOptions): StyleRegistry {
  return new StyleRegistry(options);
}

/**
 * Create a cx() function bound to a registry
 *
 * The cx() function accepts StyleTokens, strings, and falsy values,
 * processes them, and returns a combined className string.
 *
 * @example
 * ```ts
 * const registry = createRegistry();
 * const cx = createCx(registry);
 *
 * const className = cx(button.root, isLarge && button.large, "custom-class");
 * ```
 */
export function createCx(
  registry: StyleRegistry,
): (...args: (StyleToken | string | false | null | undefined)[]) => string {
  return (...args) => {
    const classes: string[] = [];

    for (const arg of args) {
      if (!arg) continue;

      if (isStyleToken(arg)) {
        const className = registry.processToken(arg);
        if (className) classes.push(className);
      } else {
        classes.push(arg);
      }
    }

    return classes.join(" ");
  };
}
