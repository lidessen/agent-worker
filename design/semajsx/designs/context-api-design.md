# Context API Design

## Overview

Context provides a way to pass data through the component tree without having to pass props down manually at every level (avoiding "prop drilling").

## Core Principles

1. **Context is a pure value container** - It does not manage reactivity
2. **Users control reactivity** - Choose to pass static values or Signals
3. **Async-safe** - Context is naturally captured by function parameters
4. **No global pollution** - Context is passed through the render tree
5. **Backward compatible** - Existing components work unchanged
6. **Explicit over implicit** - Users control default values with `??`

## API Design

### Creating Context

Context is created with the `context<T>()` function, which returns a typed Symbol:

```typescript
import { context } from "semajsx/runtime";

// Create context (returns typed Symbol)
const ThemeContext = context<Theme>();
const UserContext = context<User>("user"); // with debug name
```

**Parameters:**

- `name?: string` - Optional debug name (defaults to "anonymous")

**Returns:**

- `Context<T>` - A typed Symbol for identifying the context

### Providing Context

Use the unified `<Context>` component to provide context values:

```typescript
import { Context } from 'semajsx/runtime';

// Single context
<Context provide={[ThemeContext, theme]}>
  <App />
</Context>

// Multiple contexts (no nesting needed!)
<Context provide={[
  [ThemeContext, theme],
  [UserContext, user],
  [ConfigContext, config]
]}>
  <App />
</Context>
```

**Props:**

- `provide` - Either `[Context, value]` or array of `[[Context, value], ...]`
- `children` - Child components

### Injecting Context

Components access context via the second parameter `ctx`:

```typescript
function MyComponent(props, ctx) {
  // inject returns T | undefined
  const theme = ctx.inject(ThemeContext) ?? defaultTheme;
  const user = ctx.inject(UserContext);

  return <div class={theme.mode}>{user?.name}</div>;
}
```

**ComponentAPI:**

```typescript
interface ComponentAPI {
  inject<T>(context: Context<T>): T | undefined;
}
```

**Returns:**

- The context value if provided
- `undefined` if not provided

**Users control defaults** with the nullish coalescing operator `??`:

```typescript
const theme = ctx.inject(ThemeContext) ?? { mode: "light" };
```

## Complete Example

```typescript
import { context, Context } from "semajsx/runtime";
import { signal } from "semajsx/signal";

// Create contexts
const ThemeContext = context<Theme>("theme");
const UserContext = context<User>("user");

// App provides multiple contexts
function App() {
  const theme = signal({ mode: "light" });
  const user = { id: 1, name: "Alice" };

  return (
    <Context
      provide={[
        [ThemeContext, theme],
        [UserContext, user],
      ]}
    >
      <Header />
      <Content />
    </Context>
  );
}

// Component injects contexts
function Header(props, ctx) {
  const theme = ctx.inject(ThemeContext) ?? signal({ mode: "light" });
  const user = ctx.inject(UserContext);

  return (
    <header style={{ color: theme.value.mode === "dark" ? "#fff" : "#000" }}>
      Welcome, {user?.name}!
    </header>
  );
}
```

## Key Features

### 1. Simplified API

**No more nesting:**

```typescript
// ❌ Old: Multiple nested providers
<ThemeContext.Provider value={theme}>
  <UserContext.Provider value={user}>
    <ConfigContext.Provider value={config}>
      <App />
    </ConfigContext.Provider>
  </UserContext.Provider>
</ThemeContext.Provider>

// ✅ New: Single Context component
<Context provide={[
  [ThemeContext, theme],
  [UserContext, user],
  [ConfigContext, config]
]}>
  <App />
</Context>
```

### 2. Explicit Defaults

Users control defaults explicitly with `??`:

```typescript
function MyComponent(props, ctx) {
  // User decides the default value
  const theme = ctx.inject(ThemeContext) ?? { mode: "light" };

  // Or check if provided
  const user = ctx.inject(UserContext);
  if (!user) return <div>Please log in</div>;

  return <div>{user.name}</div>;
}
```

### 3. Signal Integration

Context values can be Signals for reactive updates:

```typescript
const ThemeContext = context<Signal<Theme>>("theme");

function App() {
  const themeSignal = signal({ mode: "light" });

  const toggleTheme = () => {
    themeSignal.value = {
      ...themeSignal.value,
      mode: themeSignal.value.mode === "light" ? "dark" : "light",
    };
  };

  return (
    <Context provide={[ThemeContext, themeSignal]}>
      <button onClick={toggleTheme}>Toggle</button>
      <ThemedComponent />
    </Context>
  );
}

function ThemedComponent(props, ctx) {
  const themeSignal = ctx.inject(ThemeContext);

  if (!themeSignal) return <div>No theme</div>;

  // Signal auto-updates in JSX
  return (
    <div
      style={{
        background: themeSignal.value.mode === "dark" ? "#333" : "#fff",
      }}
    >
      Theme: {themeSignal.value.mode}
    </div>
  );
}
```

