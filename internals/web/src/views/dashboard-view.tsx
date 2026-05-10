/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { Icon, Plus, ArrowRight, MoreHorizontal } from "semajsx/icons";
import { agents, fetchAgents } from "../stores/agents.ts";
import { harnesss, fetchHarnesss } from "../stores/harnesss.ts";
import { daemonEvents, loadDaemonEvents } from "../stores/daemon-events.ts";
import { selectAgent, selectHarnessSettings, selectGlobalEvents } from "../stores/navigation.ts";
import { showCreateAgent } from "../components/create-agent-dialog.tsx";
import { showCreateHarness } from "../components/create-harness-dialog.tsx";
import * as s from "./dashboard-view.style.ts";

function fmtTs(ts: number | string | Date): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts as number);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}
import type { AgentInfo, HarnessInfo, DaemonEvent } from "../api/types.ts";

function agentDot(state: string) {
  if (state === "running" || state === "processing") return [s.resDot, s.dotRunning];
  if (state === "error" || state === "failed") return [s.resDot, s.dotError];
  return [s.resDot, s.dotIdle];
}

function wsDot(status: string) {
  if (status === "running") return [s.resDot, s.dotRunning];
  if (status === "error") return [s.resDot, s.dotError];
  return [s.resDot, s.dotIdle];
}

function agentPill(state: string) {
  if (state === "running" || state === "processing") return [s.pill, s.pillRunning];
  if (state === "error" || state === "failed") return [s.pill, s.pillError];
  return [s.pill, s.pillIdle];
}

function wsPill(status: string) {
  if (status === "running") return [s.pill, s.pillRunning];
  if (status === "error") return [s.pill, s.pillError];
  return [s.pill, s.pillIdle];
}

function eventTypeClass(type: string) {
  const t = type.toLowerCase();
  if (t.includes("tool")) return [s.eventType, s.eventTypeTool];
  if (t.includes("run")) return [s.eventType, s.eventTypeRun];
  if (t.includes("err") || t === "error") return [s.eventType, s.eventTypeErr];
  if (t.includes("warn")) return [s.eventType, s.eventTypeWarn];
  if (t.includes("msg") || t.includes("text") || t.includes("message"))
    return [s.eventType, s.eventTypeMsg];
  return s.eventType;
}

function eventTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("tool")) return "tool";
  if (t.includes("run")) return "run";
  if (t.includes("err") || t === "error") return "err";
  if (t.includes("warn")) return "warn";
  if (t.includes("msg") || t.includes("text") || t.includes("message")) return "msg";
  const idx = type.lastIndexOf(".");
  return (idx >= 0 ? type.slice(idx + 1) : type).slice(0, 8);
}

function eventActor(e: DaemonEvent): string {
  const actor = (e.actor as string) ?? (e.from as string) ?? (e.agent as string) ?? "";
  return actor;
}

function eventBodyText(e: DaemonEvent): string {
  const body =
    (e.body as string) ??
    (e.text as string) ??
    (e.content as string) ??
    (e.message as string) ??
    "";
  return body;
}

function AgentRow(props: { agent: AgentInfo }) {
  const a = props.agent;
  return (
    <button class={s.resRow} onclick={() => selectAgent(a.name)}>
      <span class={agentDot(a.state)} />
      <div class={s.resName}>
        <span class={[s.resNameT, "mono"]}>{a.name}</span>
        <span class={s.resNameS}>
          {a.runtime}
          {a.harness ? ` · ws/${a.harness}` : ""}
        </span>
      </div>
      <div class={s.chans}>
        <span class={s.chan}>{a.kind}</span>
        {a.model ? <span class={s.chan}>{a.model}</span> : null}
      </div>
      <div class={s.resMeta}>
        <span class={agentPill(a.state)}>{a.state}</span>
      </div>
      <span class={s.moreH}>
        <Icon icon={MoreHorizontal} size={13} />
      </span>
    </button>
  );
}

function HarnessRow(props: { ws: HarnessInfo }) {
  const w = props.ws;
  return (
    <button class={s.resRow} onclick={() => selectHarnessSettings(w.name)}>
      <span class={wsDot(w.status)} />
      <div class={s.resName}>
        <span class={s.resNameT}>{w.label || w.name}</span>
        <span class={s.resNameS}>
          {w.mode ?? "harness"} · {w.agents.join(", ") || "no agents"}
        </span>
      </div>
      <div class={s.chans}>
        {w.agents.slice(0, 3).map((n) => (
          <span class={s.chan}>@{n}</span>
        ))}
        {w.agents.length > 3 ? <span class={s.chan}>+{w.agents.length - 3}</span> : null}
      </div>
      <div class={s.resMeta}>
        <span class={wsPill(w.status)}>{w.status}</span>
      </div>
      <span class={s.moreH}>
        <Icon icon={MoreHorizontal} size={13} />
      </span>
    </button>
  );
}

