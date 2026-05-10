import type { JSXNode } from "./types";
import type { Signal } from "@semajsx/signal";
import { computed, signal } from "@semajsx/signal";

/**
 * Conditional rendering helper
 *
 * Renders content when condition signal is true, nothing when false.
 *
 * @example
 * // With VNode
 * const hint = when(showHint, <text>Press Ctrl+C to exit</text>);
 *
 * @example
 * // With function (lazy evaluation)
 * const hint = when(showHint, () => <text>Press Ctrl+C to exit</text>);
 */
export function when(
  condition: Signal<boolean>,
  content: JSXNode | (() => JSXNode),
): Signal<JSXNode | null> {
  return computed([condition], (show) => {
    if (!show) return null;
    return typeof content === "function" ? content() : content;
  });
}

/**
 * Async resource helper for Promise<VNode>
 *
 * Renders pending content (or null) while the promise is pending, then renders
 * the resolved VNode. Handle errors in the promise itself using .catch().
 *
 * @example
 * // Handle everything in the promise
 * const content = resource(
 *   fetchData()
 *     .then(data => <text>{data}</text>)
 *     .catch(err => <text color="red">Error: {err.message}</text>)
 * );
 *
 * @example
 * // With optional pending content
 * const content = resource(
 *   fetchData().then(data => <text>{data}</text>),
 *   <text>Loading...</text>
 * );
 */
export function resource(promise: Promise<JSXNode>, pending?: JSXNode): Signal<JSXNode | null> {
  const content = signal<JSXNode | null>(pending || null);

  promise
    .then((result) => {
      content.value = result;
    })
    .catch((err) => {
      console.error("Unhandled promise rejection in resource():", err);
    });

  return content;
}

/**
 * Async stream helper for AsyncIterable<VNode>
 *
 * Renders each yielded VNode from the async iterator, replacing the previous
 * content with each new value.
 *
 * @example
 * async function* generateContent() {
 *   yield <text>Loading...</text>;
 *   const data = await fetchData();
 *   yield <text>Data: {data}</text>;
 * }
 *
 * const content = stream(generateContent());
 */
export function stream(
  iterator: AsyncIterable<JSXNode>,
  pending?: JSXNode,
): Signal<JSXNode | null> {
  const content = signal<JSXNode | null>(pending || null);

  (async () => {
    try {
      for await (const vnode of iterator) {
        content.value = vnode;
      }
    } catch (err) {
      console.error("Error in stream():", err);
    }
  })();

  return content;
}
