/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { when } from "semajsx";
import { WebClient } from "../api/client.ts";
import {
  connectionState,
  client,
  connect,
} from "../stores/connection.ts";
import type { HealthInfo } from "../api/types.ts";
import { tokens } from "../theme/tokens.ts";
import * as styles from "./settings.style.ts";

/** Known runtimes — informational display. Actual selection happens in agent creation. */
const KNOWN_RUNTIMES = [
  { name: "ai-sdk", status: "available", color: tokens.colors.success },
  { name: "claude-code", status: "available", color: tokens.colors.success },
  { name: "codex", status: "available", color: tokens.colors.success },
  { name: "cursor", status: "available", color: tokens.colors.success },
  { name: "mock", status: "available", color: tokens.colors.textDim },
] as const;

const testResult = signal<{ ok: boolean; message: string } | null>(null);
const testing = signal(false);
const healthInfo = signal<HealthInfo | null>(null);

const isConnected = computed(connectionState, (s) => s === "connected");

const testButtonLabel = computed(testing, (t) =>
  t ? "Testing..." : "Test Connection",
);

const hostDisplay = computed(connectionState, () => loadConfig().baseUrl);

const testResultBanner = computed(testResult, (r) => {
  if (!r) return null;
  return (
    <div class={[styles.message, r.ok ? styles.messageSuccess : styles.messageError]}>
      {r.message}
    </div>
  );
});

const healthRows = computed(healthInfo, (info) => {
  if (!info) return null;
  return [
    <div class={styles.infoRow}>
      <span class={styles.infoLabel}>Uptime</span>
      <span class={styles.infoValue}>{formatUptimeStatic(info.uptime)}</span>
    </div>,
    <div class={styles.infoRow}>
      <span class={styles.infoLabel}>Agents</span>
      <span class={styles.infoValue}>{String(info.agents)}</span>
    </div>,
    <div class={styles.infoRow}>
      <span class={styles.infoLabel}>Workspaces</span>
      <span class={styles.infoValue}>{String(info.workspaces)}</span>
    </div>,
  ];
});

function formatUptimeStatic(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

// Load saved config
function loadConfig(): { baseUrl: string; token: string } {
  try {
    const raw = localStorage.getItem("aw:config");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { baseUrl: "http://localhost:7420", token: "" };
}

export function SettingsPage() {
  const saved = loadConfig();
  let urlInput: HTMLInputElement | null = null;
  let tokenInput: HTMLInputElement | null = null;

  async function handleTest() {
    if (!urlInput || !tokenInput) return;
    const baseUrl = urlInput.value.trim();
    const token = tokenInput.value.trim();
    if (!baseUrl) {
      testResult.value = { ok: false, message: "Daemon URL is required" };
      return;
    }

    testing.value = true;
    testResult.value = null;

    try {
      const tmp = new WebClient(baseUrl, token);
      const info = await tmp.health();
      healthInfo.value = info;
      testResult.value = { ok: true, message: `Connected — ${info.agents} agents, ${info.workspaces} workspaces` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      testResult.value = { ok: false, message: msg };
    } finally {
      testing.value = false;
    }
  }

  async function handleSave() {
    if (!urlInput || !tokenInput) return;
    const baseUrl = urlInput.value.trim();
    const token = tokenInput.value.trim();
    if (!baseUrl) {
      testResult.value = { ok: false, message: "Daemon URL is required" };
      return;
    }

    localStorage.setItem("aw:config", JSON.stringify({ baseUrl, token }));
    testResult.value = null;
    await connect(baseUrl, token);
  }

  // Fetch health info if already connected
  if (isConnected.value && client.value) {
    client.value.health().then((info) => {
      healthInfo.value = info;
    }).catch(() => { /* ignore */ });
  }

  return (
    <div class={styles.page}>
      <div class={styles.section}>
        <span class={styles.sectionTitle}>Connection</span>

        <div class={styles.form}>
          <div class={styles.field}>
            <label class={styles.label}>Daemon URL</label>
            <input
              class={styles.input}
              type="text"
              placeholder="http://localhost:7420"
              value={saved.baseUrl}
              ref={(el: HTMLInputElement) => { urlInput = el; }}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Auth Token</label>
            <input
              class={styles.input}
              type="password"
              placeholder="Bearer token"
              value={saved.token}
              ref={(el: HTMLInputElement) => { tokenInput = el; }}
            />
          </div>

          <div class={styles.actions}>
            <button
              class={styles.btn}
              onclick={handleTest}
              disabled={testing}
            >
              {testButtonLabel}
            </button>
            <button
              class={[styles.btn, styles.btnPrimary]}
              onclick={handleSave}
            >
              Save
            </button>
          </div>

          {testResultBanner}
        </div>
      </div>

      {when(isConnected, () => (
        <div class={styles.section}>
          <span class={styles.sectionTitle}>Current Connection</span>
          <div class={styles.info}>
            <div class={styles.infoRow}>
              <span class={styles.infoLabel}>Host</span>
              <span class={styles.infoValue}>{hostDisplay}</span>
            </div>
            <div class={styles.infoRow}>
              <span class={styles.infoLabel}>Status</span>
              <span class={styles.infoValue}>{connectionState}</span>
            </div>
            {healthRows}
          </div>
        </div>
      ))}

      <div class={styles.section}>
        <span class={styles.sectionTitle}>Runtimes</span>
        <div class={styles.info}>
          {KNOWN_RUNTIMES.map((rt) => (
            <div class={styles.infoRow}>
              <span class={styles.infoLabel}>{rt.name}</span>
              <span class={styles.infoValue} style={`color: ${rt.color}`}>
                {rt.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