function EventRow(props: { event: DaemonEvent }) {
  const e = props.event;
  return (
    <div class={s.eventRow}>
      <span class={s.eventTs}>{fmtTs(e.ts)}</span>
      <span class={eventTypeClass(e.type)}>{eventTypeLabel(e.type)}</span>
      <span class={s.eventActor}>{eventActor(e)}</span>
      <span class={s.eventBody}>{eventBodyText(e)}</span>
    </div>
  );
}

export function DashboardView() {
  // Load data on mount
  fetchAgents();
  fetchHarnesss();
  loadDaemonEvents();

  const runningCount = computed(agents, (list) =>
    list.filter((a) => a.state === "running" || a.state === "processing").length,
  );
  const idleCount = computed(agents, (list) => list.filter((a) => a.state === "idle").length);
  const errorCount = computed(
    agents,
    (list) => list.filter((a) => a.state === "error" || a.state === "failed").length,
  );
  const totalAgents = computed(agents, (list) => list.length);
  const wsRunning = computed(harnesss, (list) => list.filter((w) => w.status === "running").length);
  const wsTotal = computed(harnesss, (list) => list.length);

  const dateLine = computed([totalAgents, wsTotal], (a, w) => {
    const d = new Date();
    const weekday = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return `${weekday} · ${a} agent${a === 1 ? "" : "s"} · ${w} harness${w === 1 ? "" : "s"}`;
  });

  const agentRows = computed(agents, (list) =>
    list.length === 0 ? (
      <div class={s.resRow}>
        <span />
        <div class={s.resName}>
          <span class={s.resNameT} style="color:var(--colors-textDim)">
            No agents yet
          </span>
          <span class={s.resNameS}>Click “+ New” to create one.</span>
        </div>
      </div>
    ) : (
      list.map((a) => <AgentRow agent={a} />)
    ),
  );

  const wsRows = computed(harnesss, (list) =>
    list.length === 0 ? (
      <div class={s.resRow}>
        <span />
        <div class={s.resName}>
          <span class={s.resNameT} style="color:var(--colors-textDim)">
            No harnesss
          </span>
          <span class={s.resNameS}>Click “+ New” to create one.</span>
        </div>
      </div>
    ) : (
      list.map((w) => <HarnessRow ws={w} />)
    ),
  );

  const eventRows = computed(daemonEvents, (list) =>
    list.slice(-6).reverse().map((e) => <EventRow event={e} />),
  );

  return (
    <div class={s.view}>
      <div class={s.wrap}>
        <div class={s.header}>
          <h1 class={s.title}>Overview</h1>
          <p class={s.subtitle}>{dateLine}</p>
        </div>

        <div class={s.statGrid}>
          <div class={s.stat}>
            <div class={s.statLabel}>Agents running</div>
            <div class={s.statValue}>
              {runningCount}
              <span style="color:var(--colors-textDim);font-size:18px"> / {totalAgents}</span>
            </div>
            <div class={s.statMeta}>
              <span>
                {idleCount} idle · {errorCount} error
              </span>
            </div>
          </div>
          <div class={s.stat}>
            <div class={s.statLabel}>Harnesss active</div>
            <div class={s.statValue}>{wsRunning}</div>
            <div class={s.statMeta}>
              <span>of {wsTotal} total</span>
            </div>
          </div>
          <div class={s.stat}>
            <div class={s.statLabel}>Events</div>
            <div class={s.statValue}>{computed(daemonEvents, (list) => list.length)}</div>
            <div class={s.statMeta}>
              <span>across all agents</span>
            </div>
          </div>
        </div>

        <div class={s.section}>
          <span class={s.sectionLabel}>Agents</span>
          <span class={s.sectionCount}>{totalAgents}</span>
          <span class={s.sectionRight}>
            <button class={s.btnSmGhost} onclick={() => (showCreateAgent.value = true)}>
              <Icon icon={Plus} size={12} /> New
            </button>
          </span>
        </div>
        <div class={s.resList}>{agentRows}</div>

        <div class={s.section}>
          <span class={s.sectionLabel}>Harnesss</span>
          <span class={s.sectionCount}>{wsTotal}</span>
          <span class={s.sectionRight}>
            <button class={s.btnSmGhost} onclick={() => (showCreateHarness.value = true)}>
              <Icon icon={Plus} size={12} /> New
            </button>
          </span>
        </div>
        <div class={s.resList}>{wsRows}</div>

        <div class={s.section} style="margin-top:28px">
          <span class={s.sectionLabel}>Recent events</span>
          <span class={s.sectionRight}>
            <button class={s.btnSmGhost} onclick={() => selectGlobalEvents()}>
              View all <Icon icon={ArrowRight} size={11} />
            </button>
          </span>
        </div>
        <div class={s.eventCard}>
          <div class={s.eventList}>{eventRows}</div>
        </div>

      </div>
    </div>
  );
}
