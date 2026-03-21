/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx/core";
import { computed } from "semajsx/signal";
import { Icon, Drama } from "@semajsx/icons";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon } from "../brand-icons.tsx";
import { tokens } from "../../theme/tokens.ts";
import { connectionState } from "../../stores/connection.ts";
import { workspaces } from "../../stores/workspaces.ts";
import { wsChannels, wsAgents, wsDocs } from "../../stores/workspace-data.ts";
import {
  currentWorkspace,
  sidebarTab,
  selectedItem,
  selectChannel,
  selectAgent,
  selectDoc,
  selectWorkspaceSettings,
  selectGlobalSettings,
} from "../../stores/navigation.ts";
import type { SidebarTab } from "../../stores/navigation.ts";
import type { AgentInfo } from "../../api/types.ts";
import * as styles from "./sidebar.style.ts";

// ── State colors (same as agent-card) ────────────────────────────────────

const stateColors: Record<string, string> = {
  idle: tokens.colors.agentIdle,
  running: tokens.colors.agentRunning,
  processing: tokens.colors.agentProcessing,
  error: tokens.colors.agentError,
  failed: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
  stopped: tokens.colors.agentIdle,
};

function stateColor(state: string): string {
  return stateColors[state] ?? tokens.colors.agentIdle;
}

// ── Runtime icon (same as agent-card) ────────────────────────────────────

const iconStyle = "vertical-align: -2px; margin-right: 4px;";

function runtimeIcon(runtime: string): JSXNode {
  switch (runtime) {
    case "claude-code":
      return <ClaudeIcon size={12} style={iconStyle} />;
    case "codex":
      return <OpenAIIcon size={12} style={iconStyle} />;
    case "cursor":
      return <CursorIcon size={12} style={iconStyle} />;
    case "ai-sdk":
      return <VercelIcon size={12} style={iconStyle} />;
    case "mock":
      return <Icon icon={Drama} size={12} style={iconStyle} />;
    default:
      return null;
  }
}

// ── Connection dot ───────────────────────────────────────────────────────

const connDotColor = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return tokens.colors.success;
    case "connecting":
      return tokens.colors.warning;
    case "disconnected":
    case "error":
      return tokens.colors.danger;
  }
});

const connDotStyle = computed(connDotColor, (c) => `background: ${c}`);

const connLabel = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Connection error";
  }
});

// ── Tab helpers ──────────────────────────────────────────────────────────

const tabs: { key: SidebarTab; label: string }[] = [
  { key: "channels", label: "Channels" },
  { key: "agents", label: "Agents" },
  { key: "docs", label: "Docs" },
];

function TabButton(props: { tab: SidebarTab; label: string }) {
  const cls = computed(sidebarTab, (cur) =>
    cur === props.tab ? [styles.tab, styles.tabActive] : styles.tab,
  );
  return (
    <button class={cls} onclick={() => (sidebarTab.value = props.tab)}>
      {props.label}
    </button>
  );
}

// ── List items ───────────────────────────────────────────────────────────

function ChannelItem(props: { channel: string }) {
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "channel" && sel.channel === props.channel,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  return (
    <div
      class={cls}
      onclick={() => selectChannel(currentWorkspace.value, props.channel)}
    >
      <div class={styles.itemPreview}>
        <span># {props.channel}</span>
        <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
          Channel thread
        </span>
      </div>
    </div>
  );
}

function AgentItem(props: { agent: AgentInfo }) {
  const { agent } = props;
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "agent" && sel.name === agent.name,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  return (
    <div class={cls} onclick={() => selectAgent(agent.name)}>
      {runtimeIcon(agent.runtime)}
      <div class={styles.itemPreview}>
        <span>{agent.name}</span>
        <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
          {agent.runtime}
        </span>
      </div>
      <span
        class={styles.itemDot}
        style={`background: ${stateColor(agent.state)}`}
      />
    </div>
  );
}

