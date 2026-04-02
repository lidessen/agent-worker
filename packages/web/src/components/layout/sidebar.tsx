/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx/core";
import { computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { Icon, Drama } from "semajsx/icons";
import { ClaudeIcon, CursorIcon, OpenAIIcon, VercelIcon } from "../brand-icons.tsx";
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
  selectGlobalEvents,
} from "../../stores/navigation.ts";
import { showCreateDoc } from "../create-doc-dialog.tsx";
import type { SidebarTab } from "../../stores/navigation.ts";
import type { AgentInfo } from "../../api/types.ts";
import * as styles from "./sidebar.style.ts";

// ── Runtime icon (same as agent-card) ────────────────────────────────────

function runtimeIcon(runtime: string): JSXNode {
  switch (runtime) {
    case "claude-code":
      return <ClaudeIcon size={12} />;
    case "codex":
      return <OpenAIIcon size={12} />;
    case "cursor":
      return <CursorIcon size={12} />;
    case "ai-sdk":
      return <VercelIcon size={12} />;
    case "mock":
      return <Icon icon={Drama} size={12} />;
    default:
      return null;
  }
}

// ── Connection dot ───────────────────────────────────────────────────────

const connDotClass = computed(connectionState, (state) => [
  styles.connectionDot,
  state === "connected"
    ? styles.connectionDotConnected
    : state === "connecting"
      ? styles.connectionDotConnecting
      : styles.connectionDotError,
]);

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

function ChannelItem(props: { channel: string; onSelect?: () => void }) {
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "channel" && sel.channel === props.channel,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  return (
    <div
      class={cls}
      onclick={() => {
        selectChannel(currentWorkspace.value, props.channel);
        props.onSelect?.();
      }}
    >
      <div class={styles.itemPreview}>
        <span># {props.channel}</span>
        <span class={styles.itemMeta}>
          Channel thread
        </span>
      </div>
    </div>
  );
}

function AgentItem(props: { agent: AgentInfo; onSelect?: () => void }) {
  const { agent } = props;
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "agent" && sel.name === agent.name,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  const itemDotClass = [
    styles.itemDot,
    agent.state === "running"
      ? styles.itemDotRunning
      : agent.state === "processing"
        ? styles.itemDotProcessing
        : agent.state === "error" || agent.state === "failed"
          ? styles.itemDotError
          : agent.state === "completed"
            ? styles.itemDotCompleted
            : styles.itemDotIdle,
  ];
  return (
    <div
      class={cls}
      onclick={() => {
        selectAgent(agent.name);
        props.onSelect?.();
      }}
    >
      <span class={styles.itemIcon}>{runtimeIcon(agent.runtime)}</span>
      <div class={styles.itemPreview}>
        <span>{agent.name}</span>
        <span class={styles.itemMeta}>
          {agent.runtime}
        </span>
      </div>
      <span class={itemDotClass} />
    </div>
  );
}

function DocItem(props: { name: string; onSelect?: () => void }) {
  const isActive = computed(selectedItem, (sel) =>
    sel?.kind === "doc" && sel.docName === props.name,
  );
  const cls = computed(isActive, (a) =>
    a ? [styles.listItem, styles.listItemActive] : styles.listItem,
  );
  return (
    <div
      class={cls}
      onclick={() => {
        selectDoc(currentWorkspace.value, props.name);
        props.onSelect?.();
      }}
    >
      <div class={styles.itemPreview}>
        <span>{props.name}</span>
        <span class={styles.itemMeta}>
          Workspace document
        </span>
      </div>
    </div>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────

function TabContent(props: { onSelect?: () => void }) {
  // Use separate computeds per tab, each watching only its data signal
  const channelContent = computed(wsChannels, (channels) =>
    <div class={styles.listWrap}>
      <div class={styles.sectionLabel}>Threads</div>
      {channels.map((ch) => <ChannelItem channel={ch} onSelect={props.onSelect} />)}
    </div>,
  );
  const agentContent = computed(wsAgents, (agentArr) =>
    <div class={styles.listWrap}>
      <div class={styles.sectionLabel}>Agents</div>
      {agentArr.map((a) => <AgentItem agent={a} onSelect={props.onSelect} />)}
    </div>,
  );
  const docContent = computed(wsDocs, (docs) =>
    <div class={styles.listWrap}>
      <div class={[styles.sectionLabel, styles.sectionLabelRow]}>
        <span>Docs</span>
        <span
          class={styles.sectionAction}
          onclick={() => (showCreateDoc.value = true)}
        >+</span>
      </div>
      {docs.map((d) => <DocItem name={d.name} onSelect={props.onSelect} />)}
    </div>,
  );

  const channelPaneClass = computed(sidebarTab, (t) =>
    t === "channels" ? styles.tabPane : [styles.tabPane, styles.tabPaneHidden]);
  const agentPaneClass = computed(sidebarTab, (t) =>
    t === "agents" ? styles.tabPane : [styles.tabPane, styles.tabPaneHidden]);
  const docPaneClass = computed(sidebarTab, (t) =>
    t === "docs" ? styles.tabPane : [styles.tabPane, styles.tabPaneHidden]);

  return (
    <div class={styles.displayContents}>
      <div class={channelPaneClass}>{channelContent}</div>
      <div class={agentPaneClass}>{agentContent}</div>
      <div class={docPaneClass}>{docContent}</div>
    </div>
  );
}

// ── Workspace switcher ───────────────────────────────────────────────────

function WorkspaceSwitcher() {
  // Auto-select first workspace when list loads (if current is still "global" virtual key)
  const unsub = workspaces.subscribe((wsList) => {
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
  onCleanup(unsub);

  const options = computed(workspaces, (wsList) =>
    wsList.map((ws) => (
      <option value={ws.name}>{ws.label || ws.name}</option>
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
        <div class={styles.headerRow}>
          <div>
            <div class={styles.eyebrow}>Agent Worker</div>
            <div class={styles.headerMeta}>Workspace navigation</div>
          </div>
        </div>
        <WorkspaceSwitcher />
      </div>

      <div class={styles.tabBar}>
        {tabs.map((t) => (
          <TabButton tab={t.key} label={t.label} />
        ))}
      </div>

      <div class={styles.listArea}><TabContent /></div>

      <div class={styles.bottomBar}>
        <div class={styles.bottomActions}>
          <button
            class={styles.bottomLink}
            onclick={() => selectWorkspaceSettings(currentWorkspace.value)}
          >
            Workspace
          </button>
          <button
            class={styles.bottomLink}
            onclick={() => selectGlobalEvents()}
          >
            Event Log
          </button>
          <button
            class={styles.bottomLink}
            onclick={() => selectGlobalSettings()}
          >
            Settings
          </button>
        </div>
        <div class={styles.statusRow}>
          <span class={connDotClass} />
          <span class={styles.statusLabel}>{connLabel}</span>
        </div>
      </div>
    </aside>
  );
}
