# @semajsx/style

A modular styling system that treats CSS as JavaScript modules. Write native CSS syntax, get tree-shaking, type safety, and Shadow DOM support.

## Installation

```bash
# npm
npm install @semajsx/style

# bun
bun add @semajsx/style
```

## Quick Start

```ts
// button.style.ts
import { classes, rule } from "@semajsx/style";

// 1. Create scoped class names
const c = classes(["root", "icon", "label"]);

// 2. Define styles with native CSS syntax
export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 4px;
  background: #3b82f6;
  color: white;
}`;

export const icon = rule`${c.icon} {
  width: 18px;
  height: 18px;
  margin-right: 8px;
}`;

export const label = rule`${c.label} {
  font-weight: 500;
}`;
```

```tsx
// Button.tsx (React)
import { StyleAnchor, useStyle } from "@semajsx/style/react";
import * as button from "./button.style";

function App() {
  return (
    <StyleAnchor>
      <Button>Click me</Button>
    </StyleAnchor>
  );
}

function Button({ children }) {
  const cx = useStyle();
  return (
    <button className={cx(button.root)}>
      <span className={cx(button.icon)}>+</span>
      <span className={cx(button.label)}>{children}</span>
    </button>
  );
}
```

---

## Core Concepts

### Why @semajsx/style?

| Problem                            | Solution                                                |
| ---------------------------------- | ------------------------------------------------------- |
| CSS-in-JS has awkward syntax       | Write native CSS in template literals                   |
| Traditional CSS doesn't tree-shake | Each export is independently eliminable                 |
| Class names can collide            | Content-hashed class names are collision-resistant      |
| Shadow DOM needs special handling  | Control injection target (document.head or shadow root) |
| No type safety for class names     | TypeScript-powered autocomplete                         |

### How It Works

```
You write:           Bundle gets:           DOM receives:
─────────────────────────────────────────────────────────
button.style.ts  →   Only imported rules →  Injected CSS
  export root        (tree-shaking)         (deduplicated)
  export icon
  export large       If large is unused,
                     it's eliminated
```

---

## API Reference

### `classes(names)`

Creates a collection of scoped class name references.

```ts
import { classes } from "@semajsx/style";

const c = classes(["root", "icon", "label"]);

// Each property is a ClassRef with:
// - Unique ID (Symbol)
// - toString() → "root-x7f3a" (content-hashed)

console.log(c.root.toString()); // "root-x7f3a"
console.log(`${c.root}`); // "root-x7f3a"
```

**Type signature:**

```ts
function classes<T extends string>(names: T[]): ClassRefs<T>;

// ClassRefs<T> is an object with T-keyed ClassRef properties
type ClassRefs<T> = { [K in T]: ClassRef };
```

### `rule`

Tagged template literal for creating CSS rules.

```ts
import { classes, rule } from "@semajsx/style";

const c = classes(["box"]);

// Basic rule
const box = rule`${c.box} {
  width: 100px;
  height: 100px;
  background: blue;
}`;

// Pseudo-classes
const boxHover = rule`${c.box}:hover {
  background: darkblue;
}`;

// Combinators
const boxChild = rule`${c.box} > span {
  color: white;
}`;

// Media queries
const boxResponsive = rule`@media (min-width: 768px) {
  ${c.box} { width: 200px; }
}`;
```

**What `rule` returns:**

A `StyleToken` object containing:

- `_`: The class name (for simple `.class { }` selectors only)
- `__cssTemplate`: The CSS string with signal placeholders
- `__bindingDefs`: Signal references (for reactive styles)

**Important:** Pseudo-class and combinator rules have `_ = undefined`. They can be injected but not used as class names.

### `rules(...tokens)`

Combines multiple rules into a single token for batch injection.

```ts
import { classes, rule, rules } from "@semajsx/style";

const c = classes(["btn"]);

// Group related rules
const btnStates = rules(
  rule`${c.btn}:hover { background: #ddd; }`,
  rule`${c.btn}:active { transform: scale(0.98); }`,
  rule`${c.btn}:disabled { opacity: 0.5; cursor: not-allowed; }`,
);

// Inject as one unit
inject(btnStates);
```

---

## Framework Integration

### React

```tsx
import { StyleAnchor, useStyle, useSignal } from "@semajsx/style/react";
import * as button from "./button.style";

