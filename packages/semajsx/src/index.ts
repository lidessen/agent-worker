/**
 * SemaJSX - A signal-based reactive JSX runtime
 */

// Signal exports (includes signal types with convenience methods)
export * from "./signal";

// Core exports (excluding signal types to avoid conflicts)
export {
  createFragment,
  createTextVNode,
  h,
  isVNode,
  Forward,
  Fragment,
  Portal,
  ISLAND_MARKER,
  Context,
  context,
  createComponentAPI,
  resource,
  stream,
  when,
  jsx,
  jsxs,
  createRenderer,
  isAsyncIterator,
  isPromise,
} from "@semajsx/core";

export type {
  Component,
  ComponentAPI,
  RuntimeComponent,
  ContextType,
  ContextMap,
  ContextProps,
  ContextProvide,
  JSXNode,
  Ref,
  VNode,
  WithKey,
  WithSignals,
  RenderedNode,
  RenderStrategy,
} from "@semajsx/core";
