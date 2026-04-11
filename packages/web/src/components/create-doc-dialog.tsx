/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import { client } from "../stores/connection.ts";
import { currentWorkspace } from "../stores/navigation.ts";
import { loadWorkspaceData } from "../stores/workspace-data.ts";
import * as styles from "./create-agent-dialog.style.ts";

export const showCreateDoc = signal(false);

export function CreateDocDialog() {
  const name = signal("");
  const content = signal("");
  const error = signal("");
  const loading = signal(false);
  const createBtnLabel = computed(loading, (l) => (l ? "Creating..." : "Create"));
  const hasError = computed(error, (e) => e.length > 0);

  function close() {
    showCreateDoc.value = false;
    error.value = "";
    loading.value = false;
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  async function handleCreate() {
    const c = client.value;
    if (!c) {
      error.value = "Not connected to daemon";
      return;
    }

    const n = name.value.trim();
    if (!n) {
      error.value = "Name is required";
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      const wsKey = currentWorkspace.value;
      await c.writeDoc(wsKey, n, content.value);
      close();
      await loadWorkspaceData(wsKey);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to create document";
      loading.value = false;
    }
  }

  return when(showCreateDoc, () => (
    <div class={styles.overlay} onclick={handleOverlayClick}>
      <div class={styles.card}>
        <h2 class={styles.title}>New Document</h2>

        <div class={styles.field}>
          <label class={styles.label}>Name</label>
          <input
            class={styles.input}
            type="text"
            placeholder="e.g. design-notes"
            oninput={(e: Event) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Content (optional)</label>
          <textarea
            class={[styles.input, styles.textarea]}
            placeholder="Initial document content..."
            oninput={(e: Event) => {
              content.value = (e.target as HTMLTextAreaElement).value;
            }}
          />
        </div>

        {when(hasError, () => (
          <div class={styles.error}>{error}</div>
        ))}

        <div class={styles.actions}>
          <button class={styles.btnCancel} onclick={close}>
            Cancel
          </button>
          <button
            class={styles.btnPrimary}
            onclick={handleCreate}
            disabled={computed(loading, (l) => l)}
          >
            {createBtnLabel}
          </button>
        </div>
      </div>
    </div>
  ));
}
