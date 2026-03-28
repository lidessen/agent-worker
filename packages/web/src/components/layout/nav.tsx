/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { connectionState } from "../../stores/connection.ts";
import { route } from "../../router.ts";
import * as styles from "./nav.style.ts";

const currentPage = computed(route, (r) => r.page);

const dotClass = computed(connectionState, (state) => [
  styles.dot,
  state === "connected"
    ? styles.dotConnected
    : state === "connecting"
      ? styles.dotConnecting
      : styles.dotError,
]);

const dotTitle = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return "Connected to daemon";
    case "connecting":
      return "Connecting...";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Connection error";
  }
});

function NavLink(props: { href: string; page: string; children: string }) {
  const isActive = computed(currentPage, (p) => p === props.page);
  const linkClass = computed(isActive, (active) =>
    active ? [styles.link, styles.linkActive] : styles.link,
  );
  return (
    <a href={props.href} class={linkClass}>
      {props.children}
    </a>
  );
}

export function Nav() {
  return (
    <nav class={styles.nav}>
      <div class={styles.links}>
        <NavLink href="#/" page="dashboard">
          Dashboard
        </NavLink>
        <NavLink href="#/settings" page="settings">
          Settings
        </NavLink>
      </div>
      <span title={dotTitle}>
        <div class={dotClass} />
      </span>
    </nav>
  );
}
