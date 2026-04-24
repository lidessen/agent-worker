/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { computed, signal } from "semajsx/signal";
import { Sidebar } from "./sidebar.tsx";
import { Topbar } from "./topbar.tsx";
import * as styles from "./app-shell.style.ts";

export const sidebarCollapsed = signal(false);

export function AppShell(props: { children?: JSXNode }) {
  const innerClass = computed(sidebarCollapsed, (c) =>
    c ? [styles.innerShell, styles.innerShellCollapsed] : styles.innerShell,
  );

  return (
    <div class={styles.app}>
      <Topbar onToggleSidebar={() => (sidebarCollapsed.value = !sidebarCollapsed.value)} />
      <div class={innerClass}>
        <Sidebar />
        <main class={styles.content}>{props.children}</main>
      </div>
    </div>
  );
}
