# @semajsx/core

Core runtime for SemaJSX - VNode system, JSX transformation, and rendering primitives.

## Installation

```bash
bun add @semajsx/core
```

## Features

- **VNode System** - Virtual node representation for UI elements
- **JSX Transformation** - JSX to VNode conversion
- **Context API** - Component context for dependency injection
- **Rendering Primitives** - Core rendering logic for DOM and Terminal
- **Helper Functions** - Utilities for async data, streams, and conditional rendering

## Usage

### Creating VNodes

```typescript
import { h, createFragment, createTextVNode } from "@semajsx/core";

// Create element VNode
const element = h("div", { className: "container" }, "Hello");

// Create fragment
const fragment = createFragment([h("h1", null, "Title"), h("p", null, "Content")]);

// Create text node
const text = createTextVNode("Hello World");
```

### Context API

```typescript
import { context, Context } from "@semajsx/core";

// Create a context
const ThemeContext = context<"light" | "dark">("light");

// Provide context value
function App() {
  return (
    <Context.Provider for={ThemeContext} value="dark">
      <Child />
    </Context.Provider>
  );
}

// Consume context
function Child() {
  const theme = Context.consume(ThemeContext);
  return <div>Theme: {theme}</div>;
}
```

### Helper Functions

#### `when` - Conditional rendering

```typescript
import { signal, when } from "@semajsx/core";

const isLoggedIn = signal(false);

const view = when(
  isLoggedIn,
  () => <div>Welcome back!</div>,
  () => <div>Please log in</div>,
);
```

#### `resource` - Async data fetching

```typescript
import { resource } from "@semajsx/core";

const [data] = resource(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// Use in component
<div>{data() || "Loading..."}</div>;
```

#### `stream` - Async iterables

```typescript
import { stream } from "@semajsx/core";

async function* counter() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    yield i;
  }
}

const [count] = stream(counter);

// Use in component
<div>Count: {count()}</div>;
```

## API

### VNode Creation

- `h(type, props, ...children)` - Create a VNode
- `createFragment(children)` - Create a fragment VNode
- `createTextVNode(text)` - Create a text VNode
- `isVNode(value)` - Check if value is a VNode

### Context

- `context<T>(defaultValue)` - Create a context
- `Context.Provider` - Provide context value
- `Context.consume(ctx)` - Consume context value

### Helpers

- `when(condition, then, otherwise)` - Conditional rendering
- `resource(fetcher, options)` - Async data fetching
- `stream(iterable, options)` - Async iterable to signal

### Types

- `VNode` - Virtual node type
- `Component<P>` - Component function type
- `JSXNode` - Valid JSX node types
- `Context<T>` - Context type
- `Ref<T>` - Reference type

## License

MIT
