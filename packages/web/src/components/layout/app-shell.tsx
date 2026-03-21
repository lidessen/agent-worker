/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { Nav } from "./nav.tsx";
import * as styles from "./app-shell.style.ts";

export function AppShell(props: { children?: JSXNode }) {
  return (
    <div class={styles.shell}>
      <header class={styles.topBar}>
        <span class={styles.title}>Agent Worker</span>
        <Nav />
      </header>
      <main class={styles.content}>{props.children}</main>
    </div>
  );
}
