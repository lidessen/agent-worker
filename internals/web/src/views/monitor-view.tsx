/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import {
  monitorSnapshot,
  monitorRecentSamples,
  loadMonitorSnapshot,
  startMonitorStream,
} from "../stores/monitor.ts";
import * as s from "./monitor-view.style.ts";

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function formatUptime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return `${d}d ${h}h`;
}

function thresholdClass(value: number, min: number) {
  if (value >= min) return [s.thresholdLine, s.thresholdOk];
  if (value > 0) return [s.thresholdLine, s.thresholdWarn];
  return [s.thresholdLine, s.thresholdNeutral];
}

/** For "max" thresholds, ok when value ≤ max. */
function thresholdMaxClass(value: number, max: number) {
  if (value <= max) return [s.thresholdLine, s.thresholdOk];
  return [s.thresholdLine, s.thresholdWarn];
}

function fmtIntervention(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function MonitorView() {
  // Bootstrap: load snapshot, start SSE.
  void loadMonitorSnapshot();
  void startMonitorStream();

  const headerLine = computed(monitorSnapshot, (snap) => {
    if (!snap) return "Loading…";
    return `daemon up ${formatUptime(snap.uptimeSec)}`;
  });

  const c1Section = computed(monitorSnapshot, (snap) => {
    if (!snap) {
      return (
        <div class={s.cardBody}>
          <div class={s.metricRow}>
            <span class={s.metricLabel}>Connecting…</span>
          </div>
        </div>
      );
    }
    const c1 = snap.c1;
    const cur = c1.current;
    const ts = c1.timeShare24h;
    return (
      <div class={s.cardBody}>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Active agents</span>
          <span class={s.metricValue}>{cur.activeAgents}</span>
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Active requirements</span>
          <span class={s.metricValue}>{cur.activeRequirements}</span>
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Pending on auth</span>
          <span class={s.metricValue}>{cur.pendingOnAuth}</span>
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>30-day peak (requirements)</span>
          <span class={s.metricValue}>{c1.peak30d}</span>
        </div>
        <div class={thresholdClass(c1.peak30d, c1.thresholds.peak30dMin)}>
          GOAL.md threshold: peak ≥ {c1.thresholds.peak30dMin} (≥2 acceptable in startup)
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Structural cap</span>
          <span class={s.metricValue}>{cur.structuralCap}</span>
        </div>
        <div class={thresholdClass(cur.structuralCap, c1.thresholds.structuralCapMin)}>
          GOAL.md threshold: cap ≥ {c1.thresholds.structuralCapMin} (hard)
        </div>

        <div class={s.bar}>
          <div class={s.barLabel}>
            <span>24h concurrency time-share</span>
            <span>
              ≥3:{pct(ts.ge3)} · =2:{pct(ts.eq2)} · =1:{pct(ts.eq1)} · =0:{pct(ts.eq0)}
            </span>
          </div>
          <div class={s.barTrack}>
            <div class={s.barFill} style={`width: ${(ts.ge3 * 100).toFixed(1)}%`} />
            <div class={s.barFillEq2} style={`width: ${(ts.eq2 * 100).toFixed(1)}%`} />
            <div class={s.barFillEq1} style={`width: ${(ts.eq1 * 100).toFixed(1)}%`} />
            <div class={s.barFillEq0} style={`width: ${(ts.eq0 * 100).toFixed(1)}%`} />
          </div>
        </div>
        <div class={thresholdClass(ts.ge3 + ts.eq2, c1.thresholds.timeShareGe2Min)}>
          GOAL.md threshold from month 4: time at ≥2 should be ≥{" "}
          {pct(c1.thresholds.timeShareGe2Min)}
        </div>

        <Sparkline />
      </div>
    );
  });

  const c3Section = computed(monitorSnapshot, (snap) => {
    const c3 = snap?.c3;
    if (!c3) {
      return (
        <div class={s.cardBody}>
          <div class={s.metricRow}>
            <span class={s.metricLabel}>Loading…</span>
          </div>
        </div>
      );
    }
    return (
      <div class={s.cardBody}>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Total interventions (30d)</span>
          <span class={s.metricValue}>{c3.totals.total}</span>
        </div>
        <div class={s.metricMeta}>
          rescue {c3.totals.rescue} · acceptance {c3.totals.acceptance} · auth{" "}
          {c3.totals.authorization} · other {c3.totals.other}
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Rescue ratio (failure signal)</span>
          <span class={s.metricValue}>{pct(c3.rescueRatio)}</span>
        </div>
        <div class={thresholdMaxClass(c3.rescueRatio, c3.thresholds.rescueRatioMax)}>
          GOAL.md threshold from month 4: rescue ratio ≤ {pct(c3.thresholds.rescueRatioMax)}
        </div>
        <div class={s.metricRow}>
          <span class={s.metricLabel}>Per-requirement (auth + accept)</span>
          <span class={s.metricValue}>{c3.perRequirementAuthAcceptance.toFixed(2)}</span>
        </div>
        <div
          class={thresholdMaxClass(
            c3.perRequirementAuthAcceptance,
            c3.thresholds.perRequirementAuthAcceptanceMax,
          )}
        >
          GOAL.md threshold from month 4: ≤ {c3.thresholds.perRequirementAuthAcceptanceMax}
        </div>
        <RecentInterventions list={c3.recent} />
      </div>
    );
  });

  const summaryStrip = computed(monitorSnapshot, (snap) => {
    if (!snap) {
      return (
        <div class={s.summaryStrip}>
          <div class={s.summaryItem}>
            <span class={s.summaryLabel}>C1</span>
            <span class={s.summaryValue}>—</span>
            <span class={s.summaryStatus}>loading</span>
          </div>
          <div class={s.summaryItem}>
            <span class={s.summaryLabel}>C2</span>
            <span class={s.summaryValue}>—</span>
            <span class={s.summaryStatus}>not measured</span>
          </div>
          <div class={s.summaryItem}>
            <span class={s.summaryLabel}>C3</span>
            <span class={s.summaryValue}>—</span>
            <span class={s.summaryStatus}>not measured</span>
          </div>
          <div class={s.summaryItem}>
            <span class={s.summaryLabel}>C4</span>
            <span class={s.summaryValue}>—</span>
            <span class={s.summaryStatus}>not measured</span>
          </div>
        </div>
      );
    }
    return (
      <div class={s.summaryStrip}>
        <div class={s.summaryItem}>
          <span class={s.summaryLabel}>C1 concurrency</span>
          <span class={s.summaryValue}>
            {snap.c1.current.activeRequirements} now · peak {snap.c1.peak30d}
          </span>
          <span class={s.summaryStatus}>cap {snap.c1.current.structuralCap}</span>
        </div>
        <div class={s.summaryItem}>
          <span class={s.summaryLabel}>C2 OSS fallback</span>
          <span class={s.summaryValue}>—</span>
          <span class={s.summaryStatus}>slice 4 will fill</span>
        </div>
        <div class={s.summaryItem}>
          <span class={s.summaryLabel}>C3 intervention</span>
          <span class={s.summaryValue}>
            {snap.c3 ? `rescue ${pct(snap.c3.rescueRatio)} · ${snap.c3.totals.total} total` : "—"}
          </span>
          <span class={s.summaryStatus}>
            {snap.c3 ? `${snap.c3.totals.rescue} rescue` : "not measured"}
          </span>
        </div>
        <div class={s.summaryItem}>
          <span class={s.summaryLabel}>C4 silence</span>
          <span class={s.summaryValue}>—</span>
          <span class={s.summaryStatus}>slice 3 will fill</span>
        </div>
      </div>
    );
  });

  return (
    <div class={s.view}>
      <div class={s.header}>
        <div>
          <div class={s.title}>Observability monitor</div>
          <div class={s.subtitle}>
            Live numeric evidence behind the C1–C4 verdicts in goals/record.md.
          </div>
        </div>
        <div class={s.uptime}>{headerLine}</div>
      </div>

      {summaryStrip}

      <div class={s.criterionGrid}>
        <div class={s.card}>
          <div class={s.cardHeader}>
            <div class={s.cardTitle}>C1 — Concurrency</div>
            <div class={s.cardSubtitle}>Real multi-requirement concurrency</div>
          </div>
          {c1Section}
        </div>

        <div class={s.card}>
          <div class={s.cardHeader}>
            <div class={s.cardTitle}>C2 — OSS fallback</div>
            <div class={s.cardSubtitle}>No irreplaceable closed-source dependence</div>
          </div>
          <div class={s.placeholder}>
            <div class={s.placeholderTitle}>Slice 4</div>
            <div class={s.placeholderBody}>
              Binding inventory + reachability metric land here.
            </div>
          </div>
        </div>

        <div class={s.card}>
          <div class={s.cardHeader}>
            <div class={s.cardTitle}>C3 — Intervention budget</div>
            <div class={s.cardSubtitle}>Rescue ratio and per-requirement intervention count</div>
          </div>
          {c3Section}
        </div>

        <div class={s.card}>
          <div class={s.cardHeader}>
            <div class={s.cardTitle}>C4 — Async non-blocking</div>
            <div class={s.cardSubtitle}>All-silent ratio + auth-wait utilization</div>
          </div>
          <div class={s.placeholder}>
            <div class={s.placeholderTitle}>Slice 3</div>
            <div class={s.placeholderBody}>silence + activity sparkline land here.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentInterventions(props: { list: import("../api/types.ts").Intervention[] }) {
  if (props.list.length === 0) {
    return (
      <div class={s.metricMeta}>No interventions recorded yet.</div>
    );
  }
  return (
    <div class={s.interventionList}>
      <div class={s.barLabel}>
        <span>Recent interventions</span>
        <span>{props.list.length}</span>
      </div>
      {props.list.slice(0, 6).map((iv) => (
        <div class={s.interventionRow}>
          <span class={typeBadgeClass(iv.type)}>{iv.type}</span>
          <span class={s.interventionTs}>{fmtIntervention(iv.ts)}</span>
          <span class={s.interventionTarget}>
            {iv.harness ?? ""}
            {iv.agent ? ` · @${iv.agent}` : ""}
          </span>
          <span class={s.interventionReason}>{iv.reason ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function typeBadgeClass(type: string) {
  if (type === "rescue") return [s.interventionType, s.interventionTypeRescue];
  if (type === "authorization") return [s.interventionType, s.interventionTypeAuth];
  if (type === "acceptance") return [s.interventionType, s.interventionTypeAccept];
  return [s.interventionType, s.interventionTypeOther];
}

function Sparkline() {
  const bars = computed(monitorRecentSamples, (samples) => {
    if (samples.length === 0) {
      return (
        <div class={s.sparkline}>
          <div class={s.barLabel}>
            <span>Live activity (last 60s)</span>
            <span>—</span>
          </div>
          <div class={s.spark} />
        </div>
      );
    }
    const max = Math.max(1, ...samples.map((sm) => sm.activeAgents));
    return (
      <div class={s.sparkline}>
        <div class={s.barLabel}>
          <span>Live activity — active agents (last 60s)</span>
          <span>max {max}</span>
        </div>
        <div class={s.spark}>
          {samples.map((sm) => (
            <div
              class={[s.sparkBar, sm.activeAgents > 0 ? s.sparkBarRunning : ""]}
              style={`height: ${Math.max(4, (sm.activeAgents / max) * 100)}%`}
            />
          ))}
        </div>
      </div>
    );
  });
  return bars;
}
