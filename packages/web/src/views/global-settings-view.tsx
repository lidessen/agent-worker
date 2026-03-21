/** @jsxImportSource semajsx/dom */

import { SettingsPage } from "../pages/settings.tsx";
import * as styles from "./global-settings-view.style.ts";

export function GlobalSettingsView() {
  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <span class={styles.headerTitle}>Settings</span>
      </div>

      <SettingsPage />
    </div>
  );
}
