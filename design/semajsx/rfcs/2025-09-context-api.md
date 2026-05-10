# RFC: Context API for Component Communication

**Date**: 2025-09 (retroactive)
**Status**: Implemented
**Design Doc**: [design/designs/context-api-design.md](../designs/context-api-design.md)

---

## Summary

Add a Context API to SemaJSX to solve prop drilling problem, enabling data sharing across component tree without manual prop passing at every level.

---

## Motivation

### Problem

In deeply nested component trees, passing props through intermediate components becomes tedious and unmaintainable:

```tsx
// Props drilling - passing theme through 5 levels
<App theme={theme}>
  <Layout theme={theme}>
    <Sidebar theme={theme}>
      <Menu theme={theme}>
        <MenuItem theme={theme} /> // Finally used here!
      </Menu>
    </Sidebar>
  </Layout>
</App>
```

**Pain points**:

- Intermediate components must know about props they don't use
- Refactoring becomes difficult (change propagates through all levels)
- Component reusability suffers

### User Scenario

**As a developer**, I want to share data (theme, user, config) across components without prop drilling, so that my code is cleaner and more maintainable.

---

## Goals

- ✅ Eliminate prop drilling for cross-cutting concerns (theme, user, i18n)
- ✅ Type-safe context creation and consumption
- ✅ Work seamlessly with signals for reactivity
- ✅ Async-safe (no hook rules)
- ✅ Backward compatible with existing components

---

## Non-Goals

- ❌ Replace all prop passing (props are still preferred for direct relationships)
- ❌ Global state management (use signals or external libraries)
- ❌ Server-side context propagation (out of scope)

---

## Proposed Solution

### API Overview

```tsx
// 1. Create context
const ThemeContext = context<Theme>();

// 2. Provide value
<Context provide={[ThemeContext, theme]}>
  <App />
</Context>;

// 3. Consume via second parameter
function MyComponent(props, ctx) {
  const theme = ctx.inject(ThemeContext) ?? defaultTheme;
  return <div class={theme.mode}>...</div>;
}
```

### Key Design Choices

1. **Function parameter instead of hooks** - Async-safe, no hook rules
2. **Explicit defaults with `??`** - Users control fallback behavior
3. **Multiple contexts without nesting** - `provide` accepts array
4. **Pure value container** - Context doesn't manage reactivity, users do via signals

---

## Alternatives Considered

### Alternative A: React-style Context with Hooks

```tsx
const theme = useContext(ThemeContext);
```

**Rejected because**:

- Hook rules complicate async components
- Requires global state management
- Not aligned with SemaJSX's signal-based approach

### Alternative B: Solid-style Context with Hooks

```tsx
const theme = useContext(ThemeContext);
```

**Rejected because**:

- Still has hook limitations
- We prefer explicit parameters over implicit hooks

### Alternative C: Provide/Inject via Props

```tsx
<ThemeContext.Provider value={theme}>
```

**Rejected because**:

- Requires nested providers for multiple contexts
- More verbose than unified `<Context>` component

---

## Success Metrics

- ✅ Context API implemented and tested
- ✅ Zero breaking changes to existing code
- ✅ Documentation and examples complete
- ✅ Type inference works correctly

---

## Implementation

See [Design Document](../designs/context-api-design.md) for detailed implementation.

**Key files**:

- `packages/core/src/context.ts` - Core implementation
- `packages/dom/src/render.ts` - Rendering integration
- `packages/core/src/context.test.ts` - Tests

---

## Decision

**Accepted**: 2025-09

**Rationale**:

1. Solves real pain point (prop drilling)
2. Design aligns with SemaJSX principles (explicit, signal-friendly, async-safe)
3. Implementation is clean and backward compatible
4. No performance overhead

**Next Steps**:

- [x] Design document created
- [x] Implementation complete
- [x] Tests written
- [x] Documentation published
