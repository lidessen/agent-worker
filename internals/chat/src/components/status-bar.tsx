/** @jsxImportSource @semajsx/dom */

import type { ReadableSignal } from "@semajsx/signal";
import { computed } from "@semajsx/signal";
import { chatTokens as t } from "../theme/tokens";
import * as styles from "./status-bar.style";

export interface StatusBarProps {
  status: ReadableSignal<string>;
  connected: ReadableSignal<boolean>;
  class?: string;
}

export function StatusBar(props: StatusBarProps) {
  return (
    <div class={props.class ? `${styles.bar} ${props.class}` : styles.bar}>
      <span
        class={styles.dot}
        style={computed(
          props.connected,
          (v) => `background: ${v ? t.chat.statusConnected : t.chat.statusDisconnected};`,
        )}
      />
      <span class={styles.text}>{props.status}</span>
    </div>
  );
}
