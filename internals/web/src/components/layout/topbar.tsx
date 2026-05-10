/** @jsxImportSource semajsx/dom */

import type { JSXNode } from "semajsx";
import { computed } from "semajsx/signal";
import { Icon, Bell, Sun, Moon, PanelLeft } from "semajsx/icons";
import { connectionState } from "../../stores/connection.ts";
import { selectedItem, currentHarness } from "../../stores/navigation.ts";
import { wsInfo } from "../../stores/harness-data.ts";
import { agents } from "../../stores/agents.ts";
import { parsePlatformName } from "../brand-icons.tsx";
import { resolvedTheme, toggleTheme } from "../../theme/tokens.ts";
import * as s from "./topbar.style.ts";

type Crumb = {
  label: string;
  mono?: boolean;
  current?: boolean;
  status?: "running" | "idle" | "error";
};

const daemonClass = computed(connectionState, (state) => [
  s.daemonDot,
  state === "connected" ? s.daemonDotOk : state === "error" ? s.daemonDotErr : s.daemonDotIdle,
]);

const daemonLabel = computed(connectionState, (state) => {
  switch (state) {
    case "connected":
      return "daemon";
    case "connecting":
      return "connecting";
    case "disconnected":
      return "offline";
    case "error":
      return "error";
  }
});

const crumbs = computed(
  [selectedItem, currentHarness, wsInfo, agents],
  (item, wsKey, info, agentList): Crumb[] => {
    const wsLabel = info?.name ?? wsKey;
    if (!item) {
      return [{ label: "Dashboard", current: true }];
    }
    switch (item.kind) {
      case "agent": {
        const a = agentList.find((x) => x.name === item.name);
        const status: "running" | "idle" | "error" =
          a?.state === "running"
            ? "running"
            : a?.state === "error" || a?.state === "failed"
              ? "error"
              : "idle";
        return [
          { label: "Agents" },
          { label: item.name, mono: true, current: true, status },
        ];
      }
      case "agent-info":
        return [
          { label: "Agents" },
          { label: item.name, mono: true, current: true },
          { label: "info", current: true },
        ];
      case "channel": {
        const parsed = parsePlatformName(item.channel);
        return [
          { label: wsLabel },
          { label: `#${parsed.name}`, mono: true, current: true },
        ];
      }
      case "doc":
        return [{ label: wsLabel }, { label: "docs" }, { label: item.docName, current: true }];
      case "harness-settings":
        return [{ label: wsLabel, current: true }];
      case "global-events":
        return [{ label: "Events", current: true }];
      case "global-settings":
        return [{ label: "Settings", current: true }];
    }
  },
);

function dotClass(status: "running" | "idle" | "error" | undefined) {
  if (!status) return null;
  return [
    s.crumbDot,
    status === "running" ? s.crumbDotRunning : status === "error" ? s.crumbDotError : s.crumbDotIdle,
  ];
}

function renderCrumbs(list: Crumb[]) {
  const out: JSXNode[] = [];
  list.forEach((c, i) => {
    out.push(
      <span class={c.current ? [s.crumb, s.crumbCurrent] : s.crumb}>
        {c.status ? <span class={dotClass(c.status)} /> : null}
        <span class={c.mono ? [s.crumbLabel, s.crumbMono] : s.crumbLabel}>{c.label}</span>
      </span>,
    );
    if (i < list.length - 1) {
      out.push(<span class={s.sep}>/</span>);
    }
  });
  return out;
}

export function Topbar(props: { onToggleSidebar?: () => void }) {
  const themeIcon = computed(resolvedTheme, (m) =>
    m === "dark" ? <Icon icon={Sun} size={13} /> : <Icon icon={Moon} size={13} />,
  );

  return (
    <header class={s.topbar}>
      <button class={s.iconBtn} onclick={() => props.onToggleSidebar?.()} title="Toggle sidebar">
        <Icon icon={PanelLeft} size={13} />
      </button>

      <button
        class={s.brand}
        onclick={() => {
          selectedItem.value = null;
        }}
        title="Home"
        style="border:none;background:transparent;cursor:pointer;font:inherit;color:inherit"
      >
        <div class={s.logo}>L</div>
        <span class={s.brandName}>agent-worker</span>
        <span class={s.pill}>v0.8</span>
      </button>

      <span class={s.sep}>/</span>

      {computed(crumbs, (list) => renderCrumbs(list))}

      <div class={s.right}>
        <button class={s.daemon} title={daemonLabel}>
          <span class={daemonClass} />
          <span class={s.daemonLabel}>{daemonLabel}</span>
        </button>
        <button class={s.iconBtn} title="Notifications">
          <Icon icon={Bell} size={13} />
          <span class={s.iconBtnDot} />
        </button>
        <button class={s.iconBtn} title="Toggle theme" onclick={() => toggleTheme()}>
          {themeIcon}
        </button>
      </div>
    </header>
  );
}
