/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./thinking-block.style.ts";

export function ThinkingBlock(props: { event: DaemonEvent }) {
  const expanded = signal(false);
  const text = (props.event.text as string) ?? "";

  function toggle() {
    expanded.value = !expanded.value;
  }

  const toggleIcon = computed(expanded, (ex) => (ex ? "\u25BC" : "\u25B6"));
  const body = computed(expanded, (ex) =>
    ex ? <div class={styles.content}>{text}</div> : null,
  );

  return (
    <div class={styles.block}>
      <div class={styles.header} onclick={toggle}>
        <span class={styles.toggle}>{toggleIcon}</span>
        <span class={styles.label}>Thinking...</span>
      </div>
      {body}
    </div>
  );
}
