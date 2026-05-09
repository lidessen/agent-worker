/**
 * React integration for @semajsx/style
 *
 * Provides StyleAnchor component and useStyle hook for seamless
 * integration with React applications.
 *
 * @example
 * ```tsx
 * import { StyleAnchor, useStyle } from "@semajsx/style/react";
 * import * as button from "./button.style";
 *
 * function App() {
 *   return (
 *     <StyleAnchor>
 *       <Button />
 *     </StyleAnchor>
 *   );
 * }
 *
 * function Button({ large, primary }) {
 *   const cx = useStyle();
 *
 *   return (
 *     <button className={cx(button.root, large && button.large, primary && button.primary)}>
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  createElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { signal as createSignal, type Signal } from "@semajsx/signal";
import { isStyleToken, injectStyles, uniqueId, type StyleToken } from "./index";

/**
 * Registry managed by each StyleAnchor instance
 */
interface StyleAnchorRegistry {
  /** Signal → CSS variable name (unique within this anchor) */
  signalVars: WeakMap<Signal<unknown>, string>;
  /** Already injected classNames (for deduplication) */
  injectedClasses: Set<string>;
  /** Process a token: assign var names, inject CSS, set up subscriptions */
  processToken: (token: StyleToken) => string;
  /** Add subscription for cleanup */
  addSubscription: (unsub: () => void) => void;
}

const StyleAnchorContext = createContext<StyleAnchorRegistry | null>(null);

/**
 * Argument type for cx() function
 */
type CxArg = StyleToken | string | false | null | undefined;

/**
 * Hook to get the cx() function for combining class names
 *
 * The cx() function accepts StyleTokens, strings, and falsy values,
 * processes them, and returns a combined className string.
 *
 * @example
 * ```tsx
 * function Button({ large, primary }) {
 *   const cx = useStyle();
 *
 *   return (
 *     <button className={cx(
 *       button.root,
 *       large && button.large,
 *       primary && button.primary,
 *       "custom-class"
 *     )}>
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */
export function useStyle(): (...args: CxArg[]) => string {
  const registry = useContext(StyleAnchorContext);

  const cx = useCallback(
    (...args: CxArg[]): string => {
      const classes: string[] = [];

      for (const arg of args) {
        if (!arg) continue;

        if (isStyleToken(arg)) {
          // Registry handles all side effects
          if (registry) {
            const className = registry.processToken(arg);
            if (className) classes.push(className);
          } else {
            // No registry, just use the className if available
            if (arg._) classes.push(arg._);
          }
        } else {
          classes.push(arg);
        }
      }

      return classes.join(" ");
    },
    [registry],
  );

  return cx;
}

/**
 * Props for StyleAnchor component
 */
export interface StyleAnchorProps {
  /** Target for style injection (defaults to document.head) */
  target?: Element | ShadowRoot;
  /** Children to render */
  children: ReactNode;
}

/**
 * StyleAnchor - Manages all style-related state and side effects
 *
 * Responsibilities:
 * 1. Signal → CSS variable name mapping (scoped to this anchor)
 * 2. CSS injection deduplication
 * 3. Signal subscriptions and cleanup
 *
 * @example
 * ```tsx
 * // Basic usage
 * function App() {
 *   return (
 *     <StyleAnchor>
 *       <MyApp />
 *     </StyleAnchor>
 *   );
 * }
 *
 * // For Shadow DOM
 * function WebComponent() {
 *   const shadowRef = useRef<ShadowRoot>(null);
 *
 *   return (
 *     <StyleAnchor target={shadowRef.current}>
 *       <Content />
 *     </StyleAnchor>
 *   );
 * }
 * ```
 */
