/** @jsxImportSource @semajsx/dom */

import { signal } from "@semajsx/signal";
import { island } from "@semajsx/ssr/client";

/**
 * Counter island - interactive component that hydrates on client
 */
export const Counter = island(
  function Counter({ initial = 0 }: { initial?: number }) {
    const count = signal(initial);

    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          background: "#f3f4f6",
          borderRadius: "8px",
          margin: "8px 0",
        }}
      >
        <button
          onClick={() => count.value--}
          style={{
            width: "32px",
            height: "32px",
            border: "none",
            borderRadius: "4px",
            background: "#ef4444",
            color: "white",
            cursor: "pointer",
            fontSize: "18px",
          }}
        >
          -
        </button>
        <span
          style={{
            minWidth: "40px",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          {count}
        </span>
        <button
          onClick={() => count.value++}
          style={{
            width: "32px",
            height: "32px",
            border: "none",
            borderRadius: "4px",
            background: "#22c55e",
            color: "white",
            cursor: "pointer",
            fontSize: "18px",
          }}
        >
          +
        </button>
      </div>
    );
  },
  import.meta.url,
);
