/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { agents, agentsLoading, fetchAgents } from "../stores/agents.ts";
import { harnesses, harnessesLoading, fetchHarnesses } from "../stores/harnesses.ts";
import { AgentCard } from "../components/agent-card.tsx";
import { HarnessCard } from "../components/harness-card.tsx";
import {
  CreateHarnessDialog,
  showCreateHarness,
} from "../components/create-harness-dialog.tsx";
import { CreateAgentDialog, showCreateAgent } from "../components/create-agent-dialog.tsx";
import * as styles from "./dashboard.style.ts";

export function DashboardPage() {
  // Fetch data on mount
  fetchAgents();
  fetchHarnesses();

  const agentCount = computed(agents, (a) => a.length);
  const harnessCount = computed(harnesses, (w) => w.length);

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

  const harnessesSection = computed([harnesses, harnessesLoading], (list, loading) =>
    loading ? (
      <div class={[styles.empty, styles.loading]}>Loading harnesses...</div>
    ) : list.length > 0 ? (
      <div class={styles.grid}>
        {list.map((ws) => (
          <HarnessCard harness={ws} />
        ))}
      </div>
    ) : (
      <div class={styles.empty}>No harnesses</div>
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
          <span class={styles.sectionTitle}>Harnesses</span>
          <span class={styles.count}>({harnessCount})</span>
          <button
            class={styles.newBtn}
            onclick={() => {
              showCreateHarness.value = true;
            }}
          >
            New Harness
          </button>
        </div>
        {harnessesSection}
      </div>

      <CreateHarnessDialog />
      <CreateAgentDialog />
    </div>
  );
}
