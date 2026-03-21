/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { client } from "../stores/connection.ts";
import { selectAgent, selectChannel } from "../stores/navigation.ts";
import { tokens } from "../theme/tokens.ts";
import type { WorkspaceInfo } from "../api/types.ts";
import * as styles from "./workspace-settings-view.style.ts";

const statusColors: Record<string, string> = {
  running: tokens.colors.agentRunning,
  stopped: tokens.colors.agentIdle,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
};

export function WorkspaceSettingsView(props: { wsKey: string }) {
  const workspace = signal<WorkspaceInfo | null>(null);
  const channels = signal<string[]>([]);
  const error = signal<string | null>(null);

  async function loadWorkspace(force = false) {
    const c = client.value;
    if (!c) return;
    error.value = null;

    try {
      const [ws, ch] = await Promise.all([
        c.getWorkspace(props.wsKey),
        c.listChannels(props.wsKey),
      ]);
      workspace.value = ws;
      channels.value = ch;
    } catch (err) {
      console.error(`Failed to load workspace ${props.wsKey}:`, err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  loadWorkspace();

  // Retry loading when client connects
  const unsubClient = client.subscribe((c) => {
    if (c && !workspace.value) {
      loadWorkspace(true);
    }
  });

  onCleanup(() => {
    unsubClient();
  });

  const dotColor = computed(workspace, (ws) =>
    statusColors[ws?.status ?? ""] ?? tokens.colors.agentIdle,
  );

  const wsNameDisplay = computed(workspace, (ws) => ws?.name ?? props.wsKey);
  const badgeDotStyle = computed(dotColor, (c) => `background: ${c}`);
  const statusLabel = computed(workspace, (ws) => ws?.status ?? "loading");
  const modeTag = computed(workspace, (ws) =>
    ws?.mode ? <span class={styles.modeTag}>{ws.mode}</span> : null,
  );

  const errorBanner = computed(error, (e) =>
    e ? <div style={`color: ${tokens.colors.danger}`}>{e}</div> : null,
  );

  const agentsSection = computed(workspace, (ws) => {
    const agentNames = ws?.agents ?? [];
    if (agentNames.length === 0) {
      return (
        <div style={`font-size: ${tokens.fontSizes.sm}; color: ${tokens.colors.textMuted}`}>
          No agents
        </div>
      );
    }
    return (
      <div class={styles.agentList}>
        {agentNames.map((name) => (
          <div
            class={styles.agentItem}
            onclick={() => selectAgent(name)}
          >
            <span class={styles.agentDot} />
            {name}
          </div>
        ))}
      </div>
    );
  });

  const channelsSection = computed(channels, (ch) => {
    if (ch.length === 0) {
      return (
        <div style={`font-size: ${tokens.fontSizes.sm}; color: ${tokens.colors.textMuted}`}>
          No channels
        </div>
      );
    }
    return (
      <div class={styles.channelList}>
        {ch.map((name) => (
          <div
            class={styles.channelItem}
            onclick={() => selectChannel(props.wsKey, name)}
          >
            # {name}
          </div>
        ))}
      </div>
    );
  });

  const agentCount = computed(workspace, (ws) => ws?.agents.length ?? 0);
  const channelCount = computed(channels, (ch) => ch.length);

  // Config section: show workspace info as key-value pairs
  const configSection = computed(workspace, (ws) => {
    if (!ws) return null;
    return (
      <div class={styles.configBlock}>
        <div class={styles.configRow}>
          <span class={styles.configLabel}>Name</span>
          <span class={styles.configValue}>{ws.name}</span>
        </div>
        <div class={styles.configRow}>
          <span class={styles.configLabel}>Status</span>
          <span class={styles.configValue}>{ws.status}</span>
        </div>
        {ws.mode ? (
          <div class={styles.configRow}>
            <span class={styles.configLabel}>Mode</span>
            <span class={styles.configValue}>{ws.mode}</span>
          </div>
        ) : null}
        <div class={styles.configRow}>
          <span class={styles.configLabel}>Created</span>
          <span class={styles.configValue}>
            {new Date(ws.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.headerInfo}>
          <span class={styles.wsName}>{wsNameDisplay}</span>
          <div class={styles.badge}>
            <span class={styles.badgeDot} style={badgeDotStyle} />
            {statusLabel}
          </div>
          {modeTag}
        </div>
      </div>

      <div class={styles.content}>
        {errorBanner}

        {/* Agents Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Agents</span>
            <span class={styles.count}>({agentCount})</span>
          </div>
          {agentsSection}
        </div>

        {/* Channels Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Channels</span>
            <span class={styles.count}>({channelCount})</span>
          </div>
          {channelsSection}
        </div>

        {/* Config Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Configuration</span>
          </div>
          {configSection}
        </div>
      </div>
    </div>
  );
}
