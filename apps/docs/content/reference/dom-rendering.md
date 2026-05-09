---
title: DOM Rendering
description: Learn how SemaJSX renders JSX to the DOM with fine-grained reactivity
order: 4
category: Core Concepts
---

# DOM Rendering

`semajsx/dom` provides the rendering engine that turns JSX into real DOM nodes. Unlike virtual DOM frameworks, SemaJSX updates the DOM directly through signal subscriptions.

## The `render` Function

Mount a component tree to a DOM container:

```tsx
/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";

function App() {
  return <h1>Hello, SemaJSX!</h1>;
}

const { unmount } = render(<App />, document.getElementById("app")!);

// Later: clean up
unmount();
```

`render()` returns an object with an `unmount` method for cleanup.

## JSX Runtime

Configure your project to use the SemaJSX JSX runtime:

<Tabs defaultValue="pragma">
<TabList>
<Tab value="pragma">Per-file pragma</Tab>
<Tab value="tsconfig">tsconfig.json</Tab>
</TabList>
<TabPanel value="pragma">

```tsx
/** @jsxImportSource semajsx/dom */

function App() {
  return <div>This file uses SemaJSX</div>;
}
```

</TabPanel>
<TabPanel value="tsconfig">

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "semajsx/dom"
  }
}
```

</TabPanel>
</Tabs>

## Signal Bindings

When a signal is used in JSX, SemaJSX automatically subscribes to it and updates only the affected DOM node:

```tsx
import { signal } from "semajsx/signal";

function Timer() {
  const elapsed = signal(0);
  setInterval(() => elapsed.value++, 1000);

  return (
    <div>
      {/* Only this text node updates each second */}
      <p>Elapsed: {elapsed}s</p>
    </div>
  );
}
```

Signals work in attributes too:

```tsx
const color = signal("red");

<div style={`color: ${color}`}>Reactive style</div>;
```

## Event Handling

Attach event handlers with `on*` props:

```tsx
function Form() {
  const name = signal("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        alert(name.value);
      }}
    >
      <input type="text" value={name} onInput={(e) => (name.value = e.currentTarget.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Refs

Access underlying DOM elements with refs:

```tsx
import { signal } from "semajsx/signal";

function FocusInput() {
  const inputRef = signal<HTMLInputElement | null>(null);

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={() => inputRef.value?.focus()}>Focus input</button>
    </div>
  );
}
```

## Portals

Render children into a different DOM node:

```tsx
import { createPortal } from "semajsx/dom";

function Modal({ children }) {
  return createPortal(
    <div class="modal-overlay">{children}</div>,
    document.getElementById("modal-root")!,
  );
}
```

## Async Rendering

`render()` supports promises and async iterators:

```tsx
// Promise-based
const AsyncComponent = async () => {
  const data = await fetch("/api/data").then((r) => r.json());
  return <div>{data.message}</div>;
};

render(<AsyncComponent />, container);
```

## Conditional Rendering with `when`

Use the `when` helper for signal-driven conditional rendering:

```tsx
import { signal } from "semajsx/signal";
import { when } from "semajsx";

function Toggle() {
  const visible = signal(true);

  return (
    <div>
      <button onClick={() => (visible.value = !visible.value)}>Toggle</button>
      {when(visible, <p>Now you see me!</p>)}
    </div>
  );
}
```

## Next Steps

- Learn about [Signals](/reference/signals) for reactive state
- Explore [Styling](/reference/styling) for component styling
- Check out [SSR](/reference/ssr) for server-side rendering
