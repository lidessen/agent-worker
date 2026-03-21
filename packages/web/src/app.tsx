/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";
import { AppShell } from "./components/layout/app-shell.tsx";
import { selectedItem, type SelectedItem } from "./stores/navigation.ts";
import { OpenAIIcon } from "./components/brand-icons.tsx";
import { tokens } from "./theme/tokens.ts";

// Import all views
import { ChannelView } from "./views/channel-view.tsx";
import { AgentConversationView } from "./views/agent-conversation-view.tsx";
import { AgentInfoView } from "./views/agent-info-view.tsx";
import { DocViewerPanel } from "./views/doc-viewer-panel.tsx";
import { WorkspaceSettingsView } from "./views/workspace-settings-view.tsx";
import { GlobalSettingsView } from "./views/global-settings-view.tsx";

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
  }
}

function EmptyState() {
  const suggestions = [
    "Review the latest workspace activity",
    "Create a plan for this repo",
    "Summarize the current agent state",
  ];

  return (
    <div
      style={`display:flex; flex:1; flex-direction:column; justify-content:center; padding:${tokens.space.xxxl}; gap:${tokens.space.xxl};`}
    >
      <div
        style={`display:flex; flex-direction:column; align-items:center; gap:${tokens.space.md}; text-align:center; max-width:420px;`}
      >
        <div
          style={`display:flex; align-items:center; justify-content:center; width:72px; height:72px; border-radius:${tokens.radii.xl}; background:${tokens.colors.surfaceSecondary}; border:1px solid ${tokens.colors.border}; box-shadow:${tokens.shadows.glow}; color:${tokens.colors.text};`}
        >
          <OpenAIIcon size={30} />
        </div>
        <div
          style={`font-size:${tokens.fontSizes.xxl}; line-height:1.04; font-weight:${tokens.fontWeights.bold}; letter-spacing:-0.04em; color:${tokens.colors.text};`}
        >
          {"Let's build"}
        </div>
        <div
          style={`font-size:${tokens.fontSizes.xl}; line-height:1.1; color:${tokens.colors.textMuted}; font-weight:${tokens.fontWeights.semibold};`}
        >
          agent-worker
        </div>
        <div
          style={`font-size:${tokens.fontSizes.sm}; line-height:1.6; color:${tokens.colors.textDim}; max-width:320px;`}
        >
          Pick a channel or agent from the sidebar to start a new thread.
        </div>
      </div>

      <div
        style={`display:flex; flex-direction:column; gap:${tokens.space.md}; width:min(100%, 820px); margin:0 auto;`}
      >
        <div
          style={`display:flex; align-items:center; justify-content:center; gap:${tokens.space.md}; flex-wrap:wrap;`}
        >
          {suggestions.map((label) => (
            <div
              style={`padding:${tokens.space.lg}; min-width:200px; border-radius:${tokens.radii.xl}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; color:${tokens.colors.textMuted}; box-shadow:${tokens.shadows.inset};`}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={`padding:${tokens.space.sm}; border-radius:${tokens.radii.xxl}; background:${tokens.colors.panel}; border:1px solid ${tokens.colors.border}; box-shadow:${tokens.shadows.glow}, ${tokens.shadows.inset};`}
        >
          <div
            style={`min-height:96px; border-radius:${tokens.radii.xl}; background:${tokens.colors.input}; border:1px solid ${tokens.colors.border}; padding:${tokens.space.lg}; color:${tokens.colors.textDim}; display:flex; align-items:flex-start;`}
          >
            Ask anything, add files, or open a channel to start
          </div>
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
    </AppShell>
  );
}
