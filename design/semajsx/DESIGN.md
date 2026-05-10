# SemaJSX — Design

> A signal-based reactive JSX runtime with pluggable rendering targets (DOM, Terminal, SSR, SSG).

This is the 30% skeleton — the shape of the system. For deeper detail see
[DESIGN-reactivity.md](./DESIGN-reactivity.md) (signals + core runtime) and
[DESIGN-rendering.md](./DESIGN-rendering.md) (renderers + SSR/SSG).

**L1 (always loaded):** these three `DESIGN*.md` files — the skeleton every
task reads first. **L2 (load on demand):** deeper module-level docs in
[designs/](./designs/) (e.g. signal-interface, context-api, logger-api,
ssr-html-entry-build), plus package READMEs. Formal feature proposals live
in [rfcs/](./rfcs/), immutable architecture decisions in [adrs/](./adrs/),
and fast-loop shape proposals for the design-driven workflow in
[decisions/](./decisions/). Project trajectory: [ROADMAP.md](./ROADMAP.md).

## Architecture

```
                      ┌──────────────────────────────┐
                      │  semajsx (umbrella + CLI)    │  ← the only published package
                      │  re-exports every subpath    │
                      └──────────────┬───────────────┘
                                     │
    ┌───────────┬───────────┬────────┴────────┬──────────┬──────────┐
    │           │           │                 │          │          │
  ssg         ssr       ui/blocks/        terminal      dom     tailwind
    │           │       chat/mermaid/         │          │          │
    │           │       icons/prompt          │          │          │
    └─── core + dom + signal + style ─────────┴──────────┴── style ─┘
                            │
                      ┌─────┴──────┐
                      │   signal   │
                      │   + utils  │
                      └────────────┘
```

Every renderer or higher-level package plugs into **core** via the
`RenderStrategy<TNode>` seam. Core owns VNode, components, context, async,
fragments, portals, and signal binding; renderers own node creation and
platform specifics.

## Modules

**Foundation**

- `@semajsx/utils` — guards, type utilities. Doesn't contain any reactive or rendering logic.
- `@semajsx/signal` — signal / computed / batch / memo. Doesn't auto-track; computed deps are explicit.
- `@semajsx/core` — VNode shape, Fragment / Portal / Forward, Context, component runtime, `createRenderer(strategy)` seam, async helpers (`when`, `resource`, `stream`). Doesn't touch any DOM or terminal API.
- `@semajsx/configs` — shared `tsconfig` presets. Not a runtime package.

**Renderers**

- `@semajsx/dom` — DOM `render()`, keyed reconciliation, portals, refs, `StyleToken`-aware property setter. Doesn't do hydration (that lives in ssr).
- `@semajsx/terminal` — `render()` + `print()`, Yoga flex layout, ANSI paint, keyboard events. Doesn't support refs, portals, or keyed reconciliation; always full-redraws on signal change.

**Server**

- `@semajsx/ssr` — `renderToString`, `createApp` (Vite-powered), island collection, client `hydrate`. Doesn't reuse the DOM renderer for string output — it has its own VNode-to-HTML walker.
- `@semajsx/ssg` — build-time static output on top of ssr's App, typed collections, MDX via Vite virtual modules, plugin system. Doesn't run a server at runtime.

**Styling**

- `@semajsx/style` — signal-aware `classes()` / `rule()` / `rules()`, CSS injection, `StyleToken` type. Doesn't transform CSS at build time (emits at runtime).
- `@semajsx/tailwind` — type-safe tokens mirroring Tailwind utilities, tagged-template arbitrary values. Doesn't run the Tailwind CLI or parse a `tailwind.config`.

**Content & UI**

- `@semajsx/ui` — accessible component library (Button, Card, Tabs, Input, …). Doesn't publish bundled styles — each component owns its style via `@semajsx/style`.
- `@semajsx/blocks` — registry-based block rendering (BlockView, BlockList) for user-pluggable block types. Doesn't define any specific block schemas.
- `@semajsx/chat` — LLM/agent chat UI primitives (EventRenderer, ToolCallCard, ChatInput). Doesn't handle transport or persistence.
- `@semajsx/mermaid` — own SVG diagram renderer (parser + layout + themed components) with a remark plugin. Doesn't wrap mermaid.js — reimplements the subset it needs.
- `@semajsx/icons` — wraps Lucide icons as SemaJSX components. Doesn't ship custom icons.
- `@semajsx/prompt` — JSX-to-plain-text serializer for LLM prompts (`renderToString`). Doesn't render HTML or DOM; text output only.

**Tooling**

