# RFC: Dual Rendering Targets (DOM + Terminal)

**Date**: 2025-08 (retroactive)
**Status**: Implemented

---

## Summary

Support two rendering targets in SemaJSX: **DOM** (browsers) and **Terminal** (CLI applications), with shared JSX syntax and signal reactivity.

---

## Motivation

### Problem

Developers building CLI tools and web apps use completely different paradigms:

```tsx
// Web app - React/JSX
<div>
  <h1>{title}</h1>
  <Button onClick={...}>Click</Button>
</div>

// CLI app - Imperative/manual
console.log(chalk.bold(title));
console.log('Click here...');
// No components, no reactivity, no layout
```

**Pain points**:

- CLI tools lack component model
- No reactive updates in terminal UIs
- Can't reuse logic between web and CLI
- Terminal UI libraries (Ink, Blessed) are heavy or limited

### User Scenario

**As a developer**, I want to use the same JSX and component model for both web apps and CLI tools, so that I can share code and mental models.

---

## Goals

- ✅ **Unified syntax**: Use JSX for both DOM and terminal
- ✅ **Shared runtime**: Same signals, components, patterns
- ✅ **Target-specific APIs**: DOM events vs terminal input, HTML elements vs Boxes
- ✅ **Lightweight**: Terminal rendering shouldn't bloat web apps
- ✅ **Layout support**: Flexbox for terminal UIs (using Yoga)

---

## Non-Goals

- ❌ Universal components (DOM `<div>` won't work in terminal)
- ❌ Full TUI (complex terminal UIs like editors - use Blessed for that)
- ❌ Terminal-only features in web build (keep packages separate)

---

## Proposed Solution

### Package Structure

```
@semajsx/core       # Shared: VNode, signals, runtime
@semajsx/dom        # DOM rendering
@semajsx/terminal   # Terminal rendering
```

### DOM Rendering

```tsx
import { render } from "@semajsx/dom";
import { signal } from "@semajsx/signal";

function App() {
  const count = signal(0);
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => count.value++}>+</button>
    </div>
  );
}

render(<App />, document.body);
```

### Terminal Rendering

```tsx
import { render } from "@semajsx/terminal";
import { signal } from "@semajsx/signal";

function App() {
  const count = signal(0);
  return (
    <box flexDirection="column" padding={1}>
      <text bold>{count}</text>
      <text>Press Ctrl+C to exit</text>
    </box>
  );
}

render(<App />);
```

### Shared Logic

```tsx
// Shared logic can be reused
function useCounter() {
  const count = signal(0);
  const increment = () => count.value++;
  return { count, increment };
}

// Use in DOM
function WebApp() {
  const { count, increment } = useCounter();
  return <button onClick={increment}>{count}</button>;
}

// Use in Terminal
function CLIApp() {
  const { count } = useCounter();
  return <text>{count}</text>;
}
```

---

## Alternatives Considered

### Alternative A: DOM Only

**Rejected**: Misses opportunity to bring modern patterns to CLI development

### Alternative B: Universal Components

```tsx
// Same component works everywhere
<View>
  <Text>Hello</Text>
</View>
```

**Rejected**:

- Forces lowest common denominator
- DOM loses semantic HTML
- Complexity of abstraction not worth it

**Verdict**: Target-specific components better

### Alternative C: Separate Frameworks

**Rejected**: Loses shared patterns and code reuse

### Alternative D: Dual Rendering ✅

**Chosen**: Balance between code reuse and target-specific features

---

## Technical Approach

### Shared Core

`@semajsx/core` provides:

- VNode creation (`h()`)
- Signal system
- Component model
- Runtime helpers

### Target-Specific Renderers

**DOM Renderer** (`@semajsx/dom`):

- DOM manipulation
- Event handling
- HTML elements
- Hydration

**Terminal Renderer** (`@semajsx/terminal`):

- Yoga layout engine (Flexbox)
- ANSI color support (chalk)
- Built-in components (`<box>`, `<text>`)
- Stream output

---

## Key Design Decisions

1. **Separate packages** - Web apps don't bundle terminal code
2. **Shared signals** - Same reactivity everywhere
3. **Target-specific elements** - `<div>` vs `<box>`, not abstracted
4. **Flexbox for terminal** - Modern layout paradigm (via Yoga)

---

## Success Metrics

- ✅ Both renderers implemented
- ✅ Shared signal system works in both
- ✅ Examples demonstrate code reuse
- ✅ Bundle sizes acceptable (web: ~6KB, terminal: ~15KB with Yoga)

---

## Implementation

**Phase 1: Core** ✅

- VNode system
- Signal reactivity
- Component model

**Phase 2: DOM** ✅

- DOM rendering
- Event handling
- Hydration

**Phase 3: Terminal** ✅

- Yoga integration
- Box/Text components
- ANSI colors

**Phase 4: Documentation** ✅

- Examples for both targets
- Migration guides

---

## Decision

**Accepted**: 2025-08

**Rationale**:

1. **Unique value**: No other framework offers this combination
2. **Market need**: CLI tools lack modern patterns
3. **Clean architecture**: Separate packages keep web apps lightweight
4. **Proven tech**: Yoga (React Native layout engine) is battle-tested

**Trade-offs accepted**:

- Dual renderers increase maintenance
- Cannot share components directly (acceptable - shared logic is enough)

**Next Steps**:

- [x] Implement core runtime
- [x] Implement DOM renderer
- [x] Implement terminal renderer
- [x] Create examples
- [x] Document patterns for code reuse
