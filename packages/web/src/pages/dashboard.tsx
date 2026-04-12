/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { agents, agentsLoading, fetchAgents } from "../stores/agents.ts";
import { workspaces, workspacesLoading, fetchWorkspaces } from "../stores/workspaces.ts";
import { AgentCard } from "../components/agent-card.tsx";
import { WorkspaceCard } from "../components/workspace-card.tsx";
import {
  CreateWorkspaceDialog,
  showCreateWorkspace,
} from "../components/create-workspace-dialog.tsx";
import { CreateAgentDialog, showCreateAgent } from "../components/create-agent-dialog.tsx";
import * as styles from "./dashboard.style.ts";

export function DashboardPage() {
  // Fetch data on mount
  fetchAgents();
  fetchWorkspaces();

  const agentCount = computed(agents, (a) => a.length);
  const workspaceCount = computed(workspaces, (w) => w.length);

  const agentsSection = computed([agents, agentsLoading], (list, loading) =>
    loading ? (
      <div class={[styles.empty, styles.loading]}>Loading agents...</div>
    ) : list.length > 0 ? (
      <div class={styles.grid}>
        {list.map((agent) => (
          <AgentCard agent={agent} />
        ))}
      </div>
    ) : (
      <div class={styles.empty}>No agents</div>
    ),
  );

  const workspacesSection = computed([workspaces, workspacesLoading], (list, loading) =>
    loading ? (
      <div class={[styles.empty, styles.loading]}>Loading workspaces...</div>
    ) : list.length > 0 ? (
      <div class={styles.grid}>
        {list.map((ws) => (
          <WorkspaceCard workspace={ws} />
        ))}
      </div>
    ) : (
      <div class={styles.empty}>No workspaces</div>
    ),
  );

  return (
    <div class={styles.page}>
      <div class={styles.section}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Agents</span>
          <span class={styles.count}>({agentCount})</span>
          <button
            class={styles.newBtn}
            onclick={() => {
              showCreateAgent.value = true;
            }}
          >
            New Agent
          </button>
        </div>
        {agentsSection}
      </div>

      <div class={styles.section}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Workspaces</span>
          <span class={styles.count}>({workspaceCount})</span>
          <button
            class={styles.newBtn}
            onclick={() => {
              showCreateWorkspace.value = true;
            }}
          >
            New Workspace
          </button>
        </div>
        {workspacesSection}
      </div>

      <CreateWorkspaceDialog />
      <CreateAgentDialog />
    </div>
  );
}
