/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import { client } from "../stores/connection.ts";
import { fetchHarnesses } from "../stores/harnesses.ts";
import { navigate } from "../router.ts";
import { YamlEditor } from "./yaml-editor.tsx";
import * as styles from "./create-harness-dialog.style.ts";

const DEFAULT_TEAM_YAML = `# Team harness — multi-agent coordination
name: my-team

agents:
  assistant:
    runtime: claude-code
    instructions: You are a helpful assistant.

channels:
  - general
`;

const RUNTIME_OPTIONS = [
  { value: "codex", label: "codex (CLI; bash + file tools)" },
  { value: "claude-code", label: "claude-code (CLI; rich tool surface)" },
  { value: "cursor", label: "cursor (CLI)" },
  { value: "ai-sdk", label: "ai-sdk (any provider)" },
  { value: "mock", label: "mock (no real LLM)" },
];

type HarnessKind = "team" | "chat";

export const showCreateHarness = signal(false);

export function CreateHarnessDialog() {
  // Shared
  const kind = signal<HarnessKind>("chat");
  const name = signal("");
  const error = signal("");
  const loading = signal(false);

  // Team-only
  const mode = signal("service");
  const teamSource = signal(DEFAULT_TEAM_YAML);

  // Chat-only
  const chatRuntime = signal("codex");
  const chatModel = signal("");
  const chatCwd = signal("");
  const chatInstructions = signal("You are a helpful assistant. Use your tools when useful. Reply concisely.");

  const createBtnLabel = computed(loading, (l) => (l ? "Creating…" : "Create"));
  const hasError = computed(error, (e) => e.length > 0);

  function close() {
    showCreateHarness.value = false;
    error.value = "";
    loading.value = false;
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  /** Build the chat YAML from the form fields. */
  function buildChatYaml(): string {
    const trimmedName = name.value.trim() || "my-chat";
    const lines: string[] = [
      `# Single-agent chat harness`,
      `name: ${trimmedName}`,
      `harnessTypeId: single-agent-chat`,
      `agent:`,
      `  name: assistant`,
      `  runtime: ${chatRuntime.value}`,
    ];
    const m = chatModel.value.trim();
    if (m) {
      // Accept either bare id or provider:id; both work for ai-sdk;
      // CLI runtimes only need the bare id.
      const colon = m.indexOf(":");
      if (colon > 0) {
        const provider = m.slice(0, colon);
        const id = m.slice(colon + 1);
        lines.push(`  model:`, `    full: ${m}`, `    id: ${id}`, `    provider: ${provider}`);
      } else {
        lines.push(`  model:`, `    full: ${m}`, `    id: ${m}`);
      }
    }
    const cwd = chatCwd.value.trim();
    if (cwd) {
      // Quote in case path has spaces; YAML scalar form keeps it
      // intact through parseHarnessDef → contributeRuntime.
      lines.push(`  cwd: ${JSON.stringify(cwd)}`);
    }
    const instr = chatInstructions.value.trim();
    if (instr) {
      lines.push(`  instructions: |`);
      for (const ln of instr.split("\n")) lines.push(`    ${ln}`);
    }
    return lines.join("\n") + "\n";
  }

  async function handleCreate() {
    const c = client.value;
    if (!c) {
      error.value = "Not connected to daemon";
      return;
    }

    let src: string;
    if (kind.value === "chat") {
      // Validate the chat-specific fields.
      if (!chatRuntime.value) {
        error.value = "Runtime is required";
        return;
      }
      src = buildChatYaml();
    } else {
      src = teamSource.value.trim();
      if (!src) {
        error.value = "YAML source is required";
        return;
      }
    }

    loading.value = true;
    error.value = "";

    try {
      const ws = await c.createHarness({
        source: src,
        name: name.value.trim() || undefined,
        mode: kind.value === "chat" ? "service" : mode.value,
      });
      close();
      await fetchHarnesses();
      // Chat lands on /chat/<key>; team on /harnesses/<key>.
      if (kind.value === "chat") {
        navigate("/chat/" + ws.name);
      } else {
        navigate("/harnesses/" + ws.name);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to create harness";
      loading.value = false;
    }
  }

  const teamFields = computed(kind, (k) =>
    k === "team" ? (
      <>
        <div class={styles.field}>
          <label class={styles.label}>Mode</label>
          <select
            class={styles.select}
            onchange={(e: Event) => {
              mode.value = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="service" selected>service</option>
            <option value="task">task</option>
          </select>
        </div>
        <div class={styles.field}>
          <label class={styles.label}>YAML Configuration</label>
          <YamlEditor
            value={teamSource.value}
            onChange={(v: string) => {
              teamSource.value = v;
            }}
            placeholder="Paste harness YAML here..."
          />
        </div>
      </>
    ) : null,
  );

  const chatFields = computed(kind, (k) =>
    k === "chat" ? (
      <>
        <div class={styles.field}>
          <label class={styles.label}>Runtime</label>
          <select
            class={styles.select}
            onchange={(e: Event) => {
              chatRuntime.value = (e.target as HTMLSelectElement).value;
            }}
          >
            {RUNTIME_OPTIONS.map((opt) => (
              <option value={opt.value} selected={opt.value === chatRuntime.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div class={styles.field}>
          <label class={styles.label}>
            Model (optional — leave blank for runtime default)
          </label>
          <input
            class={styles.input}
            type="text"
            placeholder="e.g. opus, gpt-5-codex, deepseek:deepseek-chat"
            value={chatModel.value}
            oninput={(e: Event) => {
              chatModel.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class={styles.field}>
          <label class={styles.label}>
            Working directory (optional — bash + file tools root)
          </label>
          <input
            class={styles.input}
            type="text"
            placeholder="e.g. /Users/me/workspaces/my-project"
            value={chatCwd.value}
            oninput={(e: Event) => {
              chatCwd.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class={styles.field}>
          <label class={styles.label}>System instructions</label>
          <textarea
            class={styles.input}
            rows={5}
            placeholder="You are…"
            value={chatInstructions.value}
            oninput={(e: Event) => {
              chatInstructions.value = (e.target as HTMLTextAreaElement).value;
            }}
          />
        </div>
      </>
    ) : null,
  );

  return when(showCreateHarness, () => (
    <div class={styles.overlay} onclick={handleOverlayClick}>
      <div class={styles.card}>
        <h2 class={styles.title}>New Harness</h2>

        <div class={styles.field}>
          <label class={styles.label}>Type</label>
          <select
            class={styles.select}
            onchange={(e: Event) => {
              kind.value = (e.target as HTMLSelectElement).value as HarnessKind;
            }}
          >
            <option value="chat" selected={kind.value === "chat"}>
              Chat — 1:1 conversation with one agent
            </option>
            <option value="team" selected={kind.value === "team"}>
              Team — multi-agent coordination (channels + roster)
            </option>
          </select>
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Name (optional)</label>
          <input
            class={styles.input}
            type="text"
            placeholder={computed(kind, (k) => (k === "chat" ? "my-chat" : "my-team"))}
            value={name.value}
            oninput={(e: Event) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        {chatFields}
        {teamFields}

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
