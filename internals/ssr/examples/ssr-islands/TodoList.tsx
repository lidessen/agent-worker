/** @jsxImportSource @semajsx/dom */

import { signal, computed } from "@semajsx/signal";
import { island } from "@semajsx/ssr/client";

/**
 * TodoList component - marked as an island for client-side hydration
 */
export const TodoList = island(
  function TodoList() {
    const todos = signal<string[]>([]);
    const input = signal("");

    const addTodo = () => {
      if (input.value.trim()) {
        todos.value = [...todos.value, input.value.trim()];
        input.value = "";
      }
    };

    const removeTodo = (index: number) => {
      todos.value = todos.value.filter((_, i) => i !== index);
    };

    // Use computed to make the todo list reactive
    // Signal<Array<VNode>> is now supported - automatically wrapped in Fragment
    const todoItems = computed(todos, (todoList) =>
      todoList.map((todo, index) => (
        <li
          key={index}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px",
            margin: "5px 0",
            background: "#f3f4f6",
            borderRadius: "4px",
          }}
        >
          <span>{todo}</span>
          <button
            onClick={() => removeTodo(index)}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Delete
          </button>
        </li>
      )),
    );

    // Use computed for conditional rendering based on todos
    const emptyMessage = computed(todos, (todoList) =>
      todoList.length === 0 ? (
        <p style={{ color: "#6b7280", textAlign: "center" }}>No todos yet. Add one above!</p>
      ) : null,
    );

    return (
      <div
        style={{
          padding: "20px",
          border: "2px solid #10b981",
          borderRadius: "8px",
          margin: "10px 0",
        }}
      >
        <h3>Interactive Todo List (Island)</h3>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            value={input}
            onInput={(e) => (input.value = (e.target as HTMLInputElement).value)}
            onKeyPress={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a new todo..."
            style={{ flex: "1", padding: "10px", fontSize: "16px" }}
          />
          <button
            onClick={addTodo}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: "0" }}>{todoItems}</ul>
        {emptyMessage}
      </div>
    );
  },
  import.meta.url,
);
