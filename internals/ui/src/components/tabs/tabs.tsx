/** @jsxImportSource @semajsx/dom */

/**
 * Tabs component
 *
 * A tabbed interface for switching between content panels.
 * Uses signal-based reactivity: a signal tracks the active tab,
 * `onClick` handles switching, and a `ref` callback subscribes
 * to the signal to update `aria-selected` / `hidden` on children.
 *
 * Works both standalone (client-side) and as an SSR island —
 * wrap with `island()` for SSG hydration.
 *
 * @example
 * ```tsx
 * import { Tabs, TabList, Tab, TabPanel } from "@semajsx/ui/tabs";
 *
 * <Tabs defaultValue="npm">
 *   <TabList>
 *     <Tab value="npm">npm</Tab>
 *     <Tab value="bun">Bun</Tab>
 *   </TabList>
 *   <TabPanel value="npm">npm install semajsx</TabPanel>
 *   <TabPanel value="bun">bun add semajsx</TabPanel>
 * </Tabs>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import { signal } from "@semajsx/signal";
import * as styles from "./tabs.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

/**
 * Module-level state for SSR initial rendering.
 *
 * Set by `Tabs` before returning JSX; read by `Tab` / `TabPanel` when they
 * render during the same synchronous (or awaited) SSR pass.  This lets the
 * server output include the correct `aria-selected` and `hidden` attributes
 * so the page is styled correctly before any JS loads.
 *
 * On the client the `ref` callback in `Tabs` immediately overwrites these
 * attributes once the component mounts, so the initial values are harmless.
 */
let _ssrDefaultTab: string | undefined;

export interface TabsProps {
  /** The initially active tab value */
  defaultValue: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Content (TabList and TabPanels) */
  children?: JSXNode;
}

export interface TabListProps {
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Tab triggers */
  children?: JSXNode;
}

export interface TabProps {
  /** Value matching a TabPanel */
  value: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Tab label */
  children?: JSXNode;
}

export interface TabPanelProps {
  /** Value matching a Tab */
  value: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Panel content */
  children?: JSXNode;
}

export function Tabs(props: TabsProps): JSXNode {
  const active = signal(props.defaultValue);
  _ssrDefaultTab = props.defaultValue;

  return (
    <div
      class={[styles.root, props.class]}
      data-tabs={active}
      onClick={(e: MouseEvent) => {
        const tab = (e.target as HTMLElement).closest("[role=tab]");
        if (!tab) return;
        const value = tab.getAttribute("data-tab-value");
        if (value) active.value = value;
      }}
      ref={(el: HTMLDivElement | null) => {
        if (!el) return;
        // Sync child tab/panel states to the active signal
        const sync = (value: string) => {
          for (const t of el.querySelectorAll("[role=tab]")) {
            t.setAttribute("aria-selected", String(t.getAttribute("data-tab-value") === value));
          }
          for (const p of el.querySelectorAll("[role=tabpanel]")) {
            (p as HTMLElement).hidden = p.getAttribute("data-tab-panel") !== value;
          }
        };
        sync(active.value);
        active.subscribe(sync);
      }}
    >
      {props.children}
    </div>
  );
}

export function TabList(props: TabListProps): JSXNode {
  return (
    <div class={[styles.list, props.class]} role="tablist">
      {props.children}
    </div>
  );
}

export function Tab(props: TabProps): JSXNode {
  return (
    <button
      class={[styles.trigger, styles.triggerStates, props.class]}
      role="tab"
      data-tab-value={props.value}
      aria-selected={
        _ssrDefaultTab !== undefined
          ? props.value === _ssrDefaultTab
            ? "true"
            : "false"
          : undefined
      }
    >
      {props.children}
    </button>
  );
}

export function TabPanel(props: TabPanelProps): JSXNode {
  const hidden = _ssrDefaultTab !== undefined ? props.value !== _ssrDefaultTab : undefined;
  return (
    <div
      class={[styles.panel, props.class]}
      role="tabpanel"
      data-tab-panel={props.value}
      hidden={hidden || undefined}
    >
      {props.children}
    </div>
  );
}
