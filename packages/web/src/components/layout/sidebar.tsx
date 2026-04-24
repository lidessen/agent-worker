/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { computed } from "semajsx/signal";
import { Icon, Search, Plus, ChevronRight, Zap, Settings, Bot, Folder } from "semajsx/icons";
import { agents } from "../../stores/agents.ts";
import { workspaces } from "../../stores/workspaces.ts";
import { wsChannels } from "../../stores/workspace-data.ts";
import {
  currentWorkspace,
  selectedItem,
  selectChannel,
  selectAgent,
  selectWorkspaceSettings,
  selectGlobalSettings,
  selectGlobalEvents,
} from "../../stores/navigation.ts";
import { parsePlatformName } from "../brand-icons.tsx";
import { showCreateAgent } from "../create-agent-dialog.tsx";
import { showCreateWorkspace } from "../create-workspace-dialog.tsx";
import { sidebarCollapsed } from "./app-shell.tsx";
import * as s from "./sidebar.style.ts";
import type { AgentInfo, WorkspaceInfo } from "../../api/types.ts";

function agentDotClass(state: string) {
  if (state === "running") return [s.dot, s.dotRunning];
  if (state === "error" || state === "failed") return [s.dot, s.dotError];
  return [s.dot, s.dotIdle];
}

function workspaceDotClass(status: string) {
  if (status === "running") return [s.dot, s.dotRunning];
  if (status === "error") return [s.dot, s.dotError];
  return [s.dot, s.dotIdle];
}

function AgentItem(props: { agent: AgentInfo }) {
  const { agent } = props;
  const active = computed(
    selectedItem,
    (sel) => sel?.kind === "agent" && sel.name === agent.name,
  );
  const cls = computed(active, (a) => (a ? [s.item, s.itemActive] : s.item));
  return (
    <button class={cls} onclick={() => selectAgent(agent.name)}>
      <span class={agentDotClass(agent.state)} />
      <span class={s.collapsedGlyph}>
        <Icon icon={Bot} size={12} />
      </span>
      <span
        class={computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.itemLabel))}
      >
        {agent.name}
      </span>
    </button>
  );
}

function WorkspaceItem(props: { ws: WorkspaceInfo }) {
  const { ws } = props;
  const isCurrent = computed(currentWorkspace, (key) => key === ws.name);
  const active = computed(
    [selectedItem, isCurrent],
    (sel, cur) => cur && sel?.kind === "workspace-settings" && sel.wsKey === ws.name,
  );
  const cls = computed(active, (a) => (a ? [s.item, s.itemActive] : s.item));
  const agentCount = computed(agents, (list) => list.filter((a) => a.workspace === ws.name).length);
  return (
    <button
      class={cls}
      onclick={() => {
        currentWorkspace.value = ws.name;
        selectWorkspaceSettings(ws.name);
      }}
    >
      <span class={workspaceDotClass(ws.status)} />
      <span class={s.collapsedGlyph}>
        <Icon icon={Folder} size={12} />
      </span>
      <span
        class={computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.itemLabel))}
      >
        {ws.label || ws.name}
      </span>
      <span
        class={computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.itemCount))}
      >
        {agentCount}
      </span>
    </button>
  );
}

function ChannelSub(props: { wsKey: string; channel: string }) {
  const parsed = parsePlatformName(props.channel);
  const active = computed(
    selectedItem,
    (sel) =>
      sel?.kind === "channel" && sel.channel === props.channel && sel.wsKey === props.wsKey,
  );
  const cls = computed(active, (a) => (a ? [s.sub, s.subActive] : s.sub));
  return (
    <button
      class={cls}
      onclick={() => {
        currentWorkspace.value = props.wsKey;
        selectChannel(props.wsKey, props.channel);
      }}
    >
      <span class={s.subHash}>#</span>
      <span class={s.subName}>{parsed.name}</span>
    </button>
  );
}

function WorkspacesSection() {
  return computed([workspaces, currentWorkspace, wsChannels], (list, curKey, channels) => {
    const items: JSXNode[] = [];
    list.forEach((ws) => {
      items.push(<WorkspaceItem ws={ws} />);
      if (ws.name === curKey) {
        channels.forEach((ch) => {
          items.push(<ChannelSub wsKey={ws.name} channel={ch} />);
        });
      }
    });
    return items;
  });
}

function SystemSection() {
  const eventsActive = computed(selectedItem, (sel) => sel?.kind === "global-events");
  const settingsActive = computed(selectedItem, (sel) => sel?.kind === "global-settings");
  const eventsCls = computed(eventsActive, (a) => (a ? [s.item, s.itemActive] : s.item));
  const settingsCls = computed(settingsActive, (a) => (a ? [s.item, s.itemActive] : s.item));
  const hideLabel = computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.itemLabel));
  return [
    <button class={eventsCls} onclick={() => selectGlobalEvents()}>
      <Icon icon={Zap} size={13} />
      <span class={hideLabel}>Events</span>
    </button>,
    <button class={settingsCls} onclick={() => selectGlobalSettings()}>
      <Icon icon={Settings} size={13} />
      <span class={hideLabel}>Settings</span>
    </button>,
  ];
}

export function Sidebar() {
  const asideClass = computed(sidebarCollapsed, (c) =>
    c ? [s.sidebar, s.sidebarCollapsed] : s.sidebar,
  );
  const hideWhenCollapsed = computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : null));
  const sectionLabelClass = computed(sidebarCollapsed, (c) =>
    c ? s.hiddenCollapsed : s.sectionLabel,
  );
  const sectionActionClass = computed(sidebarCollapsed, (c) =>
    c ? s.hiddenCollapsed : s.sectionAction,
  );

  const agentsList = computed(agents, (list) =>
    list.slice(0, 5).map((a) => <AgentItem agent={a} />),
  );

  return (
    <aside class={asideClass}>
      <div class={computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.find))}>
        <Icon icon={Search} size={12} />
        <input class={s.findInput} placeholder="Find or jump…" readOnly />
        <span class={s.kbd}>⌘K</span>
      </div>

      <div class={s.section}>
        <span class={sectionLabelClass}>Agents</span>
        <button
          class={sectionActionClass}
          title="New agent"
          onclick={() => (showCreateAgent.value = true)}
        >
          <Icon icon={Plus} size={11} />
        </button>
      </div>
      {agentsList}

      <div class={s.section} style="margin-top:8px">
        <span class={sectionLabelClass}>Workspaces</span>
        <button
          class={sectionActionClass}
          title="New workspace"
          onclick={() => (showCreateWorkspace.value = true)}
        >
          <Icon icon={Plus} size={11} />
        </button>
      </div>
      {WorkspacesSection()}

      <div class={s.section} style="margin-top:8px">
        <span class={hideWhenCollapsed}>System</span>
      </div>
      {SystemSection()}

      <div class={s.bottom}>
        <button class={s.account}>
          <span class={s.avatar} />
          <span class={hideWhenCollapsed}>lidessen</span>
          <span class={computed(sidebarCollapsed, (c) => (c ? s.hiddenCollapsed : s.itemChev))}>
            <Icon icon={ChevronRight} size={11} />
          </span>
        </button>
      </div>
    </aside>
  );
}
