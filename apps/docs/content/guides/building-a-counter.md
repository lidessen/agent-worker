---
title: Building a Counter App
description: Learn the basics by building a simple counter application
order: 1
difficulty: beginner
---

# Building a Counter App

In this guide, you'll build a simple counter application to learn the fundamentals of SemaJSX.

## What You'll Learn

- Creating signals for reactive state
- Handling user events
- Rendering dynamic content

## Prerequisites

- Basic knowledge of JavaScript/TypeScript
- Node.js or Bun installed
- A text editor

## Step 1: Setup

First, create a new project and install SemaJSX:

```bash
mkdir my-counter-app
cd my-counter-app
bun init -y
bun add semajsx
```

## Step 2: Create the Counter Component

Create a file called `counter.tsx`:

```tsx
/** @jsxImportSource semajsx/dom */

import { signal } from "semajsx/signal";
import { render } from "semajsx/dom";

function Counter() {
  // Create a reactive signal
  const count = signal(0);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Counter App</h1>
      <p style={{ fontSize: "32px", fontWeight: "bold" }}>Count: {count}</p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => count.value--}>Decrement</button>
        <button onClick={() => (count.value = 0)}>Reset</button>
        <button onClick={() => count.value++}>Increment</button>
      </div>
    </div>
  );
}

// Render to the DOM
render(<Counter />, document.getElementById("app")!);
```

## Step 3: Add HTML

Create an `index.html` file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Counter App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./counter.tsx"></script>
  </body>
</html>
```

## Step 4: Run the App

Using Vite for development:

```bash
bun add -d vite
bunx vite
```

Open your browser to `http://localhost:5173` and you'll see your counter app!

<Callout type="success" title="It works!">
Click the buttons to see the count update in real-time. Notice how only the count value updates - no full page re-render!
</Callout>

## How It Works

### Signals

```tsx
const count = signal(0);
```

This creates a reactive signal with an initial value of `0`. Signals automatically track where they're used and update those locations when the value changes.

### Event Handlers

```tsx
<button onClick={() => count.value++}>Increment</button>
```

Event handlers are just JavaScript functions. Update the signal's `.value` property to trigger a re-render.

### Automatic Subscriptions

```tsx
<p>Count: {count}</p>
```

When you use a signal in JSX, SemaJSX automatically subscribes to changes. When `count.value` changes, only this text node updates - not the entire component!

## Adding Features

### Step Counter

Let's add a feature to increment by a custom step:

```tsx
function Counter() {
  const count = signal(0);
  const step = signal(1);

  return (
    <div>
      <h1>Counter: {count}</h1>

      <label>
        Step:
        <input
          type="number"
          value={step}
          onInput={(e) => (step.value = parseInt(e.currentTarget.value))}
        />
      </label>

      <button onClick={() => (count.value -= step.value)}>-{step}</button>
      <button onClick={() => (count.value = 0)}>Reset</button>
      <button onClick={() => (count.value += step.value)}>+{step}</button>
    </div>
  );
}
```

### Computed Values

Add a computed signal for the doubled value:

```tsx
import { signal, computed } from "semajsx/signal";

function Counter() {
  const count = signal(0);
  // Computed requires explicit dependency array
  const doubled = computed([count], (c) => c * 2);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

## Next Steps

- Learn about [Computed Signals](/reference/signals#computed-signals)
- Build a [Todo App](/guides/building-a-todo-app)
- Explore the [Styling System](/guides/styling-examples)

<Callout type="tip" title="Challenge">
Try adding a history feature that tracks all previous values!
</Callout>
