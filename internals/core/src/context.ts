/**
 * Context API implementation
 */

import { h } from "./vnode";
import { Fragment } from "./types";
import type { ComponentAPI, Context as ContextType, ContextProps, VNode } from "./types";

// Context map type - stores context values for current render environment
export type ContextMap = Map<symbol, any>;

export interface ComponentRuntimeState {
  cleanupCallbacks: Array<() => void>;
  disposed: boolean;
}

/**
 * Create a new Context (returns a typed Symbol)
 *
 * @param name - Optional name for debugging (defaults to "anonymous")
 * @returns Context symbol
 *
 * @example
 * ```typescript
 * const ThemeContext = context<Theme>();
 * const UserContext = context<User>('user'); // With debug name
 *
 * <Context provide={[ThemeContext, theme]}>
 *   <App />
 * </Context>
 * ```
 */
export function context<T>(name?: string): ContextType<T> {
  const debugName = name || "anonymous";
  return Symbol(debugName) as ContextType<T>;
}

/**
 * Context component - provides context values to child components
 *
 * @example
 * ```typescript
 * // Single context
 * <Context provide={[ThemeContext, theme]}>
 *   <App />
 * </Context>
 *
 * // Multiple contexts
 * <Context provide={[
 *   [ThemeContext, theme],
 *   [UserContext, user]
 * ]}>
 *   <App />
 * </Context>
 * ```
 */
export function Context(props: ContextProps): VNode {
  const children = props.children
    ? Array.isArray(props.children)
      ? props.children
      : [props.children]
    : [];
  return h(Fragment, null, ...children);
}

// Mark as special context provider component
(Context as any).__isContextProvider = true;

/**
 * Create ComponentAPI instance for a component
 *
 * @param contextMap - The context map for current render environment
 * @returns ComponentAPI instance
 */
export function createComponentAPI(
  contextMap: ContextMap,
  runtimeState: ComponentRuntimeState = { cleanupCallbacks: [], disposed: false },
): ComponentAPI {
  return {
    inject<T>(context: ContextType<T>): T | undefined {
      return contextMap.get(context);
    },
    isDisposed(): boolean {
      return runtimeState.disposed;
    },
    onCleanup(fn: () => void): void {
      if (runtimeState.disposed) {
        fn();
        return;
      }
      runtimeState.cleanupCallbacks.push(fn);
    },
  };
}