export function StyleAnchor({ target, children }: StyleAnchorProps): ReactElement {
  const elementRef = useRef<HTMLDivElement>(null);
  const subscriptionsRef = useRef<Set<() => void>>(new Set());
  // Track which signals have been subscribed to prevent duplicates
  const subscribedSignalsRef = useRef<WeakSet<Signal<unknown>>>(new WeakSet());
  // Store pending bindings to apply after mount
  const pendingBindingsRef = useRef<Array<{ signal: Signal<unknown>; varName: string }>>([]);

  // Create registry once per anchor instance
  const registryRef = useRef<StyleAnchorRegistry | null>(null);
  if (!registryRef.current) {
    const signalVars = new WeakMap<Signal<unknown>, string>();
    const injectedClasses = new Set<string>();

    registryRef.current = {
      signalVars,
      injectedClasses,

      processToken(token: StyleToken): string {
        // 1. Generate final CSS by replacing placeholders with var names
        let css = token.__cssTemplate;
        const bindings: Array<{ signal: Signal<unknown>; varName: string }> = [];

        if (token.__bindingDefs) {
          for (const def of token.__bindingDefs) {
            // Get or assign variable name for this signal
            let varName = signalVars.get(def.signal);
            if (!varName) {
              varName = `--sig-${uniqueId()}`;
              signalVars.set(def.signal, varName);
            }
            // Replace placeholder with var()
            css = css.replaceAll(`{{${def.index}}}`, `var(${varName})`);
            bindings.push({ signal: def.signal, varName });
          }
        }

        // 2. Inject CSS if className not already injected
        const className = token._;
        if (className && !injectedClasses.has(className)) {
          const injectionTarget = target ?? document.head;
          injectStyles(css, injectionTarget);
          injectedClasses.add(className);
        } else if (!className) {
          // For rules without className, use CSS content as key
          const cssKey = css;
          if (!injectedClasses.has(cssKey)) {
            const injectionTarget = target ?? document.head;
            injectStyles(css, injectionTarget);
            injectedClasses.add(cssKey);
          }
        }

        // 3. Set up signal subscriptions on the anchor element (or defer if not mounted)
        // Only subscribe to signals we haven't subscribed to yet (prevents duplicates)
        const anchorElement = elementRef.current;
        if (bindings.length > 0) {
          if (anchorElement) {
            // Element is available, apply bindings now
            for (const { signal, varName } of bindings) {
              // Always update the current value
              anchorElement.style.setProperty(varName, String(signal.value));

              // Only subscribe if not already subscribed
              if (!subscribedSignalsRef.current.has(signal)) {
                subscribedSignalsRef.current.add(signal);
                const unsub = signal.subscribe((newValue: unknown) => {
                  anchorElement.style.setProperty(varName, String(newValue));
                });
                subscriptionsRef.current.add(unsub);
              }
            }
          } else {
            // Element not yet available, store for later
            pendingBindingsRef.current.push(...bindings);
          }
        }

        return token._ ?? "";
      },

      addSubscription(unsub: () => void) {
        subscriptionsRef.current.add(unsub);
      },
    };
  }

  // Apply pending bindings after mount
  useEffect(() => {
    const anchorElement = elementRef.current;
    if (anchorElement && pendingBindingsRef.current.length > 0) {
      for (const { signal, varName } of pendingBindingsRef.current) {
        // Always update the current value
        anchorElement.style.setProperty(varName, String(signal.value));

        // Only subscribe if not already subscribed
        if (!subscribedSignalsRef.current.has(signal)) {
          subscribedSignalsRef.current.add(signal);
          const unsub = signal.subscribe((newValue: unknown) => {
            anchorElement.style.setProperty(varName, String(newValue));
          });
          subscriptionsRef.current.add(unsub);
        }
      }
      pendingBindingsRef.current = [];
    }
  });

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsub) => unsub());
      subscriptionsRef.current.clear();
    };
  }, []);

  return createElement(
    StyleAnchorContext.Provider,
    { value: registryRef.current },
    createElement("div", { ref: elementRef, style: { display: "contents" } }, children),
  );
}

/**
 * Create a signal that works with React
 *
 * This is a wrapper around @semajsx/signal that works seamlessly
 * with the StyleAnchor for reactive CSS updates.
 *
 * @example
 * ```tsx
 * function Box() {
 *   const height = useSignal(100);
 *   const cx = useStyle();
 *
 *   return (
 *     <div
 *       className={cx(boxStyle({ height }))}
 *       onClick={() => height.value += 10}
 *     >
 *       Click to grow
 *     </div>
 *   );
 * }
 * ```
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const signalRef = useRef<Signal<T> | null>(null);
  if (!signalRef.current) {
    signalRef.current = createSignal(initialValue);
  }
  return signalRef.current;
}

// Re-export commonly used types
export type { StyleToken, Signal };
