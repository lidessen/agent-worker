/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import { client } from "../stores/connection.ts";
import { fetchAgents } from "../stores/agents.ts";
import { navigate } from "../router.ts";
import type { RuntimeType } from "../api/types.ts";
import * as styles from "./create-agent-dialog.style.ts";

export const showCreateAgent = signal(false);

export function CreateAgentDialog() {
  const name = signal("");
  const runtime = signal<RuntimeType>("ai-sdk");
  const model = signal("");
  const error = signal("");
  const loading = signal(false);
  const createBtnLabel = computed(loading, (l) => (l ? "Creating..." : "Create"));

  function close() {
    showCreateAgent.value = false;
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
      const agent = await c.createAgent({
        name: n,
        runtime: {
          type: runtime.value,
          model: model.value.trim() || undefined,
        },
      });
      close();
      await fetchAgents();
      navigate("/agents/" + agent.name);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to create agent";
      loading.value = false;
    }
  }

  return when(showCreateAgent, () => (
    <div class={styles.overlay} onclick={handleOverlayClick}>
      <div class={styles.card}>
        <h2 class={styles.title}>New Agent</h2>

        <div class={styles.field}>
          <label class={styles.label}>Name</label>
          <input
            class={styles.input}
            type="text"
            placeholder="my-agent"
            oninput={(e: Event) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Runtime</label>
          <select
            class={styles.select}
            onchange={(e: Event) => {
              runtime.value = (e.target as HTMLSelectElement).value as RuntimeType;
            }}
          >
            <option value="ai-sdk" selected>ai-sdk</option>
            <option value="claude-code">claude-code</option>
            <option value="codex">codex</option>
            <option value="cursor">cursor</option>
          </select>
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Model (optional)</label>
          <input
            class={styles.input}
            type="text"
            placeholder="e.g. anthropic:claude-sonnet-4-20250514"
            oninput={(e: Event) => {
              model.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        {when(error, () => (
          <div class={styles.error}>{error}</div>
        ))}

        <div class={styles.actions}>
          <button class={styles.btnCancel} onclick={close}>
            Cancel
          </button>
          <button
            class={styles.btnPrimary}
            onclick={handleCreate}
            disabled={loading}
          >
            {createBtnLabel}
          </button>
        </div>
      </div>
    </div>
  ));
}
