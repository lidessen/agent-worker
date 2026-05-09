/** @jsxImportSource @semajsx/dom */

import { signal, computed } from "@semajsx/signal";
import { when } from "@semajsx/core";
import type { ChatEvent } from "../types";
import * as styles from "./thinking-block.style";

export function ThinkingBlock(props: { event: ChatEvent }) {
  const expanded = signal(false);
  const text = (props.event.text as string) ?? "";

  function toggle() {
    expanded.value = !expanded.value;
  }

  return (
    <div class={styles.block}>
      <div class={styles.header} onclick={toggle}>
        <span class={styles.toggle}>{computed(expanded, (v) => (v ? "\u25BC" : "\u25B6"))}</span>
        <span class={styles.label}>Thinking...</span>
      </div>
      {when(expanded, () => (
        <div class={styles.content}>{text}</div>
      ))}
    </div>
  );
}
