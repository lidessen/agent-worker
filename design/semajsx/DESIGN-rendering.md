# Rendering Targets — Design

Companion to [DESIGN.md](./DESIGN.md). Covers the four rendering
targets — DOM, Terminal, SSR, SSG — and the single seam in
`@semajsx/core` that makes them possible.

## The seam: `RenderStrategy<TNode>`

`packages/core/src/render-core.ts`:

```ts
interface RenderStrategy<TNode> {
  // creation (3)
  createTextNode(text): TNode;
  createComment(text): TNode;
  createElement(type): TNode;
  // tree manipulation (4)
  appendChild(parent, child);
  insertBefore(parent, newNode, refNode);
  removeChild(node);
  replaceNode(oldNode, newNode);
  // navigation (2)
  getParent(node);
  getNextSibling(node);
  // properties (2)
  setProperty(node, key, value);
  setSignalProperty(node, key, signal): unsubscribe;
  // optional (2)
  setRef?(node, ref): cleanup;
  tryReuseNode?(oldNode, newNode, oldRendered, newRendered): boolean;
}
```

`createRenderer(strategy)` returns `{ renderNode, unmount,
cleanupSubscriptions }`. All VNode walking, component lifecycle, context
propagation, fragment flattening, portal handling, async unwrapping, and
signal region management live behind this function — the strategy
supplies only the node-shaped verbs.

Each target declares a strategy and asks core to build it a renderer:

```
  domStrategy       = { …all 11 required + setRef + tryReuseNode }
  terminalStrategy  = { …all 11 required, NO setRef, NO tryReuseNode }
```

The absence of optional methods is meaningful: terminal has no refs and
always full-redraws on signal change; SSR has no live tree at all and
ships its own walker instead of a strategy.

## `@semajsx/dom`

**Entry** — `render(vnode, container)` in `packages/dom/src/render.ts`.
Returns `{ unmount }`.

**Adds over the seam**

- `tryReuseNode` — when a new VNode's element type matches, mutate in
  place rather than replace. Paired with keyed children
  (`reconcileKeyedChildren`) to reuse nodes across list reorders.
- `setRef` — assigns `ref.value = element` (signal ref) or calls
  `ref(element)` (callback ref); cleanup nulls both.
- Style-token awareness — `setProperty` recognizes `StyleToken` objects
  from `@semajsx/style` and calls `inject()` to mount CSS lazily.
- Portals — `createPortal` / `Portal` rendered into `props.container`.

**Doesn't do** — hydration (lives in ssr/client); `dangerouslySetInnerHTML`
is typed in JSX but not implemented in the property setter.

## `@semajsx/terminal`

**Entry** — `render(vnode, options?)` in `packages/terminal/src/render.ts`.
Returns a `TerminalRenderer` instance. Also ships `print(vnode)` for
one-shot output with no live updates.

**Adds over the seam**

- **Yoga-backed layout.** `createElement` creates a paired `Yoga.Node`;
  `applyStyle` maps props to Yoga setters; text nodes get
  `setMeasureFunc(stringWidth)`.
- **`TerminalRenderer`** owns the paint loop: layout → positions →
  buffer rendering with ANSI colors and box drawing. An FPS throttle
  gates repaints.
- **Keyboard-event singleton** (`installKeyboardHandler` + `onKeypress`)
  — no per-node event listeners.
- **Built-in components** — Box, Text, Static, TextInput, MultiSelect,
  Spinner, ExitHint, BlankLine in `src/components/`.

**Doesn't do** — no refs, no portals, no `tryReuseNode` (every signal
change triggers a full re-render; Yoga + the diff-aware output buffer
absorb the cost). No HTML, no CSS.

## `@semajsx/ssr`

**Entry** — `createApp(config)` for the high-level API;
`renderToString(vnode, options?)` for raw string rendering.

**Own VNode walker** — `packages/ssr/src/render.ts` has
`renderVNodeToHTML`, not a reuse of `@semajsx/dom`. It handles signals
(reads `.value`), resolves Promises and AsyncIterables, walks fragments,
and emits comment markers only where needed for hydration boundaries.

