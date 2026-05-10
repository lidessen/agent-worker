# Signal Interface Design

**Status**: Proposed
**Date**: 2026-01
**Related**: [Signal Reactivity RFC](../rfcs/2025-08-signal-reactivity.md)

---

## Summary

Define a minimal, pluggable Signal interface in `@semajsx/core` to enable third-party signal implementations while maintaining zero dependencies.

**Core principle**: The runtime should define a simple contract, not force a specific implementation.

---

## Goals

- ✅ **Minimal interface**: Only 2 required methods (`.value`, `.subscribe()`)
- ✅ **Zero dependencies**: Core doesn't depend on signal package
- ✅ **Maximum compatibility**: Works with most signal libraries (Preact, Vue)
- ✅ **Clear contract**: Easy to implement custom signals
- ✅ **Type safe**: Full TypeScript support

---

## Non-Goals

- ❌ Support all signal paradigms (e.g., Solid's tuple-based API)
- ❌ Provide signal implementation in core (that's `@semajsx/signal`'s job)
- ❌ Breaking changes to user code

---

## Motivation

### Current Problem

```
@semajsx/signal (interface + implementation bundled)
     ↑
@semajsx/core (must depend on signal for types)
     ↑
@semajsx/dom, @semajsx/terminal, @semajsx/ssr
```

**Issues:**

1. Core runtime tightly coupled to signal package
2. Can't replace signal implementation
3. Third-party signals can't be used

### Design Goal

> 任何signal实现都可以替换或部分替换内置的signal，不一定要用这个项目提供的signal实现。这个项目约定好signal的接口，然后提供一个默认实现。这个接口应该相对简单，大部分三方signal应该可以直接用或简单wrap一下就能用

---

## Interface Design Principles

### Key Principles

1. **Minimal Interface**: Only 2 required properties/methods
2. **Clear Naming**: `ReadableSignal` vs `WritableSignal` (not just `Signal`)
3. **Convenience Methods Are Implementation Details**: `set()` and `update()` are NOT in the interface
4. **Maximum Compatibility**: Easy for third-party libraries to adopt

### Why set() and update() Are Not in the Interface

**Current Problem**:

```typescript
// ❌ If we require set/update in the interface
interface WritableSignal<T> {
  value: T;
  set(value: T): void; // Redundant with .value =
  update(fn: (prev: T) => T): void; // Redundant with .value++
  subscribe(fn): () => void;
}
```

**Issues**:

- `set()` is just `signal.value = x` - redundant
- `update()` is just `signal.value = fn(signal.value)` - redundant
- Forces all implementations to provide these methods
- Preact Signals doesn't have them (but still compatible!)

**Solution**: These are **implementation details**, not interface requirements.

```typescript
// ✅ Core interface: minimal
interface WritableSignal<T> extends ReadableSignal<T> {
  value: T; // Only this is required
}

// ✅ Implementation can add convenience methods
export function signal<T>(initialValue: T): WritableSignal<T> {
  return {
    get value() {
      return value;
    },
    set value(v) {
      value = v;
    },
    subscribe(fn) {
      /* ... */
    },

    // Convenience methods (not in interface)
    set(v) {
      this.value = v;
    },
    update(fn) {
      this.value = fn(value);
    },
  };
}
```

### Minimal Signal Interface

```typescript
// @semajsx/core/src/signal-interface.ts

/**
 * Minimal signal interface required by SemaJSX runtime.
 *
 * Any signal implementation satisfying this interface can be used.
 * Only 2 methods required for maximum compatibility:
 * - .value: Read current value
 * - .subscribe(): React to changes
 *
 * Note: Methods like set() and update() are NOT part of the core interface.
 * They are convenience methods provided by implementations (e.g., @semajsx/signal).
 */
export interface ReadableSignal<T> {
  /**
   * Current value of the signal (read-only)
   */
  readonly value: T;

  /**
   * Subscribe to value changes
   *
   * @param listener - Callback invoked on each change with new value
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = count.subscribe(value => {
   *   console.log('New value:', value);
   * });
   * // Later...
   * unsubscribe();
   */
  subscribe(listener: (value: T) => void): () => void;
}

/**
 * Writable signal (extends readable with write capability)
 *
 * Only adds writable .value property.
 * Convenience methods (set, update) are implementation details,
 * not part of the core interface requirement.
 */
export interface WritableSignal<T> extends ReadableSignal<T> {
  /**
   * Current value (writable)
   *
   * Overrides the readonly value from ReadableSignal.
   * This is the ONLY addition for writable signals in the core interface.
   */
  value: T;
}

/**
 * Type guard to check if value is a signal
 *
 * Uses duck typing - checks for required methods only.
 * Does NOT check for set() or update() - those are implementation details.
 */
export function isSignal<T = any>(value: unknown): value is ReadableSignal<T> {
  return (
    value != null &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as any).subscribe === "function"
  );
}
```

### Why Only 2 Methods?

**Why no `peek()`?**

In SemaJSX's explicit dependency system:

```typescript
// No auto-tracking, so peek() is redundant
get value() { return value; }
peek() { return value; }  // Exactly the same!
```

**Auto-tracking vs Explicit:**

```typescript
// Auto-tracking (Preact, Solid, Vue)
// .value tracks dependency, .peek() doesn't
const doubled = computed(() => count.value * 2); // count tracked
const x = computed(() => count.peek() + 1); // count NOT tracked

// SemaJSX: Explicit dependencies
// .value never tracks, dependencies are explicit
const doubled = computed([count], (c) => c * 2); // count explicit
// No need for peek() - .value is already non-tracking
```

**Decision**: Remove `peek()` - it adds no value in explicit system.

---

## What Core Needs

### 1. Type Checking

```typescript
if (isSignal(value)) {
  // Handle signal
}
```

### 2. Reading Value

```typescript
// Get initial value
setProperty(element, key, signal.value);
```

### 3. Subscribing to Changes

```typescript
signal.subscribe((newValue) => {
  setProperty(element, key, newValue);
});
```

**What core does NOT need:**

- ❌ `.peek()` - redundant with `.value`
- ❌ `.set()` - convenience for users, not runtime
- ❌ `.update()` - convenience for users, not runtime

---

## Third-Party Compatibility

### Preact Signals ✅ 100%

```typescript
import { signal } from "@preact/signals-core";

const count = signal(0);
// ✅ count.value
// ✅ count.subscribe(fn)
```

**Perfect match!** No adapter needed.

### Vue Ref ⚠️ 50%

```typescript
import { ref, watch } from "vue";

// Simple adapter wrapper
function toSemaJSXSignal<T>(vueRef: Ref<T>): ReadableSignal<T> {
  return {
    get value() {
      return vueRef.value;
    },
    set value(v) {
      vueRef.value = v;
    },
    subscribe(fn) {
      const stop = watch(vueRef, fn, { immediate: false });
      return stop;
    },
  };
}

const count = toSemaJSXSignal(ref(0));
```

**Needs simple adapter** - just wraps `watch()` as `subscribe()`.

### Solid Signals ❌ 0%

```typescript
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);
// ❌ Tuple-based API
// ❌ No .value property
// ❌ No .subscribe()
```

**Incompatible paradigm** - would need full wrapper converting object API.

---

## New Architecture

```
@semajsx/core
  ├── Defines: ReadableSignal, WritableSignal, isSignal
  ├── Dependencies: ZERO
  └── Exports: Signal interfaces

@semajsx/signal (optional default implementation)
  ├── Implements: Core signal interfaces
  ├── Adds: set(), update(), computed(), batch()
  ├── Dependencies: @semajsx/core (types only)
  └── Exports: signal(), computed(), batch(), etc.

@semajsx/dom
  ├── Uses: ReadableSignal interface from core
  ├── Dependencies: @semajsx/core
  └── Optional: @semajsx/signal (for users)

@semajsx/signal-adapters (future)
  ├── preact-signals (re-export, already compatible)
  ├── vue-ref (wrapper adding subscribe)
  └── solid-signals (full adapter)
```

---

## Implementation Plan

### Phase 1: Create Core Interface ✅

1. Create `packages/core/src/signal-interface.ts`
2. Define `ReadableSignal`, `WritableSignal`, `isSignal`
3. Update `packages/core/src/types.ts` to export from interface file

### Phase 2: Update Signal Implementation ✅

1. Update `@semajsx/signal/src/types.ts` to import from core
2. Remove `peek()` from implementation
3. Keep convenience methods (`set`, `update`)

### Phase 3: Update Consumers ✅

1. Update all `peek()` calls to use `.value`
2. Import signal types from `@semajsx/core` instead of `@semajsx/signal`
3. Update `isSignal()` to not check for `peek()`

### Phase 4: Update Dependencies ✅

1. Remove `@semajsx/signal` from core `package.json` dependencies
2. Keep in dom/terminal/ssr (for runtime, not types)

### Phase 5: Documentation ✅

1. Document signal interface in core README
2. Add "Using Custom Signals" guide
3. Create adapter examples

### Phase 6: Adapters (Future) 🔮

1. Create `packages/signal-adapters/` directory
2. Implement Vue ref adapter
3. Implement Solid signals adapter (if needed)

---

## Breaking Changes

**For Users**: None - this is internal refactoring.

**For Library Authors**:

- Change: `import type { Signal } from "@semajsx/signal"`
- To: `import type { ReadableSignal } from "@semajsx/core"`
- Remove: Any usage of `signal.peek()` → use `signal.value`

---

## Comparison

| Feature                 | Before                     | After                |
| ----------------------- | -------------------------- | -------------------- |
| Interface location      | @semajsx/signal            | @semajsx/core        |
| Required methods        | 3 (value, peek, subscribe) | 2 (value, subscribe) |
| Core dependencies       | @semajsx/signal            | None                 |
| Preact compatibility    | 95%                        | 100% ✅              |
| Vue compatibility       | 30%                        | 50% ⬆️               |
| Implementation coupling | Tight                      | Loose ✅             |

---

## Examples

### Using Default Signal

```typescript
import { signal, computed } from "@semajsx/signal";
import { render } from "@semajsx/dom";

const count = signal(0);
render(<div>{count}</div>, document.body);
```

### Using Preact Signals

```typescript
import { signal } from "@preact/signals-core";
import { render } from "@semajsx/dom";

// Works directly - no adapter!
const count = signal(0);
render(<div>{count}</div>, document.body);
```

### Using Vue Ref (with adapter)

```typescript
import { ref } from "vue";
import { render } from "@semajsx/dom";
import { adaptVueRef } from "@semajsx/signal-adapters/vue";

const count = adaptVueRef(ref(0));
render(<div>{count}</div>, document.body);
```

### Implementing Custom Signal

**Minimal Implementation** (core interface only):

```typescript
import type { WritableSignal } from "@semajsx/core";

function mySignal<T>(initialValue: T): WritableSignal<T> {
  let value = initialValue;
  const listeners = new Set<(v: T) => void>();

  return {
    get value() {
      return value;
    },
    set value(v) {
      value = v;
      listeners.forEach((fn) => fn(v));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// Works with SemaJSX!
const count = mySignal(0);
count.value++; // ✅ Works
```

**With Convenience Methods** (optional):

```typescript
function mySignalWithHelpers<T>(initialValue: T): WritableSignal<T> & {
  set(v: T): void;
  update(fn: (prev: T) => T): void;
} {
  let value = initialValue;
  const listeners = new Set<(v: T) => void>();

  return {
    get value() {
      return value;
    },
    set value(v) {
      value = v;
      listeners.forEach((fn) => fn(v));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Optional convenience methods
    set(v) {
      this.value = v;
    },
    update(fn) {
      this.value = fn(value);
    },
  };
}

const count = mySignalWithHelpers(0);
count.value++; // ✅ Works
count.set(5); // ✅ Works (convenience)
count.update((n) => n + 1); // ✅ Works (convenience)
```

---

## Design Decisions Summary

### 1. No peek() Method ✅

- **Reason**: Redundant in explicit dependency system
- **Impact**: Interface simplified from 3 to 2 methods

### 2. No set()/update() in Interface ✅

- **Reason**: Convenience methods, not core requirements
- **Impact**: Easier third-party adoption
- **Note**: Implementations can still provide them

### 3. ReadableSignal Naming ✅

- **Reason**: Clear semantics (not just "Signal")
- **Impact**: Better developer experience

### 4. Duck Typing for isSignal() ✅

- **Reason**: Maximum flexibility
- **Check**: Only `value` + `subscribe` existence

## Success Metrics

- ✅ Core package has zero dependencies
- ✅ Interface minimal (only 2 properties: value + subscribe)
- ✅ Convenience methods (set/update) are implementation details
- ✅ Preact Signals work without adapter (100% compatible)
- ✅ Clear documentation for custom signals
- ✅ No breaking changes for users
- ✅ Type safety maintained

---

## References

- [Signal Reactivity RFC](../rfcs/2025-08-signal-reactivity.md)
- [Preact Signals](https://github.com/preactjs/signals)
- [Vue Reactivity](https://vuejs.org/api/reactivity-core.html)
- [TC39 Signals Proposal](https://github.com/tc39/proposal-signals)