// 1. Wrap your app (or a subtree) with StyleAnchor
function App() {
  return (
    <StyleAnchor>
      <Button size="large" />
    </StyleAnchor>
  );
}

// 2. Use the cx function in components
function Button({ size }) {
  const cx = useStyle();

  return (
    <button
      className={cx(
        button.root,
        size === "large" && button.large,
        "custom-override", // strings work too
      )}
    >
      Click me
    </button>
  );
}
```

**`StyleAnchor`**: Provides the style registry context and creates an anchor element for signal subscriptions.

**`useStyle()`**: Returns the `cx` function for combining style tokens and strings.

**`useSignal(initialValue)`**: Creates a reactive signal for dynamic styles.

### Vue

```vue
<script setup>
import { StyleAnchor, useStyle, useSignal } from "@semajsx/style/vue";
import * as button from "./button.style";

const cx = useStyle();
const size = ref("normal");
</script>

<template>
  <StyleAnchor>
    <button :class="cx(button.root, size === 'large' && button.large)">Click me</button>
  </StyleAnchor>
</template>
```

### Framework-Agnostic (Manual)

```ts
import { createRegistry, createCx, inject } from "@semajsx/style";
import * as button from "./button.style";

// Create a registry
const registry = createRegistry({ target: document.head });

// Create cx function bound to registry
const cx = createCx(registry);

// Set anchor for signal subscriptions
registry.setAnchorElement(document.getElementById("app"));

// Use in vanilla JS
const btn = document.createElement("button");
btn.className = cx(button.root, button.primary);
```

---

## Reactive Styles

Signals enable CSS values that update at runtime without re-rendering.

```ts
import { classes, rule } from "@semajsx/style";
import { signal } from "@semajsx/signal"; // or useSignal in React/Vue

const c = classes(["box"]);

// Create a signal with initial value
const height = signal("100px");

// Reference the signal in your rule
export const box = rule`${c.box} {
  width: 200px;
  height: ${height};  /* Reactive! */
  background: blue;
}`;

// Later, update the signal
height.value = "300px"; // CSS updates automatically
```

**How it works:**

1. `rule` detects signal interpolations
2. During injection, signals get CSS variable names (`--sig-abc123`)
3. The CSS becomes `height: var(--sig-abc123)`
4. Signal changes update the CSS variable via `style.setProperty()`
5. CSS inherits the new value

**Important:**

- Signal values must include units: `signal("100px")`, not `signal(100)`
- Reactive styles require `StyleAnchor` (React/Vue) or `setAnchorElement()` (manual)

---

## Injection & Preloading

### Manual Injection

```ts
import { inject, preload } from "@semajsx/style";
import * as button from "./button.style";
import * as card from "./card.style";

// Inject a single token
const cleanup = inject(button.root);

// Later, remove the styles
cleanup();

// Inject multiple tokens
inject([button.root, button.icon, button.label]);

// Inject an object of tokens
inject({ ...button, ...card });
```

### Preloading

For optimal performance, preload all route styles at once:

```ts
import { preload } from "@semajsx/style";
import * as button from "./button.style";
import * as card from "./card.style";
import * as modal from "./modal.style";

// At app startup or route entry
preload(button, card, modal);
```

This batches DOM writes and prevents style recalculation during component mounting.

### Injection Targets

Control where styles are injected:

```ts
// Default: document.head
inject(button.root);

// Custom target (e.g., Shadow DOM)
const shadowRoot = element.attachShadow({ mode: "open" });
inject(button.root, { target: shadowRoot });
```

---

## Styling Patterns

### Modular Style Files

Organize styles in `.style.ts` files next to components:

```
components/
├── Button/
│   ├── Button.tsx
│   └── button.style.ts
├── Card/
│   ├── Card.tsx
│   └── card.style.ts
```

### Variants with Named Exports

```ts
// button.style.ts
const c = classes(["root", "primary", "secondary", "large", "small"]);

// Base style
export const root = rule`${c.root} {
  display: inline-flex;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}`;

// Color variants
export const primary = rule`${c.primary} {
  background: #3b82f6;
  color: white;
}`;

export const secondary = rule`${c.secondary} {
  background: #e5e7eb;
  color: #1f2937;
}`;

// Size variants
export const large = rule`${c.large} {
  padding: 12px 24px;
  font-size: 18px;
}`;

