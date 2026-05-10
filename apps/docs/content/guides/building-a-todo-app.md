---
title: Building a Todo App
description: Build a full todo application with signals, events, and computed values
order: 3
difficulty: intermediate
---

# Building a Todo App

Build a complete todo application to learn signals, computed values, event handling, and list rendering.

## What You'll Learn

- Managing a list of items with signals
- Computed values for filtering and counting
- Event handling for forms
- Conditional rendering
- Keyed list reconciliation

## Setup

```bash
mkdir my-todo-app
cd my-todo-app
bun init -y
bun add semajsx
```

## Step 1: Define the Data Model

Create `app.tsx`:

```tsx
/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { render } from "semajsx/dom";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let nextId = 1;
const todos = signal<Todo[]>([]);
const filter = signal<"all" | "active" | "completed">("all");
```

## Step 2: Add Computed Filters

```tsx
const filteredTodos = computed([todos, filter], (list, f) => {
  if (f === "active") return list.filter((t) => !t.done);
  if (f === "completed") return list.filter((t) => t.done);
  return list;
});

const remaining = computed([todos], (list) => list.filter((t) => !t.done).length);
```

## Step 3: Build the Input

```tsx
function TodoInput() {
  const text = signal("");

  function addTodo(e: Event) {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) return;

    todos.value = [...todos.value, { id: nextId++, text: value, done: false }];
    text.value = "";
  }

  return (
    <form onSubmit={addTodo} style="display: flex; gap: 8px; margin-bottom: 16px;">
      <input
        type="text"
        value={text}
        onInput={(e) => (text.value = e.currentTarget.value)}
        placeholder="What needs to be done?"
        style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px;"
      />
      <button
        type="submit"
        style="padding: 8px 16px; background: #0071e3; color: white; border: none; border-radius: 6px; cursor: pointer;"
      >
        Add
      </button>
    </form>
  );
}
```

## Step 4: Build the Todo Item

```tsx
function TodoItem({ todo }: { todo: Todo }) {
  function toggle() {
    todos.value = todos.value.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t));
  }

  function remove() {
    todos.value = todos.value.filter((t) => t.id !== todo.id);
  }

  return (
    <li
      key={todo.id}
      style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee;"
    >
      <input type="checkbox" checked={todo.done} onChange={toggle} />
      <span style={`flex: 1; ${todo.done ? "text-decoration: line-through; color: #999;" : ""}`}>
        {todo.text}
      </span>
      <button
        onClick={remove}
        style="background: none; border: none; color: #ff453a; cursor: pointer;"
      >
        Delete
      </button>
    </li>
  );
}
```

## Step 5: Build the Filters

```tsx
function Filters() {
  const options: Array<"all" | "active" | "completed"> = ["all", "active", "completed"];

  return (
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      {options.map((f) => (
        <button
          key={f}
          onClick={() => (filter.value = f)}
          style={`padding: 4px 12px; border: 1px solid #ddd; border-radius: 980px; cursor: pointer; background: ${filter.value === f ? "#0071e3" : "transparent"}; color: ${filter.value === f ? "white" : "#333"};`}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      ))}
    </div>
  );
}
```

## Step 6: Compose the App

```tsx
function App() {
  return (
    <div style="max-width: 480px; margin: 40px auto; font-family: -apple-system, sans-serif;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">Todo App</h1>
      <TodoInput />
      <Filters />
      <ul style="list-style: none; padding: 0;">
        {filteredTodos.value.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
      <p style="color: #6e6e73; font-size: 14px; margin-top: 16px;">{remaining} items remaining</p>
    </div>
  );
}

render(<App />, document.getElementById("app")!);
```

## Step 7: Run It

Create `index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./app.tsx"></script>
  </body>
</html>
```

```bash
bun add -d vite
bunx vite
```

<Callout type="success" title="It works!">
You now have a fully functional todo app with filtering, counting, and fine-grained updates!
</Callout>

## Key Takeaways

1. **Immutable updates** — Always replace the signal value (e.g., `todos.value = [...todos.value, newItem]`), don't mutate
2. **Computed values** — Derived state recalculates automatically when dependencies change
3. **Fine-grained** — Only the changed text nodes and attributes update, not the entire list
4. **Keys** — Use `key` on list items for efficient reconciliation

## Next Steps

- Add persistence with `localStorage`
- Style with [@semajsx/style](/reference/styling) or [Tailwind utilities](/reference/tailwind)
- Try building a [Counter App](/guides/building-a-counter) if you haven't already
