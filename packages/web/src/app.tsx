/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";
import { computed, signal } from "semajsx/signal";
import { AppShell } from "./components/layout/app-shell.tsx";
import {
  currentWorkspace,
  sidebarTab,
  selectedItem,
  selectChannel,
  selectDoc,
  selectAgent,
  selectWorkspaceSettings,
  selectGlobalEvents,
  selectGlobalSettings,
  type SelectedItem,
} from "./stores/navigation.ts";
import { wsAgents, wsChannels, wsDocs, wsInfo } from "./stores/workspace-data.ts";
import { workspaces } from "./stores/workspaces.ts";
import {
  ClaudeIcon,
  CursorIcon,
  OpenAIIcon,
  VercelIcon,
  parsePlatformName,
} from "./components/brand-icons.tsx";
import { Icon, Drama } from "semajsx/icons";
import * as styles from "./app.style.ts";

// Import all views
import { ChannelView } from "./views/channel-view.tsx";
import { AgentConversationView } from "./views/agent-conversation-view.tsx";
import { AgentInfoView } from "./views/agent-info-view.tsx";
import { DocViewerPanel } from "./views/doc-viewer-panel.tsx";
import { WorkspaceSettingsView } from "./views/workspace-settings-view.tsx";
import { GlobalSettingsView } from "./views/global-settings-view.tsx";
import { GlobalEventsView } from "./views/global-events-view.tsx";
import { CreateDocDialog } from "./components/create-doc-dialog.tsx";

const mobileQuery = typeof window !== "undefined"
  ? window.matchMedia("(max-width: 900px)")
  : null;
const isMobileViewport = signal(mobileQuery?.matches ?? false);

if (mobileQuery) {
  mobileQuery.addEventListener("change", (event) => {
    isMobileViewport.value = event.matches;
  });
}

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

function createView(item: SelectedItem) {
  switch (item.kind) {
    case "channel":
      return <ChannelView wsKey={item.wsKey} channel={item.channel} />;
    case "agent":
      return <AgentConversationView name={item.name} />;
    case "agent-info":
      return <AgentInfoView name={item.name} />;
    case "doc":
      return <DocViewerPanel wsKey={item.wsKey} docName={item.docName} />;
    case "workspace-settings":
      return <WorkspaceSettingsView wsKey={item.wsKey} />;
    case "global-settings":
      return <GlobalSettingsView />;
    case "global-events":
      return <GlobalEventsView />;
  }
}

