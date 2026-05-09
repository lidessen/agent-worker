/** @jsxImportSource @semajsx/prompt */

import type { JSXNode } from "@semajsx/core";
import type { ReadableSignal, Signal } from "@semajsx/signal";
import { computed, signal } from "@semajsx/signal";

export interface WindowPage<T> {
  items: T[];
  total: number;
}

export type WindowFetcher<T> = (offset: number, size: number) => Promise<WindowPage<T>>;

export interface WindowProps<T> {
  /**
   * Section title. When provided, wraps content in a <section>.
   */
  title?: string;
  /**
   * In-memory mode: signal containing all items. Window slices automatically.
   */
  of?: ReadableSignal<T[]>;
  /**
   * Async mode: fetcher called when offset changes.
   * Returns { items, total } for the requested page.
   */
  fetch?: WindowFetcher<T>;
  /**
   * Number of items per page
   */
  size: number;
  /**
   * Current scroll offset signal
   */
  offset: Signal<number>;
  /**
   * Render function for each item
   */
  render: (item: T, index: number) => JSXNode;
  /**
   * Extra content rendered before the list (e.g. a status line)
   */
  header?: JSXNode;
}

/**
 * Window component - fixed-size viewport over a list of items
 *
 * Supports two modes:
 * - **of** (in-memory): slices from a signal array
 * - **fetch** (async): calls a fetcher when offset changes
 *
 * @example
 * // In-memory mode
 * <Window title="MESSAGES" of={allMessages} size={10} offset={scrollOffset}
 *   render={(msg) => <line>[{msg.time}] {msg.from}: {msg.text}</line>}
 * />
 *
 * @example
 * // Async fetcher mode
 * const getPage = async (offset, size) => {
 *   const res = await api.getMessages({ offset, size });
 *   return { items: res.messages, total: res.total };
 * };
 * <Window title="MESSAGES" fetch={getPage} size={10} offset={scrollOffset}
 *   render={(msg) => <line>[{msg.time}] {msg.from}: {msg.text}</line>}
 * />
 */
export function Window<T>(props: WindowProps<T>): JSXNode {
  const { title, of: source, fetch: fetcher, size, offset, render: renderItem, header } = props;

  let items: ReadableSignal<T[]>;
  let total: ReadableSignal<number>;

  if (source) {
    // In-memory mode: slice from signal
    items = computed([source, offset], (all, off) => all.slice(off, off + size));
    total = computed(source, (all) => all.length);
  } else if (fetcher) {
    // Async mode: fetch on offset change
    const pageItems = signal<T[]>([]);
    const pageTotal = signal(0);

    // Track the current offset to trigger fetches
    let lastFetchedKey = "";
    offset.subscribe((off) => {
      const key = `${off}:${size}`;
      if (key === lastFetchedKey) return;
      lastFetchedKey = key;
      fetcher(off, size).then((page) => {
        pageItems.value = page.items;
        pageTotal.value = page.total;
      });
    });
    // Initial fetch
    fetcher(offset.value, size).then((page) => {
      pageItems.value = page.items;
      pageTotal.value = page.total;
      lastFetchedKey = `${offset.value}:${size}`;
    });

    items = pageItems;
    total = pageTotal;
  } else {
    // Fallback: empty
    items = signal([]);
    total = signal(0);
  }

  const viewport = computed([offset, total], (off, t) => {
    if (t === 0) return "0/0";
    const start = off + 1;
    const end = Math.min(off + size, t);
    return `${start}-${end}/${t}`;
  });

  const content = computed(items, (list) => list.map(renderItem));

  const body = (
    <>
      {header}
      {content}
    </>
  );

  if (title) {
    return (
      <section title={title} viewport={viewport}>
        {body}
      </section>
    );
  }

  return body;
}
