/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";
import { computed, signal } from "semajsx/signal";
import { AppShell } from "./components/layout/app-shell.tsx";
import {
  currentWorkspace,
  selectedItem,
  selectChannel,
  selectAgent,
  selectWorkspaceSettings,
  selectGlobalEvents,
  type SelectedItem,
} from "./stores/navigation.ts";
import { wsInfo } from "./stores/workspace-data.ts";
import { agents } from "./stores/agents.ts";
import { workspaces } from "./stores/workspaces.ts";
import {
  ClaudeIcon,
  CursorIcon,
  OpenAIIcon,
  VercelIcon,
  parsePlatformName,
} from "./components/brand-icons.tsx";
import {
  Icon,
  Drama,
  Search,
  Sun,
  Moon,
  Home,
  Terminal,
  Folder,
  Zap,
} from "semajsx/icons";
import { resolvedTheme, toggleTheme } from "./theme/tokens.ts";
import * as styles from "./app.style.ts";

// Import all views
import { ChannelView } from "./views/channel-view.tsx";
import { AgentConversationView } from "./views/agent-conversation-view.tsx";
import { AgentInfoView } from "./views/agent-info-view.tsx";
import { DocViewerPanel } from "./views/doc-viewer-panel.tsx";
import { WorkspaceSettingsView } from "./views/workspace-settings-view.tsx";
import { GlobalSettingsView } from "./views/global-settings-view.tsx";
import { GlobalEventsView } from "./views/global-events-view.tsx";
import { DashboardView } from "./views/dashboard-view.tsx";
import { CreateAgentDialog } from "./components/create-agent-dialog.tsx";
import { CreateDocDialog } from "./components/create-doc-dialog.tsx";
import { CreateWorkspaceDialog } from "./components/create-workspace-dialog.tsx";

const mobileQuery = typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)") : null;
const isMobileViewport = signal(mobileQuery?.matches ?? false);

if (mobileQuery) {
  mobileQuery.addEventListener("change", (event) => {
    isMobileViewport.value = event.matches;
  });
}

type MobileResource = "agents" | "workspaces" | "events";
const mobileResource = signal<MobileResource>("agents");

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

function agentDotClass(state: string) {
  if (state === "running" || state === "processing") return [styles.mRowDot, styles.mRowDotRunning];
  if (state === "error" || state === "failed") return [styles.mRowDot, styles.mRowDotError];
  return [styles.mRowDot, styles.mRowDotIdle];
}

function wsDotClass(status: string) {
  if (status === "running") return [styles.mRowDot, styles.mRowDotRunning];
  if (status === "error") return [styles.mRowDot, styles.mRowDotError];
  return [styles.mRowDot, styles.mRowDotIdle];
}

