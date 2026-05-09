# Reactivity & Core Runtime — Design

Companion to [DESIGN.md](./DESIGN.md). Covers `@semajsx/signal` and
`@semajsx/core` — the reactive primitives and the renderer-agnostic
runtime that sits on top of them.

## Shape

```
  @semajsx/signal                  @semajsx/core
  ───────────────                  ─────────────
  signal()                         VNode  ──► h() / jsx()
  computed([deps], fn)             Fragment / Portal / Forward
  batch(fn)                        Context / createComponentAPI
  scheduleUpdate(cb)               when / resource / stream   (async helpers)
  isSignal(v) / unwrap(v)          createRenderer(strategy)   (the seam)
                                   ISLAND_MARKER              (cross-cutting tag)
```

Core imports signal; signal never imports core. Core exports everything
both renderers and ssr need.

## Signals

**Primitives** — `packages/signal/src/`.

- `signal(init)` — writable container with `.value` get/set and `.subscribe(fn)`.
  Object.is equality gate on writes.
- `computed(deps, fn)` — **explicit** dep array (or single dep). Lazy: only
  subscribes to upstream when it has subscribers itself; tears down on last
  unsubscribe. Reads without subscribers compute on demand, uncached.
- `computed([x, y], (x, y) => …)` is the multi-dep overload; arity is
  preserved via TypeScript mapped types.
- `batch(fn)` — collects `scheduleUpdate` callbacks in a Set, flushes on
  batch exit. Nested `batch` is a no-op (outer controls the flush).
- `scheduleUpdate(cb)` — microtask-based when not batching (`queueMicrotask`).

**Why explicit deps** — no active-reader global, no hidden control flow,
no teardown pitfalls when a component's compute function short-circuits
over a signal. Every dep is visible at the call site.

**Why lazy computed** — a computed with no subscribers holds no dep
subscriptions, so it can be declared at module scope or in a component
without leaking. It activates on first subscribe, deactivates on last.

## VNode and special types

VNode shape — `packages/core/src/types.ts`:

```ts
{ type: VNodeType, props: Record<string,any> | null, children: VNode[], key? }
```

`VNodeType` is a string (HTML/terminal element), a function (component),
or one of three symbols:

- **`Fragment`** — no own node; its rendered children are spliced into
  the parent's child list via `collectNodes()`.
- **`Portal`** — renders children into `props.container` (a target node
  the renderer understands); absent from the host tree.
- **`Forward`** — transparent wrapper that merges its props onto the
  single child before rendering. `class` / `className` arrays concat,
  `style` objects merge, event handlers chain, others override.

**`ISLAND_MARKER`** (`packages/core/src/shared/island-marker.ts`) is a
shared `Symbol` stamped by `@semajsx/ssr` onto a VNode to mark it as an
island boundary. Core exports it so ssr, the string renderer, the client
hydrator, and build-time collectors all detect islands the same way
without a dedicated type. See [DESIGN-rendering.md](./DESIGN-rendering.md)
for how islands flow through render.

## Components and lifecycle

A component is `(props, ctx?) => JSXNode | Promise<JSXNode> | AsyncIterable<JSXNode>`.
When a component is rendered, core calls `createComponentAPI(contextMap)`
and passes the result as `ctx`:

- `ctx.inject(Context)` — look up a provided value, walking outward.
- `ctx.onCleanup(fn)` — register a teardown callback run at unmount.
  If the component is already disposed (re-entrancy), `fn` runs immediately.
- `ctx.isDisposed()` — check disposal (useful in async closures).

`ComponentRuntimeState` (`{ cleanupCallbacks, disposed }`) is attached to
each rendered component node's `subscriptions` so unmount flushes
registered cleanups along with signal unsubscribes.

**Context** — `context<T>(name?)` returns a typed `Symbol`. The `Context`
component (marked with `__isContextProvider`) merges its `provide` pairs
into the child `ContextMap` — a `Map<symbol, any>` threaded through
`renderNode` as `parentContext`. `ctx.inject` is a map lookup.

## Async as signals

`helpers.ts` exposes three utilities that turn async shapes into signals,
so core's signal-update path handles them uniformly:

- `when(condSignal, content)` → `computed` that returns `content` when
  the condition signal is true, `null` otherwise. `content` can be a
  thunk for lazy evaluation.
- `resource(promise, pending?)` → `signal` that starts at `pending` and
  flips to the resolved value once. Errors are the promise's
  responsibility (`.catch(…)`).
- `stream(asyncIter, pending?)` → `signal` that sets to each yielded
  value in order. Errors surface via `console.error`; they're not a
  separate channel.

Render-core (`packages/core/src/render-core.ts`) also detects when a
**component** returns a Promise or AsyncIterable directly, wraps it via
`resource` / `stream`, and inserts the resulting signal VNode. So async
components "just work" without the component author reaching for the
helpers.

## Signal-driven dynamic regions

A signal-valued child becomes an **`#signal` VNode** at render time. The
renderer emits a comment marker node and, on each signal update,
replaces the region after the marker with the new rendered content.
Specifics in [DESIGN-rendering.md](./DESIGN-rendering.md#signal-regions-and-fast-paths).

From the core perspective, the key guarantee is that **updates are
point-to-point**: each signal subscription is attached to a specific
`RenderedNode.subscriptions` entry, and core never walks a tree to find
what changed. On unmount, every subscription (signal, ref, component
cleanup) is flushed in a single pass.

## Constraints

- Signals must be treated as immutable on the outside — write via `.set()`
  or `.value = …`, never mutate an object a signal holds. The Object.is
  gate will otherwise miss the change.
- Component functions must be synchronous _at the top level_. Return a
  Promise or AsyncIterable if you need async — don't `await` before the
  return.
- `onCleanup` is the only way to tie resource lifetime to component
  lifetime. Raw `setInterval` or subscriptions outside `onCleanup` leak.
- `computed` deps are fixed at creation. A computed over a variable set
  of signals needs a recomputed wrapper or a `signal`-of-signal indirection.

## Non-goals

- No auto-tracking of reads. If you need dynamic dependency shapes,
  compose signals explicitly.
- No effect primitive (`effect(fn)`) at the core level — component
  render is the effect boundary. Use `onCleanup` for side effects.
- No time-travel or history on signals. Writes overwrite.
- No signal serialization for SSR hydration. Islands re-construct
  signals on the client side from serialized props.
