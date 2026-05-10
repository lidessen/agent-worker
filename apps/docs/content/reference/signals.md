---
title: Signals
description: Learn about SemaJSX's reactive signal system
order: 2
category: Core Concepts
---

# Signals

Signals are the foundation of SemaJSX's reactivity system. They provide fine-grained reactivity that automatically tracks dependencies and updates only what changed.

## What are Signals?

A signal is a reactive primitive that holds a value and notifies subscribers when that value changes.

```tsx
import { signal } from "semajsx/signal";

const count = signal(0);

console.log(count.value); // 0
count.value = 5;
console.log(count.value); // 5
```

## Creating Signals

Use the `signal()` function to create a new signal:

```tsx
import { signal } from "semajsx/signal";

// Primitive values
const name = signal("Alice");
const age = signal(25);
const isActive = signal(true);

// Objects and arrays
const user = signal({ name: "Bob", age: 30 });
const items = signal([1, 2, 3]);
```

<Callout type="warning" title="Object mutations">
For objects and arrays, you must replace the entire value to trigger updates. Mutating nested properties won't trigger reactivity.
</Callout>

## Using Signals in JSX

Signals automatically subscribe when used in JSX:

```tsx
/** @jsxImportSource semajsx/dom */

import { signal } from "semajsx/signal";

function App() {
  const count = signal(0);

  return (
    <div>
      {/* Signal value is automatically tracked */}
      <p>Count: {count}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

## Computed Signals

Create derived values with `computed()` using explicit dependencies:

```tsx
import { signal, computed } from "semajsx/signal";

const firstName = signal("John");
const lastName = signal("Doe");

// Computed requires explicit dependency array
const fullName = computed([firstName, lastName], (first, last) => `${first} ${last}`);

console.log(fullName.value); // "John Doe"

firstName.value = "Jane";
console.log(fullName.value); // "Jane Doe"
```

## Subscriptions

Subscribe to signal changes with the `subscribe()` method:

```tsx
import { signal } from "semajsx/signal";

const count = signal(0);

// Subscribe to changes
const unsubscribe = count.subscribe((value) => {
  console.log(`Count is now: ${value}`);
});

count.value = 1; // Logs: "Count is now: 1"
count.value = 2; // Logs: "Count is now: 2"

// Clean up
unsubscribe();
```

## Batching Updates

Use `batch()` to group multiple signal updates:

```tsx
import { signal, batch } from "semajsx/signal";

const x = signal(0);
const y = signal(0);

// Without batching - triggers 2 updates
x.value = 10;
y.value = 20;

// With batching - triggers 1 update
batch(() => {
  x.value = 10;
  y.value = 20;
});
```

<Callout type="tip" title="Performance optimization">
Use batching when updating multiple signals at once to minimize re-renders.
</Callout>

## Reactivity Flow

```mermaid
graph LR
  A[signal] o-->|notify| B[computed]
  A o-->|notify| C[JSX binding]
  B o-->|notify| C
  C -->|update| D[DOM]
  D -.->|event| A
```

```mermaid raw
graph LR
  A[signal] o-->|notify| B[computed]
  A o-->|notify| C[JSX binding]
  B o-->|notify| C
  C -->|update| D[DOM]
  D -.->|event| A
```

## Best Practices

1. **Keep signals simple** - Store primitive values or immutable data
2. **Use computed for derived values** - Don't manually sync related signals
3. **Batch related updates** - Group multiple signal changes together
4. **Use explicit dependencies** - Always specify dependencies in computed signals

## Next Steps

- Learn about [Components](/reference/components)
- Explore [DOM Rendering](/reference/dom-rendering)
- Try the [Counter App](/guides/building-a-counter) tutorial
