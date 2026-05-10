---
title: Components
description: Learn how to create and use components in SemaJSX
order: 3
category: Core Concepts
---

# Components

Components are the building blocks of SemaJSX applications. They are simple functions that return JSX.

## Functional Components

In SemaJSX, components are just functions that return VNodes:

```tsx
/** @jsxImportSource semajsx/dom */

function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

// Usage
<Greeting name="Alice" />;
```

## Props

Props are passed as the first argument to component functions:

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

function Button({ label, onClick, variant = "primary" }: ButtonProps) {
  return (
    <button class={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
}
```

## Children

Access children via the `children` prop:

```tsx
interface CardProps {
  title: string;
  children: VNode | VNode[];
}

function Card({ title, children }: CardProps) {
  return (
    <div class="card">
      <h2>{title}</h2>
      <div class="card-content">{children}</div>
    </div>
  );
}

// Usage
<Card title="My Card">
  <p>Card content goes here</p>
</Card>;
```

## Reactive Components

Use signals to create reactive components:

```tsx
import { signal } from "semajsx/signal";

function Counter() {
  const count = signal(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => count.value++}>+1</button>
      <button onClick={() => count.value--}>-1</button>
    </div>
  );
}
```

## Composition

Compose components to build complex UIs:

```tsx
function UserProfile({ user }: { user: User }) {
  return (
    <Card title={user.name}>
      <Avatar src={user.avatar} />
      <Bio text={user.bio} />
      <SocialLinks links={user.social} />
    </Card>
  );
}
```

## Conditional Rendering

Use JavaScript expressions for conditional rendering:

```tsx
function LoginButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  return <div>{isLoggedIn ? <button>Logout</button> : <button>Login</button>}</div>;
}
```

## Lists

Map over arrays to render lists:

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          <input type="checkbox" checked={todo.done} />
          <span>{todo.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

<Callout type="warning" title="Keys are important">
Always provide a unique `key` prop when rendering lists to help SemaJSX identify items.
</Callout>

## Component API

Components can receive a second parameter with additional APIs:

```tsx
import { context } from "semajsx";

const ThemeContext = context<Theme>("theme");

function ThemedButton(props: ButtonProps, ctx) {
  const theme = ctx?.inject(ThemeContext) ?? defaultTheme;

  return <button style={{ background: theme.primary }}>{props.label}</button>;
}
```

## Best Practices

1. **Keep components small** - One component, one responsibility
2. **Use TypeScript** - Define prop interfaces for type safety
3. **Destructure props** - Make dependencies explicit
4. **Extract reusable logic** - Use composition over inheritance

## Next Steps

- Learn about [Context API](/reference/context) for state management
- Explore [DOM Rendering](/reference/dom-rendering) for refs and portals
- Check out the [Styling](/reference/styling) system