function MobileHome() {
  const workspaceName = computed([wsInfo, currentWorkspace], (info, key) => info?.name ?? key);
  const selectedWorkspace = computed(currentWorkspace, (ws) => ws);
  const workspaceOptions = computed(workspaces, (list) =>
    list.map((ws) => <option value={ws.name}>{ws.name}</option>));
  const channelCount = computed(wsChannels, (list) => list.length);
  const agentCount = computed(wsAgents, (list) => list.length);
  const docCount = computed(wsDocs, (list) => list.length);
  const activeTab = computed(sidebarTab, (tab) => tab);
  const resourceButtonClass = (selected: boolean) =>
    selected
      ? [styles.mobileResourceButton, styles.resourceRow, styles.resourceRowSelected]
      : [styles.mobileResourceButton, styles.resourceRow];

  const resourceList = computed([sidebarTab, wsChannels, wsAgents, wsDocs], (tab, channels, agents, docs) => {
    if (tab === "channels") {
      if (channels.length === 0) {
        return <div class={styles.mobileResourceEmpty}>No channels</div>;
      }
      return channels.map((channel) => {
        const parsed = parsePlatformName(channel);
        const isSelected = selectedItem.value?.kind === "channel"
          && selectedItem.value.channel === channel
          && selectedItem.value.wsKey === currentWorkspace.value;
        return (
          <button
            class={resourceButtonClass(isSelected)}
            onclick={() => selectChannel(currentWorkspace.value, channel)}
          >
            <span class={styles.mobileResourceIcon}>
              {parsed.icon ? parsed.icon({ size: 13 }) : "#"}
            </span>
            <span class={styles.mobileResourceBody}>
              <span class={styles.mobileResourceTitle}>
                {parsed.name}
              </span>
              <span class={styles.mobileResourceMeta}>
                Channel
              </span>
            </span>
          </button>
        );
      });
    }

    if (tab === "agents") {
      if (agents.length === 0) {
        return <div class={styles.mobileResourceEmpty}>No agents</div>;
      }
      return agents.map((agent) => {
        const isSelected = selectedItem.value?.kind === "agent"
          && selectedItem.value.name === agent.name;
        return (
          <button
            class={resourceButtonClass(isSelected)}
            onclick={() => selectAgent(agent.name)}
          >
            <span class={styles.mobileResourceIcon}>
              {runtimeIcon(agent.runtime)}
            </span>
            <span class={styles.mobileResourceBody}>
              <span class={styles.mobileResourceTitle}>
                {agent.name}
              </span>
              <span class={styles.mobileResourceMeta}>
                {agent.runtime}
              </span>
            </span>
          </button>
        );
      });
    }

    if (docs.length === 0) {
      return <div class={styles.mobileResourceEmpty}>No docs</div>;
    }
    return docs.map((doc) => {
      const isSelected = selectedItem.value?.kind === "doc"
        && selectedItem.value.docName === doc.name
        && selectedItem.value.wsKey === currentWorkspace.value;
      return (
        <button
          class={resourceButtonClass(isSelected)}
          onclick={() => selectDoc(currentWorkspace.value, doc.name)}
        >
          <span class={styles.mobileResourceIcon}>
            •
          </span>
          <span class={styles.mobileResourceBody}>
            <span class={styles.mobileResourceTitle}>
              {doc.name}
            </span>
            <span class={styles.mobileResourceMeta}>
              Document
            </span>
          </span>
        </button>
      );
    });
  });

  return (
    <div class={styles.mobileHome}>
      <div class={styles.mobileIntro}>
        <div class={styles.mobileTitle}>
          {workspaceName}
        </div>
        <div class={styles.mobileSubtitle}>
          Browse channels, agents, and docs from one mobile home screen.
        </div>
      </div>

      <select
        class={styles.mobileSelect}
        value={selectedWorkspace}
        onchange={(e: Event) => {
          currentWorkspace.value = (e.target as HTMLSelectElement).value;
          selectedItem.value = null;
        }}
      >
        {workspaceOptions}
      </select>

      <div class={styles.mobileStats}>
        {[
          { label: "Agents", value: agentCount },
          { label: "Channels", value: channelCount },
          { label: "Docs", value: docCount },
        ].map((item) => (
          <div class={styles.mobileStatCard}>
            <span class={styles.mobileStatLabel}>
              {item.label}
            </span>
            <span class={styles.mobileStatValue}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div class={styles.mobileTabBar}>
        {[
          { key: "channels", label: "Channels" },
          { key: "agents", label: "Agents" },
          { key: "docs", label: "Docs" },
        ].map((tab) => (
          <button
            class={computed(activeTab, (current) =>
              current === tab.key ? [styles.mobileTab, styles.mobileTabActive] : styles.mobileTab)}
            onclick={() => {
              sidebarTab.value = tab.key as typeof sidebarTab.value;
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div class={styles.mobileResourceList}>
        {resourceList}
      </div>

      <div class={styles.mobileFooterActions}>
        <button
          class={styles.mobileFooterButton}
          onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
        >
          Workspace
        </button>
        <button
          class={styles.mobileFooterButton}
          onclick={() => selectGlobalEvents()}
        >
          Event Log
        </button>
        <button
          class={styles.mobileFooterButton}
          onclick={() => selectGlobalSettings()}
        >
          Settings
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  const workspaceName = computed([wsInfo, currentWorkspace], (info, key) => info?.name ?? key);
  const channelCount = computed(wsChannels, (list) => list.length);
  const agentCount = computed(wsAgents, (list) => list.length);
  const docCount = computed(wsDocs, (list) => list.length);
  const firstChannel = computed(wsChannels, (list) => list[0] ?? null);
  const firstDoc = computed(wsDocs, (list) => list[0]?.name ?? null);

  return (
    <div class={styles.emptyState}>
      <div class={styles.emptyHero}>
        <div class={styles.emptyLogo}>
          <VercelIcon size={24} />
        </div>
        <div class={styles.emptyTitle}>
          Workspace overview
        </div>
        <div class={styles.emptyWorkspace}>
          {workspaceName}
        </div>
        <div class={styles.emptyDescription}>
          Select a channel, agent, or document from the sidebar to inspect the workspace,
          review conversations, and coordinate agent activity.
        </div>
      </div>

      <div class={styles.emptyPanel}>
        <div class={styles.emptyStats}>
          {[
            { label: "Agents", value: agentCount },
            { label: "Channels", value: channelCount },
            { label: "Docs", value: docCount },
          ].map((item) => (
            <div class={styles.emptyStatCard}>
              <span class={styles.emptyStatLabel}>
                {item.label}
              </span>
              <span class={styles.emptyStatValue}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
        <div class={styles.emptyActions}>
          <div
            class={styles.emptyAction}
            onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
          >
            Open workspace overview
          </div>
          {computed(firstChannel, (channel) =>
            channel ? (
              <div
                class={styles.emptyAction}
                onclick={() => selectChannel(currentWorkspace.value, channel)}
              >
                Open #{channel}
              </div>
            ) : null,
          )}
          {computed(firstDoc, (docName) =>
            docName ? (
              <div
                class={styles.emptyAction}
                onclick={() => selectDoc(currentWorkspace.value, docName)}
              >
                Open doc: {docName}
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

// Track mount state for content area rendering
declare global {
  interface Window {
    __contentArea?: {
      mountEl: HTMLDivElement | null;
      currentKey: string;
      currentUnmount: (() => void) | null;
    };
  }
}

window.__contentArea = {
  mountEl: null,
  currentKey: "",
  currentUnmount: null,
};

function itemKey(item: SelectedItem | null): string {
  if (!item) return "__empty__";
  switch (item.kind) {
    case "channel": return `ch:${item.wsKey}:${item.channel}`;
    case "agent": return `agent:${item.name}`;
    case "agent-info": return `agent-info:${item.name}`;
    case "doc": return `doc:${item.wsKey}:${item.docName}`;
    case "workspace-settings": return `ws-settings:${item.wsKey}`;
    case "global-settings": return "global-settings";
    case "global-events": return "global-events";
  }
}

function renderContent() {
  const state = window.__contentArea!;
  if (!state.mountEl) return;

  const item = selectedItem.value;
  const key = itemKey(item);

  if (key === state.currentKey) return;
  state.currentKey = key;

  const t0 = performance.now();

  // Unmount previous view
  if (state.currentUnmount) {
    try {
      state.currentUnmount();
    } catch (err) {
      console.warn("[content] unmount error:", err);
    }
    state.currentUnmount = null;
  }

  // Clear DOM
  const el = state.mountEl;
  while (el.firstChild) el.removeChild(el.firstChild);

  const t1 = performance.now();

  // Render new view
  const vnode = item
    ? createView(item)
    : isMobileViewport.value
      ? <MobileHome />
      : <EmptyState />;
  const t2 = performance.now();

  const result = render(vnode, el);
  const t3 = performance.now();

  state.currentUnmount = result.unmount;

  const msg = `[renderContent] key=${key} unmount=${(t1-t0).toFixed(0)}ms createView=${(t2-t1).toFixed(0)}ms render=${(t3-t2).toFixed(0)}ms total=${(t3-t0).toFixed(0)}ms`;
  console.log(msg);
  // Write timing to a data attribute for testing
  (window as any).__lastRenderTiming = msg;
}

// Re-render content whenever selectedItem changes
selectedItem.subscribe(() => renderContent());
isMobileViewport.subscribe(() => renderContent());

function selectedLabel(item: SelectedItem | null): string {
  if (!item) return "";
  switch (item.kind) {
    case "channel":
      return `#${parsePlatformName(item.channel).name}`;
    case "agent":
      return item.name;
    case "agent-info":
      return `${item.name} info`;
    case "doc":
      return item.docName;
    case "workspace-settings":
      return "Workspace";
    case "global-settings":
      return "Settings";
    case "global-events":
      return "Event Log";
  }
}

export function App() {
  const mobileBackBar = computed([isMobileViewport, selectedItem], (mobile, item) => {
    if (!mobile || !item) return null;
    return (
      <div class={styles.mobileBackBar}>
        <button
          class={styles.mobileBackButton}
          onclick={() => {
            selectedItem.value = null;
          }}
        >
          Back
        </button>
        <span class={styles.mobileBackTitle}>
          {selectedLabel(item)}
        </span>
      </div>
    );
  });

  return (
    <AppShell>
      {mobileBackBar}
      <div
        class={styles.contentMount}
        ref={(el: HTMLDivElement | null) => {
          if (!el) return;
          window.__contentArea!.mountEl = el;
          renderContent();
        }}
      />
      <CreateDocDialog />
    </AppShell>
  );
}
