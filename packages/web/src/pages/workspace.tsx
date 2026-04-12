/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { signal, computed } from "semajsx/signal";
import { route, navigate } from "../router.ts";
import { client } from "../stores/connection.ts";
import { DocViewer } from "../components/doc-viewer.tsx";
import type { WorkspaceInfo, DocInfo, TaskSummary } from "../api/types.ts";
import * as styles from "./workspace.style.ts";

export const WorkspacePage: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  const wsKey = computed(route, (r) => (r.page === "workspace" ? r.params.key : ""));

  const workspace = signal<WorkspaceInfo | null>(null);
  const channels = signal<string[]>([]);
  const docs = signal<DocInfo[]>([]);
  const expandedDoc = signal<string | null>(null);
  const error = signal<string | null>(null);
  const tasks = signal<TaskSummary[]>([]);

  let currentKey = "";
  let unsubRoute: (() => void) | null = null;

  async function loadWorkspace(key: string, force = false) {
    if (!key) return;
    if (key === currentKey && !force) return;
    currentKey = key;
    error.value = null;

    const c = client.value;
    if (!c) return;

    try {
      const [ws, ch, docList, taskList] = await Promise.all([
        c.getWorkspace(key),
        c.listChannels(key),
        c.listDocs(key),
        c.listWorkspaceTasks(key).catch((err) => {
          // Task endpoint is new — swallow 404s against older daemons.
          console.warn(`Task list unavailable for ${key}:`, err);
          return [] as TaskSummary[];
        }),
      ]);
      workspace.value = ws;
      channels.value = ch;
      docs.value = docList;
      tasks.value = taskList;
    } catch (err) {
      console.error(`Failed to load workspace ${key}:`, err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  loadWorkspace(wsKey.value);

  unsubRoute = wsKey.subscribe((newKey) => {
    loadWorkspace(newKey);
  });

  // Retry loading when client connects (handles race with auto-connect)
  const unsubClient = client.subscribe((c) => {
    if (c && wsKey.value && !workspace.value) {
      loadWorkspace(wsKey.value, true);
    }
  });

  ctx.onCleanup(() => {
    unsubRoute?.();
    unsubRoute = null;
    unsubClient();
    currentKey = "";
  });

  function toggleDoc(name: string) {
    expandedDoc.value = expandedDoc.value === name ? null : name;
  }

  const wsNameDisplay = computed([workspace, wsKey], (ws, key) => ws?.name ?? key);
  const statusLabel = computed(workspace, (ws) => ws?.status ?? "loading");
  const badgeDotClass = computed(statusLabel, (status) => [
    styles.badgeDot,
    status === "running"
      ? styles.badgeDotRunning
      : status === "error"
        ? styles.badgeDotError
        : status === "completed"
          ? styles.badgeDotCompleted
          : styles.badgeDotStopped,
  ]);
  const modeTag = computed(workspace, (ws) =>
    ws?.mode ? <span class={styles.modeTag}>{ws.mode}</span> : null,
  );

  const errorBanner = computed(error, (e) =>
    e ? <div class={styles.errorBanner}>{e}</div> : null,
  );

  const agentsSection = computed(workspace, (ws) => {
    const agentNames = ws?.agents ?? [];
    if (agentNames.length === 0) {
      return <div class={styles.emptyStateText}>No agents</div>;
    }
    return (
      <div class={styles.agentList}>
        {agentNames.map((name) => (
          <div class={styles.agentItem}>
            <span class={styles.agentDot} />
            {name}
          </div>
        ))}
      </div>
    );
  });

  const channelsSection = computed([channels, wsKey], (ch, wk) => {
    if (ch.length === 0) {
      return <div class={styles.emptyStateText}>No channels</div>;
    }
    return (
      <div class={styles.channelList}>
        {ch.map((name) => (
          <div
            class={styles.channelItem}
            onclick={() => navigate(`/workspaces/${wk}/channels/${name}`)}
          >
            # {name}
          </div>
        ))}
      </div>
    );
  });

  const docsSection = computed([docs, expandedDoc, wsKey], (d, exp, wk) => {
    if (d.length === 0) {
      return <div class={styles.emptyStateText}>No documents</div>;
    }
    return (
      <div class={styles.docList}>
        {d.map((doc) => (
          <div>
            <div class={styles.docItem} onclick={() => toggleDoc(doc.name)}>
              <span class={styles.docItemName}>{doc.name}</span>
              <span class={styles.docItemActions}>{exp === doc.name ? "collapse" : "expand"}</span>
            </div>
            {exp === doc.name ? <DocViewer wsKey={wk} docName={doc.name} /> : null}
          </div>
        ))}
      </div>
    );
  });

  const agentCount = computed(workspace, (ws) => ws?.agents.length ?? 0);
  const channelCount = computed(channels, (ch) => ch.length);
  const docCount = computed(docs, (d) => d.length);
  const taskCount = computed(tasks, (t) => t.length);

  const tasksSection = computed(tasks, (t) => {
    if (t.length === 0) {
      return <div class={styles.emptyStateText}>No tasks</div>;
    }
    // Sort: draft / open / in_progress / blocked first, then terminal.
    const order: Record<string, number> = {
      draft: 0,
      open: 1,
      in_progress: 2,
      blocked: 3,
      completed: 4,
      aborted: 5,
      failed: 6,
    };
    const sorted = [...t].sort((a, b) => {
      const diff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
      return diff !== 0 ? diff : a.createdAt - b.createdAt;
    });
    return (
      <div class={styles.taskList}>
        {sorted.map((task) => {
          const metaParts: string[] = [];
          if (task.ownerLeadId) metaParts.push(`owner: ${task.ownerLeadId}`);
          if (task.activeAttemptId) metaParts.push(`active: ${task.activeAttemptId}`);
          if (task.artifactRefs.length > 0)
            metaParts.push(`artifacts: ${task.artifactRefs.length}`);
          return (
            <div class={styles.taskItem}>
              <div class={styles.taskHeader}>
                <span class={styles.taskTitle}>{task.title}</span>
                <span class={styles.taskStatusBadge}>{task.status}</span>
              </div>
              <div class={styles.taskGoal}>{task.goal}</div>
              {metaParts.length > 0 && (
                <div class={styles.taskMeta}>
                  {metaParts.map((p) => (
                    <span>{p}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  });

  return (
    <div class={styles.page} data-page="workspace">
      <div class={styles.header}>
        <button class={styles.backBtn} onclick={() => navigate("/")}>
          Back
        </button>
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

        {/* Agents Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Agents</span>
            <span class={styles.count}>({agentCount})</span>
          </div>
          {agentsSection}
        </div>

        {/* Tasks Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Tasks</span>
            <span class={styles.count}>({taskCount})</span>
          </div>
          {tasksSection}
        </div>

        {/* Channels Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Channels</span>
            <span class={styles.count}>({channelCount})</span>
          </div>
          {channelsSection}
        </div>

        {/* Docs Section */}
        <div class={styles.section}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Documents</span>
            <span class={styles.count}>({docCount})</span>
          </div>
          {docsSection}
        </div>
      </div>
    </div>
  );
};
