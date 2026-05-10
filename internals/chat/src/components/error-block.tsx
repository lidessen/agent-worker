/** @jsxImportSource @semajsx/dom */

import type { ChatEvent } from "../types";
import * as styles from "./error-block.style";

export function ErrorBlock(props: { event: ChatEvent }) {
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
