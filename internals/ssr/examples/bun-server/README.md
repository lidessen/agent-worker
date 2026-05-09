# Bun Server Example

A simple counter application demonstrating SemaJSX with Bun's built-in HTTP server.

## Features

- **Signal-based reactivity** - Automatic UI updates when state changes
- **Computed values** - Derived state that updates automatically
- **Two-way binding** - Input field synced with signal state
- **Hot Module Replacement** - Fast development with instant updates

## Running the Example

```bash
# From project root
bun run example:bun

# Or directly
bun --port=0 examples/bun-server/server.tsx
```

This will start a Bun server on a random available port and open it in your browser.

## What's Demonstrated

### Signal State Management

```tsx
const count = signal(0);
const doubled = computed([count], (v: number) => v * 2);
```

The `count` signal holds the state, and `doubled` automatically recomputes when `count` changes.

### Reactive DOM Updates

```tsx
<p>Count: {count}</p>
<p>Doubled: {doubled}</p>
```

No manual DOM updates needed - the UI automatically reflects signal changes.

### Event Handlers

```tsx
<button onclick={() => count.value++}>Increment</button>
<button onclick={() => count.value--}>Decrement</button>
```

Update signals directly in event handlers.

### Two-Way Binding

```tsx
<input
  type="text"
  value={count}
  oninput={(e: Event) => {
    const v = Number((e.target as HTMLInputElement).value);
    count.value = Number.isFinite(v) ? v : 0;
  }}
/>
```

The input field stays in sync with the signal value.

## Project Structure

```
bun-server/
├── index.html    # HTML template
├── main.tsx      # App entry point
├── server.tsx    # Bun HTTP server with HMR
└── tsconfig.json # TypeScript configuration
```

## Implementation Notes

- Uses `/** @jsxImportSource @semajsx/dom */` directive
- Imports from `semajsx` (signals) and `@semajsx/dom` (rendering)
- Server provides HMR via the `shared/server-utils` module
- Minimal setup - just a few files!

## Related Examples

- **vite-counter** - Similar app using Vite instead of Bun
- **performance-test** - Advanced optimizations and techniques