**Islands** — the mechanism:

```
  island(Counter, './counter')      ← ssr wraps a component, stamps
                                       ISLAND_MARKER on the returned VNode
        │
        ▼
  renderToString(vnode, {           ← options.transformIslandScript is the
    transformIslandScript: cb       hydration-enabled mode
  })
        │
        ▼
  on encountering a marked VNode:
    - render the component's HTML server-side (SEO + no-JS path)
    - serialize props (drop functions/symbols)
    - inject data-island-id / data-island-src / data-island-props
    - call cb({ id, src, props }) to get a <script> to append
        │
        ▼
  SSRResult = { html, islands[], scripts, css[], styles[] }
```

Without `transformIslandScript`, the same renderer emits fully static
HTML with no markers. The same code path serves both SSR-with-hydration
and pure-static output.

**Client hydration** — `packages/ssr/src/client/hydrate.ts`. Given a
serialized island and its container, it re-invokes the component with
the deserialized props and binds signals to the existing DOM via
`@semajsx/dom`'s property setters. There's no tree reconciliation step;
hydration trusts the server HTML's structure and attaches reactivity on
top.

**Vite integration** — `ViteIslandBuilder` generates per-island entry
code as an in-memory virtual module (`virtual:island-<id>.js`), which
the Vite plugin resolves at build time. No file is written for entry
points during dev.

## `@semajsx/ssg`

**Entry** — `createSSG(config)`. Builds full static sites on top of
ssr's `createApp`.

**Layering**

```
  ssg
   ├─ reuses ssr's App (route registration, island build pipeline)
   ├─ defineCollection<T>(schema) + sources (file / git / remote / custom)
   ├─ MDX via viteMDXPlugin (remark/rehype) → virtual:mdx:{coll}/{id}.mdx
   └─ writes outDir/**/index.html  +  outDir/_semajsx/islands/*.js
```

**Collections.** A collection is a typed bundle of entries with a Zod
schema. Sources return `{ id, slug, body, data }`; entries get a
`.render()` method that SSR-loads the body through the MDX virtual
module and returns a `Content` component. Plugins can inject routes,
remark/rehype steps, and component maps (used by `@semajsx/ssg/plugins/docs-theme`).

**Relationship to other packages.** ssg depends on `@semajsx/mermaid`
and `@semajsx/ui` directly — the docs-theme plugin uses both. This is a
deliberate coupling, not accidental: the docs theme is first-class in
ssg, not a separate distribution.

## Signal regions and fast paths

Both live renderers share one update mechanism from core — see
[DESIGN-reactivity.md](./DESIGN-reactivity.md#signal-driven-dynamic-regions).
Notable: if a signal value is an array whose prefix matches the previous
array (identity check), only the appended items are rendered and
inserted. Growing lists avoid the full-replace cost without keyed
reconciliation.

## Asymmetries

| Capability                | dom             | terminal           | ssr (string)    |
| ------------------------- | --------------- | ------------------ | --------------- |
| Keyed reconciliation      | yes             | no                 | n/a             |
| Refs (`ref` prop)         | yes             | no                 | no              |
| Portals                   | yes             | no                 | no              |
| `dangerouslySetInnerHTML` | typed, not impl | no                 | yes             |
| Layout engine             | browser CSS     | Yoga               | n/a             |
| Event model               | DOM events      | keyboard singleton | n/a             |
| Signal-driven updates     | point-to-point  | full re-render     | static snapshot |

These asymmetries are the module boundary: if a new feature needs refs
or portals, it can't run in terminal. If it needs reactive updates, it
can't run in ssr output.

## Non-goals

- No generic "renderer adapter" SDK. Implementing a new target means
  writing a `RenderStrategy<TNode>`; that's the contract.
- No tree diffing, ever. The reactivity story replaces it.
- No partial hydration strategy beyond islands (no "resumability",
  no "progressive hydration" — hydrate runs once per island).