- `@semajsx/logger` — rich terminal logger built on `@semajsx/terminal`. Doesn't structure/ship logs (no JSON, no transports).
- `semajsx` (umbrella + CLI) — re-exports every sub-package at subpaths; ships a `preview` CLI (file-based dev server with HMR). Doesn't scaffold or production-build user apps.

## Data Flow

One happy path — a signal update triggering a DOM patch:

```
  user code                  core                    dom renderer
  ─────────                  ────                    ────────────
  count.set(n+1)
        │
        ▼
  scheduleUpdate  ─────► (microtask flush) ─────► subscribers fire
                                                        │
                                                        ▼
                                                  renderedNode's
                                                  setSignalProperty
                                                  callback runs
                                                        │
                                                        ▼
                                                  domStrategy mutates
                                                  DOM attribute / text
                                                  at the exact node
```

No tree diff. Each signal read during render registers an unsubscribe
in `RenderedNode.subscriptions`; updates are delivered point-to-point.

## Key Mechanisms

**Renderer seam (`RenderStrategy<TNode>`)** — `packages/core/src/render-core.ts`.
Core defines an 11-method (+2 optional) interface that any renderer implements.
`createRenderer(strategy)` returns `{ renderNode, unmount, cleanupSubscriptions }`.
All tree walking, component lifecycle, context propagation, portal/fragment
handling, and async wrapping live in core — the renderer only creates and
mutates nodes. Why it matters: adding a new target (PDF, native, canvas)
is a strategy implementation, not a fork of core.

**Signal VNodes as dynamic regions** — `packages/core/src/render-core.ts`.
A signal-valued child becomes a `#signal` VNode with a comment marker; on
update, only the region after the marker is replaced. No virtual-DOM diff.
Computed values that resolve to arrays get an append fast-path. Why it
matters: fine-grained updates without per-component reconciliation cost,
and the same mechanism transparently unwraps promises (`resource`) and
async iterators (`stream`) by wrapping them as signals.

**Islands via `ISLAND_MARKER` symbol** — `packages/core/src/shared/island-marker.ts`.
Core exports the symbol; ssr's `island()` stamps VNodes with it; ssr's
string renderer + client hydrator both detect it the same way. Why it
matters: island boundaries are a cross-cutting tag, not a wrapper
component type, so static collection (for build-time code-splitting) and
runtime hydration share one truth.

## Key Decisions

**Single published package with subpath exports, not per-package publishing.**
`packages/semajsx/package.json` declares 26 subpath exports and bundles all
`@semajsx/*` workspaces via tsdown. Rejected: publishing each workspace
independently. Reason: one version number, one coherent install, no
cross-package version drift. Cost: a change to any sub-package bumps the
whole umbrella.

**Explicit dependencies for `computed`, not auto-tracking.**
`computed(deps, fn)` takes an explicit deps array. Rejected: MobX/Vue-style
implicit tracking through an "active reader" global. Reason: no hidden
control flow; deps are auditable at the call site; no active-reader teardown
edge cases. Cost: the caller has to list deps.

**SSR has its own string renderer, not a reuse of `@semajsx/dom`.**
`packages/ssr/src/render.ts` walks VNodes directly to HTML. Rejected: run
the DOM renderer against jsdom/happy-dom and serialize. Reason: async
components, islands, and resource collection need first-class treatment
during traversal; string output has no reconciliation needs. Cost: two
tree walkers to keep behavior-consistent.

**Yoga for terminal layout, not a home-grown engine.**
`packages/terminal` uses Yoga's flexbox directly. Rejected: a custom
terminal box model. Reason: flexbox semantics already match what users
expect from a JSX layout, and Yoga is battle-tested. Cost: a native
peer dependency.

## Constraints

- Bun workspaces monorepo; `bun install` from root.
- TypeScript strict mode; tsgo for typecheck (fast), tsc for build.
- JSX is the user-facing API; `h()` is internal — tests and examples use JSX.
- No `as any`; prefer `unknown` or specific types.
- Tests are collocated with sources (`*.test.ts` / `*.test.tsx`).
- Only `semajsx` is published; internal `@semajsx/*` are workspace-only.

## Non-goals

- No virtual DOM. No tree diffing. Updates flow through signals, not reconciliation.
- No full-page hydration. Hydration is island-scoped; non-island server HTML stays static.
- No built-in router for SPA/client apps. SSR provides a Vite-powered router for its own shape; general routing is out of scope.
- No browser-only assumption. Terminal is a first-class target, not an afterthought.
- No CSS build pipeline. `@semajsx/style` emits CSS at runtime; `@semajsx/tailwind` ships tokens, not a transformer.
