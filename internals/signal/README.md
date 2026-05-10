# @semajsx/signal

Fine-grained reactive signal system for SemaJSX. Provides reactive primitives for building efficient, reactive user interfaces without virtual DOM diffing.

## Installation

```bash
bun add @semajsx/signal
```

## Features

- **Signals** - Reactive state containers
- **Computed Signals** - Derived reactive values
- **Effects** - Automatic dependency tracking and execution
- **Batching** - Batch multiple updates for performance
- **Fine-grained Reactivity** - Updates only what changed

## Usage

### Basic Signal

```typescript
import { signal } from "@semajsx/signal";

const count = signal(0);

// Read value
console.log(count.value); // 0

// Update value
count.value = 1;

// Subscribe to changes
const unsubscribe = count.subscribe((newValue) => {
  console.log("Count changed:", newValue);
});
```

### Computed Signal

```typescript
import { signal, computed } from "@semajsx/signal";

const firstName = signal("John");
const lastName = signal("Doe");

// Computed requires explicit dependency array
const fullName = computed([firstName, lastName], (first, last) => {
  return `${first} ${last}`;
});

console.log(fullName.value); // "John Doe"

firstName.value = "Jane";
console.log(fullName.value); // "Jane Doe"
```

### Subscribing to Changes

```typescript
import { signal } from "@semajsx/signal";

const count = signal(0);

// Subscribe to changes
const unsubscribe = count.subscribe((newValue) => {
  console.log("Count is:", newValue);
});

count.value = 1; // Logs: "Count is: 1"
count.value = 2; // Logs: "Count is: 2"

// Clean up
unsubscribe();
```

### Batching Updates

```typescript
import { signal, computed, batch } from "@semajsx/signal";

const count = signal(0);
// Use explicit dependency array
const doubled = computed([count], (c) => c * 2);

// Batch multiple updates
batch(() => {
  count.value = 1;
  count.value = 2;
  count.value = 3;
});

// doubled only updates once, with final value
console.log(doubled.value); // 6
```

### Utility Functions

```typescript
import { signal, isSignal, unwrap } from "@semajsx/signal";

const count = signal(5);

// Check if value is a signal
isSignal(count); // true
isSignal(5); // false

// Unwrap a signal or return value as-is
// Works with both signals and plain values
unwrap(count); // 5
unwrap(5); // 5
```

## API

### `signal<T>(initialValue: T): WritableSignal<T>`

Create a writable signal.

### `computed<T, R>(dep: Signal<T>, compute: (value: T) => R): Signal<R>`

### `computed<T[], R>(deps: T[], compute: (...values) => R): Signal<R>`

Create a computed signal with explicit dependencies. Supports single or multiple dependencies.

```typescript
// Single dependency
const doubled = computed([count], (c) => c * 2);

// Multiple dependencies
const fullName = computed([firstName, lastName], (f, l) => `${f} ${l}`);
```

### `batch(fn: () => void): void`

Batch multiple signal updates to trigger subscribers only once.

### `isSignal<T>(value: unknown): value is Signal<T>`

Check if a value is a signal.

### `unwrap<T>(value: MaybeSignal<T>): T`

Unwrap a signal or return the value as-is. Works with both signals and plain values.

## License

MIT
