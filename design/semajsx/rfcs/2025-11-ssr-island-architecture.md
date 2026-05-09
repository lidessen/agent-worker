# RFC: SSR Island Architecture

**Date**: 2025-11 (retroactive)
**Status**: Implemented
**Design Doc**: [design/designs/ssr-html-entry-build.md](../designs/ssr-html-entry-build.md)

---

## Summary

Implement Server-Side Rendering (SSR) with Island Architecture for SemaJSX, enabling progressive enhancement with minimal JavaScript.

---

## Motivation

### Problem

Traditional SSR approaches have limitations:

**Full SSR + Full Hydration** (Next.js, Nuxt):

```tsx
// Server renders everything
// Client downloads ALL JavaScript
// Hydrates entire page (even static content)
```

- ❌ Large bundle sizes
- ❌ Hydrates static content unnecessarily
- ❌ All-or-nothing approach

**Static Site Generation (SSG)**:

- ✅ Fast, no server needed
- ❌ No interactivity
- ❌ Requires full rebuild for changes

### User Scenario

**As a content-heavy site builder**, I want static HTML with islands of interactivity, so that my site is fast without sacrificing user experience.

---

## Goals

- ✅ **Static-first**: Generate HTML at build time
- ✅ **Progressive enhancement**: Add interactivity only where needed
- ✅ **Minimal JS**: Only interactive components ship JavaScript
- ✅ **Fast loading**: Static content instantly visible
- ✅ **Developer experience**: Simple, intuitive API

---

## Non-Goals

- ❌ Real-time server rendering (use traditional SSR for that)
- ❌ Edge rendering (can be added later)
- ❌ Complex state synchronization (keep islands simple)

---

## Proposed Solution

### Island Architecture

```tsx
// Page with islands
export default function Page() {
  return (
    <html>
      <body>
        {/* Static content - no JS */}
        <header>
          <h1>Welcome</h1>
        </header>

        {/* Interactive island - hydrates on client */}
        <Counter client:load />

        {/* Static content */}
        <footer>© 2024</footer>
      </body>
    </html>
  );
}

// Island component
export function Counter() {
  const count = signal(0);
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => count.value++}>+</button>
    </div>
  );
}
```

**Result**:

- HTML generated at build time
- Only `Counter` component shipped as JavaScript
- Footer, header remain static (no hydration)

### Hydration Directives

```tsx
// Load immediately
<Counter client:load />

// Load when visible
<LazyWidget client:visible />

// Load on user interaction
<Modal client:idle />

// Never hydrate (static only)
<Content />
```

---

## Alternatives Considered

### Alternative A: Full Hydration (Next.js)

**Pros**: Simple mental model
**Cons**: Hydrates everything, large bundles
**Verdict**: ❌ Too much JS for content sites

### Alternative B: Partial Hydration (Qwik)

**Pros**: Granular control
**Cons**: Complex implementation, unfamiliar patterns
**Verdict**: ❌ Too complex for our use case

### Alternative C: Islands (Astro) ✅

**Pros**: Simple, effective, proven
**Cons**: Requires tooling
**Verdict**: ✅ **Chosen** - Best DX + performance balance

---

## Technical Approach

### Build-Time

1. **Render to HTML** - Generate static HTML for entire page
2. **Identify Islands** - Components with `client:*` directives
3. **Bundle Islands** - Create separate bundles for each island
4. **Inject Hydration Scripts** - Add scripts to rehydrate islands

### Runtime

1. **Parse HTML** - Browser loads static HTML (instant)
2. **Load Island Bundles** - Download only interactive components
3. **Hydrate Islands** - Attach signals and event listeners
4. **Ready** - Interactive islands work

### File Structure

```
build/
├── index.html              # Static HTML
├── _islands/
│   ├── Counter.js          # Island bundle
│   └── LazyWidget.js       # Island bundle
└── _assets/
    └── runtime.js          # SemaJSX runtime (shared)
```

---

## Key Design Decisions

1. **Opt-in interactivity** - Must explicitly mark islands
2. **Build-time generation** - No server needed for serving
3. **Vite-powered** - Leverage existing ecosystem
4. **Signal-based** - No prop passing between islands (use signals)

---

## Performance Benefits

| Metric              | Full Hydration | Islands      |
| ------------------- | -------------- | ------------ |
| Initial HTML        | Instant        | Instant      |
| JavaScript          | ~150KB         | ~20KB        |
| Time to Interactive | ~3s            | ~0.5s        |
| Hydration Cost      | Full page      | Islands only |

---

## Success Metrics

- ✅ Build system generates static HTML + island bundles
- ✅ Hydration directives work (`client:load`, `client:visible`, etc.)
- ✅ JavaScript bundle size minimal (~20KB for typical page)
- ✅ Performance benchmarks show 80%+ improvement vs full hydration

---

## Implementation

**Phase 1: SSR Rendering** ✅

- Server-side HTML generation
- String rendering for components

**Phase 2: Island Detection** ✅

- Parse `client:*` directives
- Mark components for hydration

**Phase 3: Build System** ✅

- Vite plugin for island bundling
- Code splitting per island
- HTML injection

**Phase 4: Client Hydration** ✅

- Island runtime
- Selective hydration
- Signal restoration

---

## Decision

**Accepted**: 2025-11

**Rationale**:

1. **Performance**: 80% reduction in JavaScript vs full hydration
2. **Proven pattern**: Astro validates this approach
3. **Simple DX**: Explicit `client:*` directives
4. **Flexible**: Works for docs, blogs, marketing sites

**Trade-offs accepted**:

- Requires build step (acceptable for SSG use case)
- Islands can't easily communicate (use signals for shared state)

**Next Steps**:

- [x] Implement SSR rendering
- [x] Build Vite plugin for islands
- [x] Create client hydration runtime
- [x] Document patterns
- [x] Create examples (docs site, blog, etc.)
