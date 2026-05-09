/** @jsxImportSource semajsx/dom */

import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./error-block.style.ts";

export function ErrorBlock(props: { event: DaemonEvent }) {
  const { event } = props;
  const message =
    (event.error as string) ??
    (event.message as string) ??
    (event.text as string) ??
    "Unknown error";

  return (
    <div class={styles.block}>
      <pre class={styles.message}>{message}</pre>
    </div>
  );
}