### 4. Async Safety

Context is captured in function parameters, making it safe for async components:

```typescript
const UserContext = context<User>("user");

async function AsyncProfile(props, ctx) {
  // Context captured immediately
  const user = ctx.inject(UserContext);

  if (!user) return <div>No user</div>;

  // Safe to await - user is captured
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const data = await fetchUserData(user.id);

  // user is still the same value from when component was called
  return <div>{data.name}</div>;
}
```

### 5. Nested Context (Override)

Nested `<Context>` components override parent values:

```typescript
const ThemeContext = context<string>("theme");

function App() {
  return (
    <Context provide={[ThemeContext, "light"]}>
      <div>Light theme</div>

      {/* Override theme for this subtree */}
      <Context provide={[ThemeContext, "dark"]}>
        <div>Dark theme</div>
      </Context>

      <div>Back to light theme</div>
    </Context>
  );
}
```

## Type Definitions

```typescript
// Context - a typed Symbol
export type Context<T> = symbol & { __type?: T };

// Single or multiple context provides
export type ContextProvide<T = any> = [Context<T>, T];

export interface ContextProps {
  provide: ContextProvide | ContextProvide[];
  children?: JSXChildren;
}

// ComponentAPI with inject
export interface ComponentAPI {
  inject<T>(context: Context<T>): T | undefined;
}

// Component type with optional second parameter
export type Component<P = any> = (props: P, ctx?: ComponentAPI) => JSXNode;
```

## Implementation

### Context Creation

```typescript
// src/runtime/context.ts

export function context<T>(name?: string): Context<T> {
  const debugName = name || "anonymous";
  return Symbol(debugName) as Context<T>;
}

export function Context(props: ContextProps) {
  const children = props.children
    ? Array.isArray(props.children)
      ? props.children
      : [props.children]
    : [];
  return h(Fragment, null, ...children);
}

// Mark as special provider
(Context as any).__isContextProvider = true;

export function createComponentAPI(contextMap: ContextMap): ComponentAPI {
  return {
    inject<T>(context: Context<T>): T | undefined {
      return contextMap.get(context);
    },
  };
}
```

### Rendering Integration

```typescript
// src/dom/render.ts

function renderComponent(vnode: VNode, parentContext: ContextMap) {
  const Component = vnode.type;
  const props = { ...vnode.props, children: vnode.children };

  let currentContext = parentContext;

  // Check if this is Context provider
  const isContextProvider = (Component as any).__isContextProvider;

  if (isContextProvider) {
    currentContext = new Map(parentContext);
    const provide = (props as any).provide;

    if (provide) {
      // Single: [Context, value]
      // Multiple: [[Context, value], ...]
      const isSingle = provide.length === 2 && typeof provide[0] === "symbol";

      if (isSingle) {
        const [context, value] = provide;
        currentContext.set(context, value);
      } else {
        for (const [context, value] of provide) {
          currentContext.set(context, value);
        }
      }
    }
  }

  // Create ComponentAPI
  const ctx = createComponentAPI(currentContext);

  // Call component with props and ctx
  const result = Component(props, ctx);

  // ... handle result (VNode, Signal, Promise, AsyncIterator)
}
```

## Advantages

### 1. ✅ Simpler API

- One function: `context<T>()`
- One component: `<Context>`
- No complex Provider objects

### 2. ✅ Less Nesting

Provide multiple contexts in one component:

```typescript
<Context provide={[
  [ThemeContext, theme],
  [UserContext, user],
  [SettingsContext, settings]
]}>
```

### 3. ✅ Explicit Defaults

No hidden `defaultValue` - users control defaults:

```typescript
const theme = ctx.inject(ThemeContext) ?? defaultTheme;
```

### 4. ✅ Async-Safe

Function parameters are naturally captured:

```typescript
async function AsyncComp(props, ctx) {
  const user = ctx.inject(UserContext);
  await fetchData();
  // user is still captured
}
```

### 5. ✅ Type-Safe

Full TypeScript inference:

```typescript
const ThemeContext = context<Theme>();

function MyComponent(props, ctx) {
  const theme = ctx.inject(ThemeContext);
  // ^? Theme | undefined
}
```

