# Vite Counter Example

A comprehensive counter and form demonstration using SemaJSX with Vite for development.

## Features

- **Multiple examples** in one app:
  - Counter with increment/decrement/reset
  - Input field with character count
  - Conditional rendering with toggle
- **Vite integration** - Fast HMR and optimized builds
- **Signal reactivity** - Fine-grained reactive updates
- **Computed values** - Derived state

## Running the Example

```bash
# Development server
bun run example:dev

# Or with Vite directly
cd examples/vite-counter
vite
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
bun run example:build

# Or from the example directory
cd examples/vite-counter
vite build
```

## What's Demonstrated

### 1. Counter Component

```tsx
const count = signal(0);
const doubled = computed([count], (c) => c * 2);

<button onclick={() => count.value++}>Increment</button>;
```

Basic signal state with computed derived values.

### 2. Input Example

```tsx
const text = signal("");
const length = computed([text], (t) => t.length);

<input
  type="text"
  value={text}
  oninput={(e: Event) => {
    text.value = (e.target as HTMLInputElement).value;
  }}
/>;
```

Two-way data binding and computed string length.

### 3. Conditional Rendering

```tsx
const show = signal(true);
const content = computed([show], (s) =>
  s ? <p>Content is visible! ✅</p> : <p>Content is hidden! ❌</p>,
);

<button onclick={() => (show.value = !show.value)}>Toggle Content</button>;
```

Reactive conditional rendering using computed signals.

## Project Structure

```
vite-counter/
├── src/
│   └── main.tsx       # App entry point with all examples
├── index.html         # HTML template
├── vite.config.ts     # Vite configuration
└── tsconfig.json      # TypeScript configuration
```

## Vite Configuration

The `vite.config.ts` sets up:

- React preset (for JSX transform)
- TypeScript support
- Development server options

## Implementation Details

- Uses `/** @jsxImportSource @semajsx/dom */` for JSX
- Imports `signal`, `computed` from `semajsx`
- Imports `render` from `@semajsx/dom`
- Renders to `#root` div in index.html

## Key Concepts

### Fine-Grained Reactivity

SemaJSX updates only the specific DOM nodes that depend on changed signals:

```tsx
<div class="count">Count: {count}</div>
```

When `count` changes, only the text node updates - not the entire component.

### Computed Signals

Computed values automatically track dependencies:

```tsx
const doubled = computed([count], (c) => c * 2);
```

No need to manually specify dependencies - they're tracked automatically.

## Related Examples

- **bun-server** - Similar app using Bun instead of Vite
- **performance-test** - Advanced optimization techniques
