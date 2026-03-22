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
import { Icon, Drama } from "@semajsx/icons";
import { tokens } from "./theme/tokens.ts";

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
      return <ClaudeIcon size={13} style="vertical-align:-2px;" />;
    case "codex":
      return <OpenAIIcon size={13} style="vertical-align:-2px;" />;
    case "cursor":
      return <CursorIcon size={13} style="vertical-align:-2px;" />;
    case "ai-sdk":
      return <VercelIcon size={11} style="vertical-align:-1px;" />;
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

  const resourceList = computed([sidebarTab, wsChannels, wsAgents, wsDocs], (tab, channels, agents, docs) => {
    if (tab === "channels") {
      if (channels.length === 0) {
        return <div style={`padding:${tokens.space.lg}; color:${tokens.colors.textDim};`}>No channels</div>;
      }
      return channels.map((channel) => {
        const parsed = parsePlatformName(channel);
        return (
          <button
            style={`display:flex; align-items:center; gap:${tokens.space.sm}; width:100%; padding:${tokens.space.md} ${tokens.space.md}; border:none; background:transparent; color:${tokens.colors.text}; font:inherit; border-radius:${tokens.radii.lg};`}
            onclick={() => selectChannel(currentWorkspace.value, channel)}
          >
            <span
              style={`display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.textMuted}; flex-shrink:0;`}
            >
              {parsed.icon ? parsed.icon({ size: 13 }) : "#"}
            </span>
            <span style={`display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:0; flex:1;`}>
              <span style={`font-size:${tokens.fontSizes.sm}; font-weight:${tokens.fontWeights.semibold}; color:${tokens.colors.text};`}>
                {parsed.name}
              </span>
              <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
                Channel
              </span>
            </span>
          </button>
        );
      });
    }

    if (tab === "agents") {
      if (agents.length === 0) {
        return <div style={`padding:${tokens.space.lg}; color:${tokens.colors.textDim};`}>No agents</div>;
      }
      return agents.map((agent) => (
        <button
          style={`display:flex; align-items:center; gap:${tokens.space.sm}; width:100%; padding:${tokens.space.md} ${tokens.space.md}; border:none; background:transparent; color:${tokens.colors.text}; font:inherit; border-radius:${tokens.radii.lg};`}
          onclick={() => selectAgent(agent.name)}
        >
          <span
            style={`display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.textMuted}; flex-shrink:0;`}
          >
            {runtimeIcon(agent.runtime)}
          </span>
          <span style={`display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:0; flex:1;`}>
            <span style={`font-size:${tokens.fontSizes.sm}; font-weight:${tokens.fontWeights.semibold}; color:${tokens.colors.text};`}>
              {agent.name}
            </span>
            <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
              {agent.runtime}
            </span>
          </span>
        </button>
      ));
    }

    if (docs.length === 0) {
      return <div style={`padding:${tokens.space.lg}; color:${tokens.colors.textDim};`}>No docs</div>;
    }
    return docs.map((doc) => (
      <button
        style={`display:flex; align-items:center; gap:${tokens.space.sm}; width:100%; padding:${tokens.space.md} ${tokens.space.md}; border:none; background:transparent; color:${tokens.colors.text}; font:inherit; border-radius:${tokens.radii.lg};`}
        onclick={() => selectDoc(currentWorkspace.value, doc.name)}
      >
        <span
          style={`display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.textMuted}; flex-shrink:0; font-weight:${tokens.fontWeights.semibold};`}
        >
          •
        </span>
        <span style={`display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:0; flex:1;`}>
          <span style={`font-size:${tokens.fontSizes.sm}; font-weight:${tokens.fontWeights.semibold}; color:${tokens.colors.text};`}>
            {doc.name}
          </span>
          <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
            Document
          </span>
        </span>
      </button>
    ));
  });

  return (
    <div
      style={`display:flex; flex:1; flex-direction:column; min-height:0; overflow:auto; padding:${tokens.space.md}; gap:${tokens.space.md}; background:${tokens.colors.backgroundElevated};`}
    >
      <div style={`display:flex; flex-direction:column; gap:${tokens.space.xs}; padding:${tokens.space.sm} ${tokens.space.xs};`}>
        <div style={`font-size:${tokens.fontSizes.xl}; font-weight:${tokens.fontWeights.bold}; color:${tokens.colors.text}; letter-spacing:-0.03em;`}>
          {workspaceName}
        </div>
        <div style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim}; line-height:1.5;`}>
          Browse channels, agents, and docs from one mobile home screen.
        </div>
      </div>

      <select
        style={`width:100%; background:${tokens.colors.surface}; color:${tokens.colors.text}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.md}; padding:${tokens.space.sm} ${tokens.space.md}; font:${tokens.fontSizes.sm} ${tokens.fonts.base};`}
        value={selectedWorkspace}
        onchange={(e: Event) => {
          currentWorkspace.value = (e.target as HTMLSelectElement).value;
          selectedItem.value = null;
        }}
      >
        {workspaceOptions}
      </select>

      <div style={`display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:${tokens.space.xs};`}>
        {[
          { label: "Agents", value: agentCount },
          { label: "Channels", value: channelCount },
          { label: "Docs", value: docCount },
        ].map((item) => (
          <div
            style={`padding:${tokens.space.sm}; border-radius:${tokens.radii.lg}; background:${tokens.colors.surface}; border:1px solid ${tokens.colors.border}; display:flex; flex-direction:column; gap:2px;`}
          >
            <span style={`font-size:0.65rem; color:${tokens.colors.textDim}; text-transform:uppercase; letter-spacing:0.08em;`}>
              {item.label}
            </span>
            <span style={`font-size:${tokens.fontSizes.lg}; font-weight:${tokens.fontWeights.semibold}; color:${tokens.colors.text};`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div style={`display:flex; gap:2px; padding:2px; background:${tokens.colors.surface}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.md};`}>
        {[
          { key: "channels", label: "Channels" },
          { key: "agents", label: "Agents" },
          { key: "docs", label: "Docs" },
        ].map((tab) => (
          <button
            style={computed(activeTab, (current) =>
              `flex:1; border:none; border-radius:${tokens.radii.sm}; padding:9px ${tokens.space.xs}; background:${current === tab.key ? tokens.colors.surfaceActive : "transparent"}; color:${current === tab.key ? tokens.colors.text : tokens.colors.textMuted}; font:${tokens.fontSizes.xs} ${tokens.fonts.base}; font-weight:${tokens.fontWeights.medium};`)}
            onclick={() => {
              sidebarTab.value = tab.key as typeof sidebarTab.value;
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        style={`display:flex; flex-direction:column; gap:${tokens.space.xs}; padding:${tokens.space.xs}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.xl}; background:${tokens.colors.panel}; box-shadow:${tokens.shadows.inset};`}
      >
        {resourceList}
      </div>

      <div style={`display:flex; flex-direction:column; gap:${tokens.space.xs}; margin-top:auto; padding-top:${tokens.space.sm};`}>
        <button
          style={`width:100%; text-align:left; padding:${tokens.space.sm} ${tokens.space.md}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.text}; font:${tokens.fontSizes.sm} ${tokens.fonts.base};`}
          onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
        >
          Workspace
        </button>
        <button
          style={`width:100%; text-align:left; padding:${tokens.space.sm} ${tokens.space.md}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.text}; font:${tokens.fontSizes.sm} ${tokens.fonts.base};`}
          onclick={() => selectGlobalEvents()}
        >
          Event Log
        </button>
        <button
          style={`width:100%; text-align:left; padding:${tokens.space.sm} ${tokens.space.md}; border:1px solid ${tokens.colors.border}; border-radius:${tokens.radii.md}; background:${tokens.colors.surface}; color:${tokens.colors.text}; font:${tokens.fontSizes.sm} ${tokens.fonts.base};`}
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
    <div
      style={`display:flex; flex:1; flex-direction:column; justify-content:center; padding:${tokens.space.xxxl}; gap:${tokens.space.xxl};`}
    >
      <div
        style={`display:flex; flex-direction:column; align-items:center; gap:${tokens.space.md}; text-align:center; max-width:560px; margin:0 auto;`}
      >
        <div
          style={`display:flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:${tokens.radii.xl}; background:${tokens.colors.surfaceSecondary}; border:1px solid ${tokens.colors.border}; box-shadow:${tokens.shadows.glow}; color:${tokens.colors.textMuted};`}
        >
          <VercelIcon size={24} />
        </div>
        <div
          style={`font-size:${tokens.fontSizes.xxl}; line-height:1.04; font-weight:${tokens.fontWeights.bold}; letter-spacing:-0.04em; color:${tokens.colors.text};`}
        >
          Workspace overview
        </div>
        <div
          style={`font-size:${tokens.fontSizes.xl}; line-height:1.1; color:${tokens.colors.textMuted}; font-weight:${tokens.fontWeights.semibold};`}
        >
          {workspaceName}
        </div>
        <div
          style={`font-size:${tokens.fontSizes.sm}; line-height:1.6; color:${tokens.colors.textDim}; max-width:420px;`}
        >
          Select a channel, agent, or document from the sidebar to inspect the workspace,
          review conversations, and coordinate agent activity.
        </div>
      </div>

      <div
        style={`display:flex; flex-direction:column; gap:${tokens.space.lg}; width:min(100%, 860px); margin:0 auto;`}
      >
        <div
          style={`display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:${tokens.space.md};`}
        >
          {[
            { label: "Agents", value: agentCount },
            { label: "Channels", value: channelCount },
            { label: "Docs", value: docCount },
          ].map((item) => (
            <div
              style={`padding:${tokens.space.lg}; border-radius:${tokens.radii.xl}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; color:${tokens.colors.textMuted}; box-shadow:${tokens.shadows.inset}; display:flex; flex-direction:column; gap:${tokens.space.xs};`}
            >
              <span style={`font-size:${tokens.fontSizes.xs}; text-transform:uppercase; letter-spacing:0.08em; color:${tokens.colors.textDim};`}>
                {item.label}
              </span>
              <span style={`font-size:${tokens.fontSizes.xxl}; line-height:1; font-weight:${tokens.fontWeights.semibold}; color:${tokens.colors.text};`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
        <div
          style={`display:flex; flex-wrap:wrap; justify-content:center; gap:${tokens.space.sm};`}
        >
          <div
            style={`padding:${tokens.space.sm} ${tokens.space.lg}; border-radius:${tokens.radii.pill}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; color:${tokens.colors.textMuted}; cursor:pointer;`}
            onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
          >
            Open workspace overview
          </div>
          {computed(firstChannel, (channel) =>
            channel ? (
              <div
                style={`padding:${tokens.space.sm} ${tokens.space.lg}; border-radius:${tokens.radii.pill}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; color:${tokens.colors.textMuted}; cursor:pointer;`}
                onclick={() => selectChannel(currentWorkspace.value, channel)}
              >
                Open #{channel}
              </div>
            ) : null,
          )}
          {computed(firstDoc, (docName) =>
            docName ? (
              <div
                style={`padding:${tokens.space.sm} ${tokens.space.lg}; border-radius:${tokens.radii.pill}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; color:${tokens.colors.textMuted}; cursor:pointer;`}
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
      <div
        style={`display:flex; align-items:center; gap:${tokens.space.sm}; padding:${tokens.space.sm} ${tokens.space.md}; border-bottom:1px solid ${tokens.colors.border}; background:${tokens.colors.backgroundElevated};`}
      >
        <button
          style={`border:none; background:transparent; color:${tokens.colors.accent}; font:${tokens.fontSizes.sm} ${tokens.fonts.base}; font-weight:${tokens.fontWeights.medium}; padding:0;`}
          onclick={() => {
            selectedItem.value = null;
          }}
        >
          Back
        </button>
        <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.text}; font-weight:${tokens.fontWeights.semibold};`}>
          {selectedLabel(item)}
        </span>
      </div>
    );
  });

  return (
    <AppShell>
      {mobileBackBar}
      <div
        style="display: flex; flex-direction: column; flex: 1; overflow: hidden;"
        ref={(el: HTMLDivElement) => {
          window.__contentArea!.mountEl = el;
          renderContent();
        }}
      />
      <CreateDocDialog />
    </AppShell>
  );
}