function DocItem(props: { name: string }) {
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "doc" && sel.docName === props.name,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  return (
    <div
      class={cls}
      onclick={() => selectDoc(currentWorkspace.value, props.name)}
    >
      <div class={styles.itemPreview}>
        <span>{props.name}</span>
        <span style={`font-size:${tokens.fontSizes.xs}; color:${tokens.colors.textDim};`}>
          Workspace document
        </span>
      </div>
    </div>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────

function TabContent() {
  // Use separate computeds per tab, each watching only its data signal
  const channelContent = computed(wsChannels, (channels) =>
    <div class={styles.listWrap}>
      <div class={styles.sectionLabel}>Threads</div>
      {channels.map((ch) => <ChannelItem channel={ch} />)}
    </div>,
  );
  const agentContent = computed(wsAgents, (agentArr) =>
    <div class={styles.listWrap}>
      <div class={styles.sectionLabel}>Agents</div>
      {agentArr.map((a) => <AgentItem agent={a} />)}
    </div>,
  );
  const docContent = computed(wsDocs, (docs) =>
    <div class={styles.listWrap}>
      <div class={styles.sectionLabel}>Docs</div>
      {docs.map((d) => <DocItem name={d.name} />)}
    </div>,
  );

  // Show/hide based on active tab — use DOM display toggle instead of signal switching
  const channelDisplay = computed(sidebarTab, (t) => t === "channels" ? "block" : "none");
  const agentDisplay = computed(sidebarTab, (t) => t === "agents" ? "block" : "none");
  const docDisplay = computed(sidebarTab, (t) => t === "docs" ? "block" : "none");

  return (
    <div style="display: contents">
      <div style={computed(channelDisplay, (d) => `display:${d}`)}>{channelContent}</div>
      <div style={computed(agentDisplay, (d) => `display:${d}`)}>{agentContent}</div>
      <div style={computed(docDisplay, (d) => `display:${d}`)}>{docContent}</div>
    </div>
  );
}

// ── Workspace switcher ───────────────────────────────────────────────────

function WorkspaceSwitcher() {
  // Auto-select first workspace when list loads (if current is still "global" virtual key)
  workspaces.subscribe((wsList) => {
    if (wsList.length > 0 && currentWorkspace.value === "global") {
      // Check if "global" actually exists as a real workspace
      const hasGlobal = wsList.some((ws) => ws.name === "global");
      if (hasGlobal) {
        currentWorkspace.value = "global";
      } else {
        currentWorkspace.value = wsList[0].name;
      }
    }
  });

  const options = computed(workspaces, (wsList) =>
    wsList.map((ws) => (
      <option value={ws.name}>{ws.name}</option>
    )),
  );

  const selectedValue = computed(currentWorkspace, (ws) => ws);

  return (
    <select
      class={styles.workspaceSelect}
      onchange={(e: Event) => {
        currentWorkspace.value = (e.target as HTMLSelectElement).value;
      }}
    >
      {options}
    </select>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside class={styles.sidebar}>
      <div class={styles.header}>
        <div>
          <div class={styles.eyebrow}>Agent Worker</div>
          <div class={styles.headerMeta}>Workspace navigation</div>
        </div>
        <WorkspaceSwitcher />
      </div>

      <div class={styles.tabBar}>
        {tabs.map((t) => (
          <TabButton tab={t.key} label={t.label} />
        ))}
      </div>

      <div class={styles.listArea}>
        <TabContent />
      </div>

      <div class={styles.bottomBar}>
        <div class={styles.bottomActions}>
          <button
            class={styles.bottomLink}
            onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
          >
            Workspace
          </button>
          <button class={styles.bottomLink} onclick={() => selectGlobalSettings()}>
            Settings
          </button>
        </div>
        <div class={styles.statusRow}>
          <span class={styles.connectionDot} style={connDotStyle} />
          <span class={styles.statusLabel}>{connLabel}</span>
        </div>
      </div>
    </aside>
  );
}
