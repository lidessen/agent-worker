/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { signal, computed } from "semajsx/signal";
import { route, navigate } from "../router.ts";
import { client } from "../stores/connection.ts";
import { DocViewer } from "../components/doc-viewer.tsx";
import type { WorkspaceInfo, DocInfo, TaskSummary, TaskDetail } from "../api/types.ts";
import * as styles from "./workspace.style.ts";

export const WorkspacePage: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  const wsKey = computed(route, (r) => (r.page === "workspace" ? r.params.key : ""));

  const workspace = signal<WorkspaceInfo | null>(null);
  const channels = signal<string[]>([]);
  const docs = signal<DocInfo[]>([]);
  const expandedDoc = signal<string | null>(null);
  const error = signal<string | null>(null);
  const tasks = signal<TaskSummary[]>([]);
  const expandedTask = signal<string | null>(null);
  /** Cache of task detail fetched on row expansion. Keyed by task id. */
  const taskDetails = signal<Record<string, TaskDetail>>({});

  let currentKey = "";
  let unsubRoute: (() => void) | null = null;
  let eventStreamController: AbortController | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadWorkspace(key: string, force = false) {
    if (!key) return;
    if (key === currentKey && !force) return;
    currentKey = key;
    error.value = null;
    // Reset list signals so a fast navigation doesn't leave stale rows
    // from the previous workspace visible while the new fetch is in flight.
    tasks.value = [];
    // Tear down any event stream bound to the previous workspace.
    eventStreamController?.abort();
    eventStreamController = null;

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

      // Subscribe to the workspace event stream and refresh tasks whenever
      // a workspace.task_changed event lands. Debounce so a burst of
      // changes (dispatch + status transition + handoff) only triggers
      // one refetch.
      subscribeForTaskUpdates(key);
    } catch (err) {
      console.error(`Failed to load workspace ${key}:`, err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function subscribeForTaskUpdates(key: string) {
    const c = client.value;
    if (!c) return;
    const controller = new AbortController();
    eventStreamController = controller;

    const scheduleRefresh = (changedTaskId?: string) => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        refreshTimer = null;
        if (currentKey !== key) return;
        const liveClient = client.value;
        if (!liveClient) return;
        try {
          const fresh = await liveClient.listWorkspaceTasks(key);
          // Guard against stale arrivals after navigation away.
          if (currentKey === key) tasks.value = fresh;
        } catch (err) {
          console.warn(`Task refresh failed for ${key}:`, err);
        }
        // If the currently-expanded task changed, refetch its detail too.
        if (changedTaskId && expandedTask.value === changedTaskId) {
          await loadTaskDetail(changedTaskId);
        }
      }, 100);
    };

    void (async () => {
      try {
        for await (const event of c.streamWorkspaceEvents(key, { signal: controller.signal })) {
          if (controller.signal.aborted) return;
          const ev = event as { type?: string; taskId?: string };
          if (ev.type === "workspace.task_changed") {
            scheduleRefresh(ev.taskId);
          }
        }
      } catch (err) {
        // AbortError on teardown is expected; everything else is a warning.
        const name = (err as { name?: string })?.name;
        if (name !== "AbortError") {
          console.warn(`Workspace event stream for ${key} ended:`, err);
        }
      }
    })();
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
    eventStreamController?.abort();
    eventStreamController = null;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    currentKey = "";
  });

  function toggleDoc(name: string) {
    expandedDoc.value = expandedDoc.value === name ? null : name;
  }

  async function loadTaskDetail(taskId: string) {
    const c = client.value;
    const key = currentKey;
    if (!c || !key) return;
    try {
      const detail = await c.getWorkspaceTask(key, taskId);
      // Guard against stale arrivals after navigation away.
      if (currentKey !== key) return;
      taskDetails.value = { ...taskDetails.value, [taskId]: detail };
    } catch (err) {
      console.warn(`Task detail fetch failed for ${taskId}:`, err);
    }
  }

  function toggleTask(taskId: string) {
    if (expandedTask.value === taskId) {
      expandedTask.value = null;
      return;
    }
    expandedTask.value = taskId;
    if (!taskDetails.value[taskId]) {
      void loadTaskDetail(taskId);
    }
  }

  function renderTaskDetail(detail: TaskDetail | undefined) {
    if (!detail) {
      return <div class={styles.taskDetailLoading}>Loading…</div>;
    }
    const { wakes, handoffs } = detail;
    return (
      <div class={styles.taskDetail}>
        {wakes.length > 0 && (
          <div class={styles.taskDetailSection}>
            <div class={styles.taskDetailHeader}>Wakes ({wakes.length})</div>
            {wakes.map((w) => (
              <div class={styles.taskDetailItem}>
                <code>{w.id}</code> {w.agentName}{" "}
                <span class={styles.taskDetailBadge}>{w.status}</span>
                {w.resultSummary ? (
                  <div class={styles.taskDetailText}>{w.resultSummary}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {handoffs.length > 0 && (
          <div class={styles.taskDetailSection}>
            <div class={styles.taskDetailHeader}>Handoffs ({handoffs.length})</div>
            {handoffs.map((h) => (
              <div class={styles.taskDetailItem}>
                <code>{h.id}</code> <span class={styles.taskDetailBadge}>{h.kind}</span>
                {" by "}
                {h.createdBy}
                <div class={styles.taskDetailText}>{h.summary}</div>
                {h.blockers.length > 0 && (
                  <div class={styles.taskDetailText}>blockers: {h.blockers.join("; ")}</div>
                )}
                {h.pending.length > 0 && (
                  <div class={styles.taskDetailText}>pending: {h.pending.join("; ")}</div>
                )}
                {h.resources.length > 0 && (
                  <div class={styles.taskDetailText}>resources: {h.resources.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {wakes.length === 0 && handoffs.length === 0 && (
          <div class={styles.taskDetailText}>No Wakes or handoffs yet.</div>
        )}
      </div>
    );
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

  const tasksSection = computed([tasks, expandedTask, taskDetails], (t, expanded, details) => {
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
          if (task.activeWakeId) metaParts.push(`active: ${task.activeWakeId}`);
          const isExpanded = expanded === task.id;
          const detail = details[task.id];
          return (
            <div class={styles.taskItem}>
              <div class={styles.taskHeader} onclick={() => toggleTask(task.id)}>
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
              {isExpanded && renderTaskDetail(detail)}
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
