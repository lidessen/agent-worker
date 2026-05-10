/** @jsxImportSource @semajsx/dom */

import { signal } from "@semajsx/signal";
import { when } from "@semajsx/core";
import { island } from "@semajsx/ssr/client";

/**
 * Async component - simple async function
 * Simulates data fetching before rendering
 */
export const AsyncCounter = island(
  async function AsyncCounter({ delay = 100 }: { delay?: number }) {
    // Simulate async data fetching
    await new Promise((resolve) => setTimeout(resolve, delay));

    const count = signal(0);

    return (
      <div
        style={{
          padding: "15px",
          border: "2px solid #10b981",
          borderRadius: "8px",
          margin: "10px 0",
          background: "#ecfdf5",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", color: "#059669" }}>
          Async Component (loaded after {delay}ms)
        </h4>
        <p>
          Count: <strong>{count}</strong>
        </p>
        <button
          onClick={() => count.value++}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Increment
        </button>
      </div>
    );
  },
  import.meta.url,
);

/**
 * Async iterator component - yields multiple states
 * Like a progress loader that shows stages
 */
export const StreamingComponent = island(
  async function* StreamingComponent({ total = 3 }: { total?: number }) {
    for (let i = 0; i <= total; i++) {
      yield (
        <div
          style={{
            padding: "15px",
            border: "2px solid #f59e0b",
            borderRadius: "8px",
            margin: "10px 0",
            background: "#fffbeb",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#d97706" }}>Streaming Component</h4>
          <p>
            Progress: {i}/{total}
          </p>
          <div
            style={{
              background: "#fde68a",
              height: "8px",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#f59e0b",
                height: "100%",
                width: `${(i / total) * 100}%`,
              }}
            />
          </div>
        </div>
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  },
  import.meta.url,
);

/**
 * Component that uses signals for reactive text updates
 */
export const SignalComponent = island(
  function SignalComponent({ initial = "Hello" }: { initial?: string }) {
    const message = signal(initial);

    return (
      <div
        style={{
          padding: "15px",
          border: "2px solid #8b5cf6",
          borderRadius: "8px",
          margin: "10px 0",
          background: "#f5f3ff",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", color: "#7c3aed" }}>Signal Component</h4>
        <p>
          Message: <strong>{message}</strong>
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => (message.value = "Hello")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Say Hello
          </button>
          <button
            onClick={() => (message.value = "Goodbye")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Say Goodbye
          </button>
          <button
            onClick={() => (message.value = "SemaJSX!")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            SemaJSX!
          </button>
        </div>
      </div>
    );
  },
  import.meta.url,
);

/**
 * Conditional rendering component
 * Tests islands with conditional content
 */
export const ConditionalComponent = island(
  function ConditionalComponent({ showInitially = true }: { showInitially?: boolean }) {
    const isVisible = signal(showInitially);

    return (
      <div
        style={{
          padding: "15px",
          border: "2px solid #ec4899",
          borderRadius: "8px",
          margin: "10px 0",
          background: "#fdf2f8",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", color: "#db2777" }}>Conditional Component</h4>
        <button
          onClick={() => (isVisible.value = !isVisible.value)}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            background: "#ec4899",
            color: "white",
            border: "none",
            borderRadius: "4px",
            marginBottom: "10px",
          }}
        >
          Toggle Content
        </button>
        {when(
          isVisible,
          <div
            style={{
              padding: "10px",
              background: "white",
              borderRadius: "4px",
              border: "1px solid #f9a8d4",
            }}
          >
            <p style={{ margin: 0 }}>This content is conditionally rendered!</p>
          </div>,
        )}
      </div>
    );
  },
  import.meta.url,
);
