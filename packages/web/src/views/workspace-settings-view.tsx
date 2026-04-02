/** @jsxImportSource semajsx/dom */

import { Icon, Drama } from "semajsx/icons";
import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { client } from "../stores/connection.ts";
import { agents } from "../stores/agents.ts";
import { deleteWorkspace } from "../stores/workspaces.ts";
import { selectAgent, selectChannel, selectGlobalSettings } from "../stores/navigation.ts";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon } from "../components/brand-icons.tsx";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import type { WorkspaceInfo, WorkspaceStatus, DaemonEvent } from "../api/types.ts";
import * as styles from "./workspace-settings-view.style.ts";

function runtimeIcon(runtime: string) {
  switch (runtime) {
    case "claude-code":
      return <ClaudeIcon size={13} />;
    case "codex":
      return <OpenAIIcon size={13} />;
    case "cursor":
      return <CursorIcon size={13} />;
    case "ai-sdk":
      return <VercelIcon size={11} />;
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
  const showDeleteWs = signal(false);
  const wsStatus = signal<WorkspaceStatus | null>(null);
  const wsEvents = signal<DaemonEvent[]>([]);

  async function loadWorkspace(force = false) {
    const c = client.value;
    if (!c) return;
    error.value = null;

    try {
      const [ws, ch, status, events] = await Promise.all([
        c.getWorkspace(props.wsKey),
        c.listChannels(props.wsKey),
        c.getWorkspaceStatus(props.wsKey).catch(() => null),
        c.readWorkspaceEvents(props.wsKey).catch(() => ({ entries: [] })),
      ]);
      workspace.value = ws;
      channels.value = ch;
      wsStatus.value = status;
      wsEvents.value = events.entries.slice(-30);
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

  const wsNameDisplay = computed(workspace, (ws) => ws?.name ?? props.wsKey);
  const statusLabel = computed(workspace, (ws) => ws?.status ?? "loading");
  const badgeDotClass = computed(statusLabel, (status) => [
    styles.badgeDot,
    status === "running"
      ? styles.badgeDotRunning
      : status === "error"
        ? styles.badgeDotError
        : status === "completed"
          ? styles.badgeDotCompleted
          : styles.badgeDotIdle,
  ]);
  const modeLabel = computed(workspace, (ws) => ws?.mode ?? "");
  const modeTag = computed(workspace, (ws) =>
    ws?.mode ? <span class={styles.modeTag}>{ws.mode}</span> : null,
  );

  const errorBanner = computed(error, (e) =>
    e ? <div class={styles.errorBanner}>{e}</div> : null,
  );

  const agentsSection = computed([workspace, agents], (ws, allAgents) => {
    const agentNames = ws?.agents ?? [];
    if (agentNames.length === 0) {
      return (
        <div class={styles.emptyStateText}>No agents</div>
      );
    }

    const agentMap = new Map(allAgents.map((agent) => [agent.name, agent]));

    return (
      <div class={styles.agentList}>
        {agentNames.map((name) => (
          (() => {
            const agent = agentMap.get(name);
            const dotClass = [
              styles.agentDot,
              agent?.state === "running" || agent?.state === "processing"
                ? styles.agentDotRunning
                : agent?.state === "error" || agent?.state === "failed"
                  ? styles.agentDotError
                  : agent?.state === "completed"
                    ? styles.agentDotCompleted
                    : styles.agentDotIdle,
            ];
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
                <span class={dotClass} />
              </div>
            );
          })()
        ))}
      </div>
    );
  });

  const channelsSection = computed(channels, (ch) => {
    if (ch.length === 0) {
      return <div class={styles.emptyStateText}>No channels</div>;
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
            <span class={badgeDotClass} />
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
            {computed(wsStatus, (st) =>
              st?.tag ? (
              <div class={styles.configRow}>
                <span class={styles.configLabel}>Tag</span>
                <span class={styles.configValue}>{st.tag}</span>
              </div>
              ) : null,
            )}
            <div class={styles.configRow}>
              <span class={styles.configLabel}>Created</span>
              <span class={styles.configValue}>{createdLabel}</span>
            </div>
          </div>
        </div>

        {/* Loops Section */}
        {computed(wsStatus, (st) => {
          const loops = st?.loops ?? [];
          if (loops.length === 0) return null;
          return (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionTitle}>Loops</span>
                <span class={styles.count}>{String(loops.length)}</span>
              </div>
              <div class={styles.loopList}>
                {loops.map((loop) => (
                  <div class={styles.loopItem}>
                    <span class={[styles.loopDot, loop.running ? styles.loopDotRunning : styles.loopDotIdle]} />
                    <span class={styles.loopName}>{loop.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Recent Events Section */}
        {computed(wsEvents, (events) => {
          if (events.length === 0) return null;
          return (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionTitle}>Recent Events</span>
                <span class={styles.count}>{String(events.length)}</span>
              </div>
              <div class={styles.eventList}>
                {events.map((evt) => (
                  <div class={styles.eventItem}>
                    <span class={styles.eventTime}>
                      {new Date(evt.ts).toLocaleTimeString()}
                    </span>
                    <span class={styles.eventType}>{evt.type}</span>
                    <span class={styles.eventDetail}>
                      {evt.agent ? String(evt.agent) : ""}
                      {evt.workspace ? ` @${String(evt.workspace)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Danger Zone */}
        <div class={styles.dangerSection}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Danger Zone</span>
          </div>
          <button
            class={styles.dangerBtn}
            onclick={() => (showDeleteWs.value = true)}
          >
            Delete Workspace
          </button>
        </div>
      </div>

      <ConfirmDialog
        visible={showDeleteWs}
        title="Delete Workspace"
        message={`Are you sure you want to stop and remove workspace "${props.wsKey}"? All agents will be stopped.`}
        confirmLabel="Delete"
        danger={true}
        onConfirm={async () => {
          await deleteWorkspace(props.wsKey);
          selectGlobalSettings();
        }}
      />
    </div>
  );
}
