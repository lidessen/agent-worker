/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { route, navigate } from "../router.ts";
import { client } from "../stores/connection.ts";
import { tokens } from "../theme/tokens.ts";
import { DocViewer } from "../components/doc-viewer.tsx";
import type { WorkspaceInfo, DocInfo } from "../api/types.ts";
import * as styles from "./workspace.style.ts";

const statusColors: Record<string, string> = {
  running: tokens.colors.agentRunning,
  stopped: tokens.colors.agentIdle,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
};

export function WorkspacePage() {
  const wsKey = computed(route, (r) =>
    r.page === "workspace" ? r.params.key : "",
  );

  const workspace = signal<WorkspaceInfo | null>(null);
  const channels = signal<string[]>([]);
  const docs = signal<DocInfo[]>([]);
  const expandedDoc = signal<string | null>(null);
  const error = signal<string | null>(null);

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
      const [ws, ch, docList] = await Promise.all([
        c.getWorkspace(key),
        c.listChannels(key),
        c.listDocs(key),
      ]);
      workspace.value = ws;
      channels.value = ch;
      docs.value = docList;
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

  onCleanup(() => {
    unsubRoute?.();
    unsubRoute = null;
    unsubClient();
    currentKey = "";
  });

  const dotColor = computed(workspace, (ws) =>
    statusColors[ws?.status ?? ""] ?? tokens.colors.agentIdle,
  );

  function toggleDoc(name: string) {
    expandedDoc.value = expandedDoc.value === name ? null : name;
  }

  const wsNameDisplay = computed([workspace, wsKey], (ws, key) => ws?.name ?? key);
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
      return (
        <div style={`font-size: ${tokens.fontSizes.sm}; color: ${tokens.colors.textMuted}`}>
          No documents
        </div>
      );
    }
    return (
      <div class={styles.docList}>
        {d.map((doc) => (
          <div>
            <div class={styles.docItem} onclick={() => toggleDoc(doc.name)}>
              <span class={styles.docItemName}>{doc.name}</span>
              <span class={styles.docItemActions}>
                {exp === doc.name ? "collapse" : "expand"}
              </span>
            </div>
            {exp === doc.name ? (
              <DocViewer wsKey={wk} docName={doc.name} />
            ) : null}
          </div>
        ))}
      </div>
    );
  });

  const agentCount = computed(workspace, (ws) => ws?.agents.length ?? 0);
  const channelCount = computed(channels, (ch) => ch.length);
  const docCount = computed(docs, (d) => d.length);

  return (
    <div class={styles.page} data-page="workspace">
      <div class={styles.header}>
        <button class={styles.backBtn} onclick={() => navigate("/")}>
          Back
        </button>
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
}
