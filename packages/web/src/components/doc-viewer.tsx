/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { inject } from "semajsx/style";
import { client } from "../stores/connection.ts";
import * as styles from "./doc-viewer.style.ts";

// Eagerly inject CSS for styles used in computed class values
inject([styles.toolbarBtnActive]);

export function DocViewer(props: { wsKey: string; docName: string }) {
  const content = signal<string>("");
  const isEditing = signal<boolean>(false);
  const isSaving = signal<boolean>(false);
  const error = signal<string | null>(null);

  let textareaRef: HTMLTextAreaElement | null = null;

  async function loadContent() {
    const c = client.value;
    if (!c) return;
    error.value = null;
    try {
      content.value = await c.readDoc(props.wsKey, props.docName);
    } catch (err) {
      console.error(`Failed to read doc ${props.docName}:`, err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleSave() {
    const c = client.value;
    if (!c || !textareaRef) return;
    isSaving.value = true;
    error.value = null;
    try {
      const newContent = textareaRef.value;
      await c.writeDoc(props.wsKey, props.docName, newContent);
      content.value = newContent;
      isEditing.value = false;
    } catch (err) {
      console.error(`Failed to write doc ${props.docName}:`, err);
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      isSaving.value = false;
    }
  }

  function toggleEdit() {
    isEditing.value = !isEditing.value;
  }

  const editBtnClass = computed(isEditing, (ed) =>
    ed ? [styles.toolbarBtn, styles.toolbarBtnActive] : [styles.toolbarBtn],
  );
  const editBtnLabel = computed(isEditing, (ed) => (ed ? "Cancel" : "Edit"));
  const saveBtnLabel = computed(isSaving, (s) => (s ? "Saving..." : "Save"));
  const contentOrEmpty = computed(content, (c) => c || "(empty)");

  const saveButton = computed([isEditing, isSaving], (ed) => {
    if (!ed) return null;
    return (
      <button
        class={styles.toolbarBtn}
        onclick={handleSave}
        disabled={isSaving}
      >
        {saveBtnLabel}
      </button>
    );
  });

  const errorBanner = computed(error, (e) =>
    e ? (
      <div class={styles.errorBanner}>
        {e}
      </div>
    ) : null,
  );

  const mainContent = computed(isEditing, (ed) => {
    if (ed) {
      return (
        <textarea
          class={styles.editArea}
          ref={(el: HTMLTextAreaElement) => {
            textareaRef = el;
            el.value = content.value;
          }}
        />
      );
    }
    return <pre class={styles.contentPre}>{contentOrEmpty}</pre>;
  });

  // Load on mount
  loadContent();

  return (
    <div class={styles.viewer}>
      <div class={styles.header}>
        <span class={styles.title}>{props.docName}</span>
        <div class={styles.toolbar}>
          <button class={editBtnClass} onclick={toggleEdit}>
            {editBtnLabel}
          </button>
          {saveButton}
          <button class={styles.toolbarBtn} onclick={loadContent}>
            Refresh
          </button>
        </div>
      </div>
      {errorBanner}
      {mainContent}
    </div>
  );
}