export const small = rule`${c.small} {
  padding: 4px 8px;
  font-size: 12px;
}`;
```

```tsx
// Usage
<button className={cx(button.root, button.primary, button.large)}>Large Primary Button</button>
```

### State Styles with `rules()`

```ts
export const states = rules(
  rule`${c.root}:hover { filter: brightness(1.1); }`,
  rule`${c.root}:active { transform: scale(0.98); }`,
  rule`${c.root}:focus-visible { outline: 2px solid #3b82f6; }`,
  rule`${c.root}:disabled { opacity: 0.5; cursor: not-allowed; }`,
);
```

### Conditional Classes

```tsx
const cx = useStyle();

// Boolean conditions
className={cx(
  button.root,
  isPrimary && button.primary,
  isLarge && button.large,
  disabled && button.disabled
)}

// Ternary
className={cx(
  button.root,
  variant === "primary" ? button.primary : button.secondary
)}

// Mix with string classes
className={cx(button.root, "mt-4", externalClassName)}
```

---

## Best Practices

### Do: Use Named Exports

```ts
// ✅ Tree-shakeable
export const root = rule`...`;
export const icon = rule`...`;
export const large = rule`...`;
```

```ts
// ❌ Not tree-shakeable
export const button = {
  root: rule`...`,
  icon: rule`...`,
  large: rule`...`,
};
```

### Do: Include Units in Signals

```ts
// ✅ Correct
const width = signal("100px");
const opacity = signal("0.5");

// ❌ Won't work
const width = signal(100);
```

### Do: Preload Route Styles

```ts
// ✅ One batch at route entry
preload(button, card, modal, form);

// ❌ Many small injections during render
// (causes layout thrashing)
```

### Do: Use StyleAnchor

```tsx
// ✅ Signals work correctly
<StyleAnchor>
  <App />
</StyleAnchor>

// ❌ Signals won't update
<App />
```

---

## Type Checking

All APIs are fully typed:

```ts
import { classes, rule, isStyleToken, isClassRef } from "@semajsx/style";

const c = classes(["root", "icon"]);
// c.root: ClassRef
// c.foo  ← TypeScript error: Property 'foo' does not exist

const token = rule`${c.root} { color: red; }`;
// token: StyleToken

// Type guards
if (isStyleToken(value)) {
  // value is StyleToken
}

if (isClassRef(value)) {
  // value is ClassRef
}
```

---

## Deduplication

The style system automatically deduplicates:

- **Same class injected multiple times**: Only one `<style>` tag
- **Pseudo/combinator rules**: Deduplicated by CSS content
- **Signal subscriptions**: No duplicate listeners

```ts
inject(button.root);
inject(button.root); // No-op, already injected
inject(button.root); // No-op, already injected
// Result: 1 style tag in DOM
```

---

## Limitations

1. **Simple selectors only for className extraction**: `rule` can only extract the class name from `.className { }` patterns. Complex selectors (pseudo-classes, combinators) return `_ = undefined`.

2. **Signal values need units**: CSS doesn't understand bare numbers. Always include the unit in signal values.

3. **No CSS preprocessing**: This is a runtime/bundler system. Use external tools for Sass/Less if needed.

4. **Anchor required for signals**: Without `StyleAnchor` or `setAnchorElement()`, signal changes won't update the DOM.

---

## Comparison

| Feature               | @semajsx/style | CSS Modules | Styled Components      | Tailwind     |
| --------------------- | -------------- | ----------- | ---------------------- | ------------ |
| Native CSS syntax     | ✅             | ✅          | ❌ (template literals) | ❌ (classes) |
| Tree-shaking          | ✅             | ❌          | ✅                     | ✅           |
| Type-safe class names | ✅             | ❌          | ✅                     | ❌           |
| Shadow DOM support    | ✅             | ❌          | ❌                     | ❌           |
| Reactive styles       | ✅             | ❌          | ❌                     | ❌           |
| Zero runtime parsing  | ✅             | ✅          | ❌                     | ✅           |
| Framework-agnostic    | ✅             | ✅          | ❌                     | ✅           |

---

## See Also

- [@semajsx/tailwind](../tailwind/README.md) - Tailwind-style utilities built on @semajsx/style
- [RFC: Style System](../../design/rfcs/006-style-system.md) - Design rationale and architecture
