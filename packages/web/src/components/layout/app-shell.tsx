/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { Sidebar } from "./sidebar.tsx";
import * as styles from "./app-shell.style.ts";

export function AppShell(props: { children?: JSXNode }) {
  return (
    <div class={styles.shell}>
      <Sidebar />
      <main class={styles.content}>
        <div class={styles.contentInner}>{props.children}</div>
      </main>
    </div>
  );
}
