/** @jsxImportSource @semajsx/dom */

import { signal, computed } from "@semajsx/signal";
import { island } from "@semajsx/ssr/client";

/**
 * Pagination component - returns a Fragment (no wrapper element)
 * This tests fragment island hydration with comment markers
 */
export const Pagination = island(
  function Pagination({ total = 5 }: { total?: number }) {
    const current = signal(1);
    const isPrevDisabled = computed(current, (c) => c === 1);
    const isNextDisabled = computed(current, (c) => c === total);

    // Return a fragment - multiple elements without a wrapper
    return (
      <>
        <button onClick={() => current.value > 1 && current.value--} disabled={isPrevDisabled}>
          ← Prev
        </button>
        <span
          style={{
            padding: "8px 16px",
            fontWeight: "bold",
          }}
        >
          Page {current} of {total}
        </span>
        <button onClick={() => current.value < total && current.value++} disabled={isNextDisabled}>
          Next →
        </button>
      </>
    );
  },
  import.meta.url,
);
