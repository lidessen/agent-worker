/**
 * Runtime exports - shared across DOM and Terminal
 */

export { createFragment, createTextVNode, h, isVNode } from "./vnode";
export { Forward, Fragment, Portal } from "./types";
export { ISLAND_MARKER } from "./shared/island-marker";
export {
  Context,
  context,
  createComponentAPI,
  type ComponentRuntimeState,
  type ContextMap,
} from "./context";
export { resource, stream, when } from "./helpers";
export { jsx, jsxs } from "./jsx";
export { createRenderer, isAsyncIterator, isPromise } from "./render-core";

export type {
  Component,
  ComponentAPI,
  RuntimeComponent,
  Context as ContextType,
  ContextProps,
  ContextProvide,
  JSXNode,
  Ref,
  SignalOr,
  VNode,
  WithKey,
  WithSignals,
} from "./types";

export type { RenderedNode, RenderStrategy } from "./render-core";

// Signal interfaces - core reactive primitives
export type { MaybeSignal, ReadableSignal, Signal, SignalValue, WritableSignal } from "./signal";