### 6. ✅ Backward Compatible

Second parameter is optional:

```typescript
// No context - works unchanged
function Button(props) {
  return <button>{props.label}</button>;
}

// With context
function ThemedButton(props, ctx) {
  const theme = ctx.inject(ThemeContext);
  return <button class={theme?.mode}>{props.label}</button>;
}
```

### 7. ✅ Extensible

`ComponentAPI` can grow:

```typescript
interface ComponentAPI {
  inject<T>(context: Context<T>): T | undefined;

  // Future:
  // onCleanup(fn: () => void): void;
  // emit(event: string, data: any): void;
}
```

## Performance

### O(1) Context Lookup

Using `Map` for constant-time lookup:

```typescript
ctx.inject(ThemeContext); // O(1) via Map.get()
```

### No Unnecessary Re-renders

Context itself doesn't trigger re-renders. Use Signals for reactivity:

```typescript
function ThemedComponent(props, ctx) {
  const themeSignal = ctx.inject(ThemeContext);

  // Automatic subscription via Signal in JSX
  return <div>{themeSignal.value.mode}</div>;
}
```

### Memory Efficiency

- Context maps are shared when possible
- Only cloned when Context component overrides values
- `ComponentAPI` instances are lightweight

## Comparison with React

| Feature      | React Context              | SemaJSX Context                |
| ------------ | -------------------------- | ------------------------------ |
| Create       | `createContext(default)`   | `context<T>()`                 |
| Provide      | `<Ctx.Provider value={v}>` | `<Context provide={[Ctx, v]}>` |
| Multiple     | Nested Providers           | Single `provide` array         |
| Consume      | `useContext(Ctx)`          | `ctx.inject(Ctx)`              |
| Default      | In `createContext`         | User controls with `??`        |
| Async-safe   | ❌ Hook rules              | ✅ Parameters                  |
| Global state | ✅ Uses                    | ❌ None                        |
| API count    | 2 (create, use)            | 2 (context, inject)            |

## Migration Guide

### From Old API

If migrating from a previous API:

```typescript
// Old
const ThemeContext = createContext({ mode: 'light' });
<ThemeContext.Provider value={theme}>

// New
const ThemeContext = context<Theme>('theme');
<Context provide={[ThemeContext, theme]}>
```

### Usage in Components

```typescript
// Old
function MyComponent(props, ctx) {
  const theme = ctx.inject(ThemeContext);
  // theme was Theme (had defaultValue)
}

// New
function MyComponent(props, ctx) {
  const theme = ctx.inject(ThemeContext) ?? defaultTheme;
  // theme can be undefined, use ?? for default
}
```

## Best Practices

### 1. Name Your Contexts

```typescript
// ✅ Good
const ThemeContext = context<Theme>("theme");
const UserContext = context<User>("user");

// ⚠️ Works but harder to debug
const ThemeContext = context<Theme>();
```

### 2. Use `??` for Defaults

```typescript
// ✅ Good - explicit default
const theme = ctx.inject(ThemeContext) ?? { mode: "light" };

// ⚠️ Less clear
const theme = ctx.inject(ThemeContext) || { mode: "light" };
```

### 3. Check for Undefined

```typescript
// ✅ Good - handle missing context
function MyComponent(props, ctx) {
  const user = ctx.inject(UserContext);
  if (!user) return <div>Please log in</div>;

  return <div>{user.name}</div>;
}
```

### 4. Use Signals for Reactivity

```typescript
// ✅ Good - reactive theme
const ThemeContext = context<Signal<Theme>>("theme");

function App() {
  const theme = signal({ mode: "light" });
  return <Context provide={[ThemeContext, theme]}>...</Context>;
}
```

### 5. Group Related Contexts

```typescript
// ✅ Good - provide together
<Context
  provide={[
    [ThemeContext, theme],
    [LocaleContext, locale],
    [UserContext, user],
  ]}
>
  <App />
</Context>
```

## Summary

SemaJSX's Context API provides a **simple, explicit, and type-safe** way to pass data through component trees:

- **`context<T>(name?)`** - Create typed Symbol
- **`<Context provide={...}>`** - Provide values (single or multiple)
- **`ctx.inject(Context)`** - Access values (returns `T | undefined`)
- **Users control defaults** with `??`
- **Async-safe** via function parameters
- **No global state** - passed through render tree
- **Fully type-safe** with TypeScript inference

This design is more **functional and explicit** than React's Context API, aligning with SemaJSX's philosophy of user control and fine-grained reactivity.
