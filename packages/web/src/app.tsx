/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";
import { computed } from "semajsx/signal";
import { AppShell } from "./components/layout/app-shell.tsx";
import {
  currentWorkspace,
  selectedItem,
  selectChannel,
  selectDoc,
  selectWorkspaceSettings,
  type SelectedItem,
} from "./stores/navigation.ts";
import { wsAgents, wsChannels, wsDocs, wsInfo } from "./stores/workspace-data.ts";
import { VercelIcon } from "./components/brand-icons.tsx";
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
  const vnode = item ? createView(item) : <EmptyState />;
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

export function App() {
  return (
    <AppShell>
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
