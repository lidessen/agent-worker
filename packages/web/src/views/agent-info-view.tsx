/** @jsxImportSource semajsx/dom */

import type { ComponentAPI } from "semajsx";
import { Icon, ArrowLeft } from "semajsx/icons";
import { signal, computed } from "semajsx/signal";
import {
  fetchAgentState,
  agentState,
  startPolling,
  stopPolling,
  deleteAgent,
} from "../stores/agents.ts";
import { selectAgent, selectGlobalSettings } from "../stores/navigation.ts";
import { client } from "../stores/connection.ts";
import { AgentInspector } from "../components/agent-inspector.tsx";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import * as styles from "./agent-info-view.style.ts";

export function AgentInfoView(props: { name: string }, ctx?: ComponentAPI) {
  const showDeleteAgent = signal(false);

  // Fetch agent state and start polling
  fetchAgentState(props.name);
  startPolling(props.name);

  const unsubClient = client.subscribe((c) => {
    if (c && !agentState.value) {
      fetchAgentState(props.name);
    }
  });

  ctx?.onCleanup(() => {
    stopPolling();
    unsubClient();
  });

  const stateText = computed(agentState, (s) => s?.state ?? "unknown");
  const dotClass = computed(stateText, (state) => [
    styles.statusDot,
    state === "running" || state === "processing"
      ? styles.statusDotRunning
      : state === "error"
        ? styles.statusDotError
        : state === "completed"
          ? styles.statusDotCompleted
          : styles.statusDotIdle,
  ]);

  const workspace = computed(agentState, (s) => s?.workspace ?? null);
  const currentTask = computed(agentState, (s) => s?.currentTask ?? null);

  const workspaceRow = computed(workspace, (ws) => {
    if (!ws) return null;
    return (
      <div>
        <span class={styles.infoLabel}>Workspace</span>
        <span class={styles.infoValue}>{ws}</span>
      </div>
    );
  });

  const taskRow = computed(currentTask, (task) => {
    if (!task) return null;
    return (
      <div>
        <span class={styles.infoLabel}>Current Task</span>
        <span class={styles.infoValue}>{task}</span>
      </div>
    );
  });

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <button
          class={styles.backLink}
          onclick={() => selectAgent(props.name)}
        >
          <Icon icon={ArrowLeft} size={16} />
        </button>
        <span class={styles.agentName}>{props.name}</span>
      </div>

      <div class={styles.content}>
        {/* Status */}
        <div class={styles.section}>
          <span class={styles.sectionTitle}>Status</span>
          <div class={styles.statusRow}>
            <span class={dotClass} />
            <span class={styles.statusText}>{stateText}</span>
          </div>
        </div>

        {/* Agent Details */}
        <div class={styles.section}>
          <span class={styles.sectionTitle}>Details</span>
          <div class={styles.infoGrid}>
            {workspaceRow}
            {taskRow}
          </div>
        </div>

        {/* Inspector (state, inbox, todos) */}
        <div class={styles.section}>
          <span class={styles.sectionTitle}>Inspector</span>
          <AgentInspector agentState={agentState} />
        </div>

        {/* Action Buttons */}
        <div class={styles.section}>
          <span class={styles.sectionTitle}>Actions</span>
          <div class={styles.actionBar}>
            <button class={[styles.actionBtn, styles.actionBtnDanger]}>
              Stop
            </button>
            <button class={styles.actionBtn}>
              Restart
            </button>
            <button
              class={[styles.actionBtn, styles.actionBtnDanger]}
              onclick={() => (showDeleteAgent.value = true)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        visible={showDeleteAgent}
        title="Delete Agent"
        message={`Are you sure you want to delete agent "${props.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger={true}
        onConfirm={async () => {
          await deleteAgent(props.name);
          selectGlobalSettings();
        }}
      />
    </div>
  );
}
