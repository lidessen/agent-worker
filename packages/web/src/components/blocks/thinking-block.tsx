/** @jsxImportSource semajsx/dom */

import { Icon, ChevronDown, ChevronRight } from "semajsx/icons";
import { signal, computed } from "semajsx/signal";
import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./thinking-block.style.ts";

export function ThinkingBlock(props: { event: DaemonEvent }) {
  const expanded = signal(false);
  const text = (props.event.text as string) ?? "";

  function toggle() {
    expanded.value = !expanded.value;
  }

  const toggleIcon = computed(expanded, (ex) => (
    <Icon icon={ex ? ChevronDown : ChevronRight} size={12} />
  ));
  const body = computed(expanded, (ex) => (ex ? <div class={styles.content}>{text}</div> : null));

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
