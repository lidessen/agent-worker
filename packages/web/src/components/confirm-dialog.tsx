/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import type { WritableSignal } from "semajsx/signal";
import * as styles from "./confirm-dialog.style.ts";

export function ConfirmDialog(props: {
  visible: WritableSignal<boolean>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const loading = signal(false);
  const error = signal("");
  const hasError = computed(error, (e) => e.length > 0);

  function close() {
    props.visible.value = false;
    error.value = "";
    loading.value = false;
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  async function handleConfirm() {
    loading.value = true;
    error.value = "";
    try {
      await props.onConfirm();
      close();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Operation failed";
      loading.value = false;
    }
  }

  const btnLabel = computed(loading, (l) =>
    l ? "..." : (props.confirmLabel ?? "Confirm"),
  );

  const btnClass = props.danger
    ? [styles.btnConfirm, styles.btnConfirmDanger]
    : styles.btnConfirm;

  return when(props.visible, () => (
    <div class={styles.overlay} onclick={handleOverlayClick}>
      <div class={styles.card}>
        <h2 class={styles.title}>{props.title}</h2>
        <div class={styles.message}>{props.message}</div>

        {when(hasError, () => (
          <div class={styles.error}>{error}</div>
        ))}

        <div class={styles.actions}>
          <button class={styles.btnCancel} onclick={close}>
            Cancel
          </button>
          <button
            class={btnClass}
            onclick={handleConfirm}
            disabled={computed(loading, (l) => l)}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  ));
}
