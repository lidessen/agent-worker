# SSR Islands Example

This example demonstrates SemaJSX's **SSR Island Architecture** with runtime discovery and lazy building.

## Features

- 🏝️ **Island Components** - Mark components for client-side hydration
- ⚡ **Runtime Discovery** - Islands are discovered during SSR rendering
- 🔧 **Lazy Building** - Island code is built on-demand
- 🎯 **Selective Hydration** - Only interactive components load JavaScript
- 📦 **Minimal Bundle** - Static content needs no JavaScript

## How It Works

### 1. Mark Components as Islands

```tsx
import { island } from "@semajsx/ssr";
import { signal } from "semajsx";

export const Counter = island(
  function Counter({ initial = 0 }) {
    const count = signal(initial);
    return <button onClick={() => count.value++}>{count}</button>;
  },
  import.meta.url, // Component module path
);
```

### 2. Use in Your App

```tsx
export function App() {
  return (
    <div>
      <h1>Static Content</h1>
      <Counter initial={0} /> {/* This will be hydrated */}
      <p>More static content</p>
    </div>
  );
}
```

### 3. Create Server with Router

```tsx
import { createRouter } from "@semajsx/ssr";

const router = createRouter({
  "/": () => <App />,
});

// Handle page requests
const result = await router.get("/");
// Returns: { html, islands, scripts }

// Handle island code requests (lazy build)
const code = await router.getIslandCode("island-0");
```

## Running the Example

```bash
# From the root directory
bun run example:ssr

# Or directly
bun --conditions=development examples/ssr-islands/server.tsx
```

Then open http://localhost:3000 in your browser.

## Architecture

```
Client Request → Server
                   ↓
              Render <App />
                   ↓
         Discover Islands (runtime)
                   ↓
         Generate HTML + placeholders
                   ↓
              Send Response
                   ↓
Client ← HTML with <script> tags for islands
                   ↓
        Browser requests island code
                   ↓
              Build Island (lazy)
                   ↓
         Send JavaScript bundle
                   ↓
        Hydrate island components
```

## Key Concepts

### Island Annotation

Components are marked as islands using the `island()` function:

```tsx
island(Component, import.meta.url);
```

This wraps the component and marks it for client-side hydration.

### Runtime Discovery

During SSR rendering, the server traverses the VNode tree and automatically discovers all island components. No build-time analysis needed!

### Lazy Building

Island code is only built when the browser requests it:

1. Server renders page with island placeholders
2. Browser loads page and executes island scripts
3. Island scripts request their code from `/islands/island-X.js`
4. Server builds the island code on-demand using Bun.build
5. Browser hydrates the island component

### Selective Hydration

Only marked islands are hydrated on the client. Static content remains static, resulting in:

- Faster page loads
- Less JavaScript
- Better performance
- Improved SEO

## File Structure

```
examples/ssr-islands/
├── Counter.tsx      # Island component
├── TodoList.tsx     # Another island component
├── App.tsx          # Main app with static + islands
├── server.tsx       # Server with router
└── README.md        # This file
```

## Comparison with Other Approaches

### Traditional SSR

- ❌ All components hydrate (heavy JavaScript)
- ❌ Slower initial interactivity
- ✅ Simple to implement

### SSR Islands

- ✅ Only marked components hydrate (light JavaScript)
- ✅ Faster initial load
- ✅ Selective interactivity
- ✅ Runtime discovery (no build-time analysis)

## Next Steps

Try modifying the example:

1. Create new island components
2. Add more routes to the router
3. Implement lazy loading on interaction
4. Add streaming SSR support

Enjoy building with SemaJSX Islands! 🏝️
