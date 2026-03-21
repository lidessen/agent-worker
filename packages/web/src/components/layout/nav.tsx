/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { connectionState } from "../../stores/connection.ts";
import { route } from "../../router.ts";
import { tokens } from "../../theme/tokens.ts";
import * as styles from "./nav.style.ts";

const dotColor = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return tokens.colors.success;
    case "connecting":
      return tokens.colors.warning;
    case "disconnected":
    case "error":
      return tokens.colors.danger;
  }
});

const currentPage = computed(route, (r) => r.page);

const dotStyle = computed(dotColor, (c) => `background: ${c}`);

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
        <div class={styles.dot} style={dotStyle} />
      </span>
    </nav>
  );
}