function MobileHome() {
  const workspaceName = computed([wsInfo, currentWorkspace], (info, key) => info?.name ?? key);

  const resourceBody = computed([mobileResource, agents, workspaces], (res, agentList, wsList) => {
    if (res === "agents") {
      if (agentList.length === 0) {
        return <div style="padding:16px;color:var(--colors-textDim);font-size:13px">No agents</div>;
      }
      return (
        <div class={styles.mList}>
          {agentList.map((a) => (
            <button class={styles.mRow} onclick={() => selectAgent(a.name)}>
              <span class={agentDotClass(a.state)} />
              <div class={styles.mRowName}>
                <span class={styles.mRowT}>{a.name}</span>
                <span class={styles.mRowS}>
                  {a.runtime}
                  {a.workspace ? ` · ws/${a.workspace}` : ""}
                </span>
              </div>
              <span class={styles.mRowR}>{a.state}</span>
            </button>
          ))}
        </div>
      );
    }
    if (res === "workspaces") {
      if (wsList.length === 0) {
        return (
          <div style="padding:16px;color:var(--colors-textDim);font-size:13px">No workspaces</div>
        );
      }
      return (
        <div class={styles.mList}>
          {wsList.map((w) => (
            <button
              class={styles.mRow}
              onclick={() => {
                currentWorkspace.value = w.name;
                selectWorkspaceSettings(w.name);
              }}
            >
              <span class={wsDotClass(w.status)} />
              <div class={styles.mRowName}>
                <span class={styles.mRowT}>{w.label || w.name}</span>
                <span class={styles.mRowS}>
                  {w.agents.join(", ") || "no agents"}
                </span>
              </div>
              <span class={styles.mRowR}>{w.status}</span>
            </button>
          ))}
        </div>
      );
    }
    // events
    return (
      <div
        class={styles.mList}
        style="padding:16px;color:var(--colors-textDim);font-size:13px"
        onclick={() => selectGlobalEvents()}
      >
        Open the full Event Log
      </div>
    );
  });

  const agentCount = computed(agents, (list) => list.length);
  const wsCount = computed(workspaces, (list) => list.length);

  function tabCls(k: MobileResource) {
    return computed(mobileResource, (r) =>
      r === k ? [styles.mobileResTab, styles.mobileResTabActive] : styles.mobileResTab,
    );
  }

  const themeIcon = computed(resolvedTheme, (t) =>
    t === "dark" ? <Icon icon={Sun} size={14} /> : <Icon icon={Moon} size={14} />,
  );

  return (
    <div class={styles.mobileHome}>
      <div class={styles.mobileHead}>
        <div class={styles.mobileBrand}>
          <div class={styles.mobileLogo}>L</div>
          <span class={styles.mobileTitle}>{workspaceName}</span>
          <span class={styles.mobileDaemon}>
            <span class={styles.mobileDaemonDot} />
            daemon
          </span>
        </div>
        <div class={styles.mobileHeadRight}>
          <button class={styles.mobileIconBtn} onclick={() => toggleTheme()}>
            {themeIcon}
          </button>
          <button class={styles.mobileIconBtn}>
            <Icon icon={Search} size={14} />
          </button>
        </div>
      </div>

      <div class={styles.mobileResbar}>
        <button class={tabCls("agents")} onclick={() => (mobileResource.value = "agents")}>
          Agents <span class={styles.mobileResTabCount}>{agentCount}</span>
        </button>
        <button class={tabCls("workspaces")} onclick={() => (mobileResource.value = "workspaces")}>
          Workspaces <span class={styles.mobileResTabCount}>{wsCount}</span>
        </button>
        <button class={tabCls("events")} onclick={() => (mobileResource.value = "events")}>
          Events
        </button>
      </div>

      <div class={styles.mobileBody}>{resourceBody}</div>

      <div class={styles.mTabbar}>
        <button class={[styles.mTabbarBtn, styles.mTabbarBtnActive]}>
          <Icon icon={Home} size={18} />
          <span>Home</span>
        </button>
        <button
          class={styles.mTabbarBtn}
          onclick={() => {
            mobileResource.value = "agents";
          }}
        >
          <Icon icon={Terminal} size={18} />
          <span>Agent</span>
        </button>
        <button
          class={styles.mTabbarBtn}
          onclick={() => {
            mobileResource.value = "workspaces";
          }}
        >
          <Icon icon={Folder} size={18} />
          <span>Spaces</span>
        </button>
        <button class={styles.mTabbarBtn} onclick={() => selectGlobalEvents()}>
          <Icon icon={Zap} size={18} />
          <span>Events</span>
        </button>
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
    case "channel":
      return `ch:${item.wsKey}:${item.channel}`;
    case "agent":
      return `agent:${item.name}`;
    case "agent-info":
      return `agent-info:${item.name}`;
    case "doc":
      return `doc:${item.wsKey}:${item.docName}`;
    case "workspace-settings":
      return `ws-settings:${item.wsKey}`;
    case "global-settings":
      return "global-settings";
    case "global-events":
      return "global-events";
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
      : <DashboardView />;
  const t2 = performance.now();

  const result = render(vnode, el);
  const t3 = performance.now();

  state.currentUnmount = result.unmount;

  const msg = `[renderContent] key=${key} unmount=${(t1 - t0).toFixed(0)}ms createView=${(t2 - t1).toFixed(0)}ms render=${(t3 - t2).toFixed(0)}ms total=${(t3 - t0).toFixed(0)}ms`;
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
          ← Back
        </button>
        <span class={styles.mobileBackTitle}>{selectedLabel(item)}</span>
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
      <CreateAgentDialog />
      <CreateDocDialog />
      <CreateWorkspaceDialog />
    </AppShell>
  );
}
