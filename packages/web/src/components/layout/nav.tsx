/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { connectionState } from "../../stores/connection.ts";
import { route } from "../../router.ts";
import * as styles from "./nav.style.ts";

const dotColor = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return "#30d158";
    case "connecting":
      return "#ffd60a";
    case "disconnected":
    case "error":
      return "#ff453a";
  }
});

const currentPage = computed(route, (r) => r.page);

const dotStyle = computed(dotColor, (c) => `background: ${c}`);

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
      <div class={styles.dot} style={dotStyle} title={connectionState} />
    </nav>
  );
}
