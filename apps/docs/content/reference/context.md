---
title: Context API
description: Share state across components without prop drilling
order: 9
category: Core Concepts
---

# Context API

SemaJSX's Context API lets you pass data through the component tree without explicitly passing props at every level.

## Creating a Context

```tsx
import { context } from "semajsx";

// Create a typed context with a descriptive name
const ThemeContext = context<"light" | "dark">("theme");
const UserContext = context<{ name: string; role: string }>("user");
```

## Providing Values

Use the `<Context>` component to provide values to descendants:

```tsx
/** @jsxImportSource semajsx/dom */

import { Context } from "semajsx";

function App() {
  return (
    <Context provide={[ThemeContext, "dark"]}>
      <Dashboard />
    </Context>
  );
}
```

Provide multiple contexts at once:

```tsx
<Context
  provide={[
    [ThemeContext, "dark"],
    [UserContext, { name: "Alice", role: "admin" }],
  ]}
>
  <App />
</Context>
```

## Consuming Values

Access context in the second parameter of your component function:

```tsx
function ThemedButton(props, ctx) {
  const theme = ctx?.inject(ThemeContext) ?? "light";

  return (
    <button style={`background: ${theme === "dark" ? "#333" : "#fff"}`}>{props.children}</button>
  );
}
```

<Callout type="info" title="The ctx parameter">
The second parameter `ctx` is a `ComponentAPI` object. It may be `undefined` if the component is rendered outside of the context system, so always use optional chaining.
</Callout>

## Nested Contexts

Inner providers override outer ones for the same context:

```tsx
<Context provide={[ThemeContext, "light"]}>
  <Header /> {/* receives "light" */}
  <Context provide={[ThemeContext, "dark"]}>
    <Sidebar /> {/* receives "dark" */}
  </Context>
</Context>
```

## Practical Example: Theme Provider

```tsx
/** @jsxImportSource semajsx/dom */

import { context, Context } from "semajsx";
import { signal } from "semajsx/signal";

interface Theme {
  bg: string;
  text: string;
  primary: string;
}

const ThemeCtx = context<Theme>("app-theme");

const lightTheme: Theme = { bg: "#fff", text: "#1d1d1f", primary: "#0071e3" };
const darkTheme: Theme = { bg: "#000", text: "#f5f5f7", primary: "#2997ff" };

function ThemeProvider({ dark, children }) {
  const theme = dark ? darkTheme : lightTheme;

  return <Context provide={[ThemeCtx, theme]}>{children}</Context>;
}

function Card(props, ctx) {
  const theme = ctx?.inject(ThemeCtx) ?? lightTheme;

  return (
    <div
      style={`background: ${theme.bg}; color: ${theme.text}; padding: 1rem; border-radius: 12px;`}
    >
      {props.children}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider dark>
      <Card>
        <h2>Dark Mode Card</h2>
        <p>Styled by context.</p>
      </Card>
    </ThemeProvider>
  );
}
```

## Next Steps

- Learn about [Components](/reference/components) and composition
- Explore [Signals](/reference/signals) for reactive state
- Check out [DOM Rendering](/reference/dom-rendering) for the full rendering API
