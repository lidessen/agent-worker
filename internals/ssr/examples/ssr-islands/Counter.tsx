/** @jsxImportSource @semajsx/dom */

import { signal } from "@semajsx/signal";
import { island } from "@semajsx/ssr/client";

/**
 * Counter component - marked as an island for client-side hydration
 */
export const Counter = island(
  function Counter({ initial = 0 }: { initial?: number }) {
    const count = signal(initial);

    return (
      <div
        style={{
          padding: "20px",
          border: "2px solid #3b82f6",
          borderRadius: "8px",
          margin: "10px 0",
        }}
      >
        <h3>Interactive Counter (Island)</h3>
        <p>
          Current count: <strong>{count}</strong>
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => count.value++}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Increment
          </button>
          <button
            onClick={() => count.value--}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Decrement
          </button>
          <button
            onClick={() => (count.value = 0)}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>
    );
  },
  import.meta.url,
);
