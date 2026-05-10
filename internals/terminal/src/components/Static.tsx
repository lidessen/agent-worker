/** @jsxImportSource @semajsx/terminal */
import type { ComponentAPI, VNode } from "@semajsx/core";
import { getActiveSession } from "../context";
import { print } from "../render";
import type { ReadableSignal } from "@semajsx/signal";

export interface StaticProps<T> {
  /**
   * Signal holding an array of items. Only new items (appended to the end)
   * will be rendered. Previously rendered items are never updated.
   */
  items: ReadableSignal<T[]>;
  /**
   * Render function for each item. Must return a JSX element.
   * Called only once per item when it first appears.
   *
   * Passed as an explicit prop (not JSX children) because semajsx's
   * child normalization drops function children.
   */
  render: (item: T, index: number) => VNode;
}

/**
 * Static component — renders items permanently above dynamic content.
 *
 * Each item is rendered once and committed to the terminal output.
 * It will not be erased or re-rendered on subsequent updates.
 * Only new items appended to the `items` signal trigger rendering.
 *
 * This is useful for:
 * - Test runners showing completed tests
 * - Build logs showing completed steps
 * - Chat messages that shouldn't flicker on re-render
 *
 * @example
 * ```tsx
 * const logs = signal<string[]>([]);
 *
 * <Static
 *   items={logs}
 *   render={(log, i) => <text color="green">✔ {log}</text>}
 * />
 * <text dim>Processing...</text>
 * ```
 */
export interface StaticComponent {
  <T>(props: StaticProps<T>, ctx: ComponentAPI): VNode | null;
}

export const Static: StaticComponent = <T,>(
  { items, render: renderItem }: StaticProps<T>,
  ctx: ComponentAPI,
): VNode | null => {
  let renderedCount = 0;

  const flushNew = () => {
    const session = getActiveSession();
    if (!session?.renderer) return;

    const currentItems = items.value;
    const newItems = currentItems.slice(renderedCount);
    if (newItems.length === 0) return;

    const stream = session.renderer.getRoot().stream;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]!;
      const globalIndex = renderedCount + i;
      const element = renderItem(item, globalIndex);

      // Capture print output by intercepting stream.write
      const lines: string[] = [];
      const origWrite = stream.write;
      stream.write = ((chunk: any) => {
        const str = typeof chunk === "string" ? chunk : chunk.toString();
        // Filter out cursor hide/show sequences from print()
        const cleaned = str.replace(/\x1b\[\?25[lh]/g, "").replace(/\n$/, "");
        if (cleaned) lines.push(cleaned);
        return true;
      }) as any;

      try {
        print(element, { stream });
      } finally {
        stream.write = origWrite;
      }

      if (lines.length > 0) {
        session.renderer.commitStaticOutput(lines.join("\n"));
      }
    }

    renderedCount = currentItems.length;
  };

  // Subscribe to the signal so we flush when items change
  const unsub = items.subscribe(() => {
    // Defer to next microtask so the signal value is settled
    queueMicrotask(flushNew);
  });

  ctx.onCleanup(unsub);

  // Flush any initial items
  flushNew();

  // Return nothing — static items are committed directly to the terminal
  return null;
};
