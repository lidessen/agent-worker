/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import { client } from "../stores/connection.ts";
import { fetchHarnesss } from "../stores/harnesss.ts";
import { navigate } from "../router.ts";
import { YamlEditor } from "./yaml-editor.tsx";
import * as styles from "./create-harness-dialog.style.ts";

const DEFAULT_YAML = `# Harness configuration
name: my-harness

agents:
  assistant:
    runtime: claude-code
    instructions: You are a helpful assistant.

channels:
  - general
`;

export const showCreateHarness = signal(false);

export function CreateHarnessDialog() {
  const name = signal("");
  const mode = signal("service");
  const source = signal(DEFAULT_YAML);
  const error = signal("");
  const loading = signal(false);
  const createBtnLabel = computed(loading, (l) => (l ? "Creating..." : "Create"));
  const hasError = computed(error, (e) => e.length > 0);

  function close() {
    showCreateHarness.value = false;
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

    const src = source.value.trim();
    if (!src) {
      error.value = "YAML source is required";
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      const ws = await c.createHarness({
        source: src,
        name: name.value.trim() || undefined,
        mode: mode.value,
      });
      close();
      await fetchHarnesss();
      navigate("/harnesss/" + ws.name);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to create harness";
      loading.value = false;
    }
  }

  return when(showCreateHarness, () => (
    <div class={styles.overlay} onclick={handleOverlayClick}>
      <div class={styles.card}>
        <h2 class={styles.title}>New Harness</h2>

        <div class={styles.field}>
          <label class={styles.label}>Name (optional)</label>
          <input
            class={styles.input}
            type="text"
            placeholder="my-harness"
            value={name.value}
            oninput={(e: Event) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Mode</label>
          <select
            class={styles.select}
            onchange={(e: Event) => {
              mode.value = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="service" selected>
              service
            </option>
            <option value="task">task</option>
          </select>
        </div>

        <div class={styles.field}>
          <label class={styles.label}>YAML Configuration</label>
          <YamlEditor
            value={source.value}
            onChange={(v: string) => {
              source.value = v;
            }}
            placeholder="Paste harness YAML here..."
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
