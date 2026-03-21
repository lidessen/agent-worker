/** @jsxImportSource semajsx/dom */

import { Icon, Drama } from "@semajsx/icons";
import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { client } from "../stores/connection.ts";
import { agents } from "../stores/agents.ts";
import { selectAgent, selectChannel } from "../stores/navigation.ts";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon } from "../components/brand-icons.tsx";
import { tokens } from "../theme/tokens.ts";
import type { WorkspaceInfo } from "../api/types.ts";
import * as styles from "./workspace-settings-view.style.ts";

const statusColors: Record<string, string> = {
  running: tokens.colors.agentRunning,
  stopped: tokens.colors.agentIdle,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
};

function runtimeIcon(runtime: string) {
  switch (runtime) {
    case "claude-code":
      return <ClaudeIcon size={13} style="vertical-align: -2px;" />;
    case "codex":
      return <OpenAIIcon size={13} style="vertical-align: -2px;" />;
    case "cursor":
      return <CursorIcon size={13} style="vertical-align: -2px;" />;
    case "ai-sdk":
      return <VercelIcon size={11} style="vertical-align: -1px;" />;
    case "mock":
      return <Icon icon={Drama} size={12} />;
    default:
      return null;
  }
}

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
  const modeLabel = computed(workspace, (ws) => ws?.mode ?? "");
  const modeTag = computed(workspace, (ws) =>
    ws?.mode ? <span class={styles.modeTag}>{ws.mode}</span> : null,
  );

  const errorBanner = computed(error, (e) =>
    e ? <div style={`color: ${tokens.colors.danger}`}>{e}</div> : null,
  );

  const agentsSection = computed([workspace, agents], (ws, allAgents) => {
    const agentNames = ws?.agents ?? [];
    if (agentNames.length === 0) {
      return (
        <div style={`font-size: ${tokens.fontSizes.sm}; color: ${tokens.colors.textMuted}`}>
          No agents
        </div>
      );
    }

    const agentMap = new Map(allAgents.map((agent) => [agent.name, agent]));

    return (
      <div class={styles.agentList}>
        {agentNames.map((name) => (
          (() => {
            const agent = agentMap.get(name);
            const dotStyle = `background: ${statusColors[agent?.state ?? ""] ?? tokens.colors.agentIdle}`;
            return (
              <div
                class={styles.agentItem}
                onclick={() => selectAgent(name)}
              >
                <div class={styles.agentLabel}>
                  <span class={styles.agentRuntimeIcon}>
                    {runtimeIcon(agent?.runtime ?? "")}
                  </span>
                  <span>{name}</span>
                </div>
                <span class={styles.agentDot} style={dotStyle} />
              </div>
            );
          })()
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
  const createdLabel = computed(workspace, (ws) =>
    ws ? new Date(ws.createdAt).toLocaleString() : "—",
  );

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

        <div class={styles.hero}>
          <div class={styles.heroCopy}>
            <span class={styles.heroEyebrow}>Workspace</span>
            <span class={styles.heroTitle}>{wsNameDisplay}</span>
            <span class={styles.heroText}>
              Review active agents, jump into channels, and inspect workspace configuration
              from one place.
            </span>
          </div>
          <div class={styles.statGrid}>
            <div class={styles.statCard}>
              <span class={styles.statLabel}>Agents</span>
              <span class={styles.statValue}>{agentCount}</span>
            </div>
            <div class={styles.statCard}>
              <span class={styles.statLabel}>Channels</span>
              <span class={styles.statValue}>{channelCount}</span>
            </div>
            <div class={styles.statCard}>
              <span class={styles.statLabel}>Created</span>
              <span class={styles.statValueSmall}>{createdLabel}</span>
            </div>
          </div>
        </div>

        {/* Agents Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Agents</span>
            <span class={styles.count}>{agentCount}</span>
          </div>
          {agentsSection}
        </div>

        {/* Channels Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Channels</span>
            <span class={styles.count}>{channelCount}</span>
          </div>
          {channelsSection}
        </div>

        {/* Config Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Workspace Details</span>
          </div>
          <div class={styles.configBlock}>
            <div class={styles.configRow}>
              <span class={styles.configLabel}>Name</span>
              <span class={styles.configValue}>{wsNameDisplay}</span>
            </div>
            <div class={styles.configRow}>
              <span class={styles.configLabel}>Status</span>
              <span class={styles.configValue}>{statusLabel}</span>
            </div>
            {computed(modeLabel, (mode) =>
              mode ? (
              <div class={styles.configRow}>
                <span class={styles.configLabel}>Mode</span>
                <span class={styles.configValue}>{mode}</span>
              </div>
              ) : null,
            )}
            <div class={styles.configRow}>
              <span class={styles.configLabel}>Created</span>
              <span class={styles.configValue}>{createdLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
