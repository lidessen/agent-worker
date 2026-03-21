/** @jsxImportSource semajsx/dom */

import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./user-message-block.style.ts";

export function UserMessageBlock(props: { event: DaemonEvent }) {
  const text =
    (props.event.content as string) ??
    (props.event.text as string) ??
    "";

  return (
    <div class={styles.block}>
      <div class={styles.content}>{text}</div>
    </div>
  );
}
