---
name: perf
description: >-
  Run web UI performance tests for the agent-worker project. Automates build, daemon restart,
  cache-bust version bump, Lighthouse audit, and metric reporting — all in one command.
  Use this skill when the user says "run perf", "check performance", "lighthouse", "perf test",
  "why is it slow", "check TBT", "性能测试", "跑一下性能", or wants to measure/compare
  web UI performance. Also trigger after making changes to semajsx/style, render, or any
  web UI component when performance impact needs verification.
---

# Web UI Performance Testing

One-command performance test for the agent-worker web UI.

## Usage

Run the full pipeline (build → restart → Lighthouse → report):

```bash
bash ~/.claude/skills/perf/scripts/run-perf.sh
```

### Options

| Flag | Effect |
|------|--------|
| (none) | Full pipeline: bump version, build, restart daemon, run Lighthouse |
| `--no-build` | Skip build + version bump (test current deployed code) |
| `--no-restart` | Skip daemon restart |
| `--quick` | Skip Lighthouse, do a fast agent-browser DOM check instead |

### Quick check (no Lighthouse, ~3s)

```bash
bash ~/.claude/skills/perf/scripts/run-perf.sh --quick
```

Returns DOM node count, style element count, list items, buttons — useful for verifying
a change didn't break rendering without waiting for a full Lighthouse run.

## What the metrics mean

| Metric | Target | Why it matters |
|--------|--------|----------------|
| **TBT** (Total Blocking Time) | <200ms | Time the main thread is blocked — directly causes "can't click" |
| **TTI** (Time to Interactive) | <1s | When the page first becomes fully interactive |
| **FCP** (First Contentful Paint) | <0.5s | When the user first sees content |
| **LCP** (Largest Contentful Paint) | <1.5s | When the main content is visible |
| **Style & Layout** | <100ms | CSS style recalculation + layout — the main bottleneck in this app |
| **Long Tasks** | 0 >500ms | Tasks that block the event loop — causes UI freezes |

## Comparing runs

The script automatically saves the previous Lighthouse report and shows deltas:

```
  TBT  ✗ 4,290 ms  (-2000ms)    ← improved by 2 seconds
  Style & Layout: 2000ms  (-6000ms)  ← big improvement
```

## Common performance issues in this project

1. **semajsx/style CSS injection** — Each `rule()` call injects CSS. If `injectStyles()`
   modifies `<style>.textContent` N times synchronously, it causes N CSSOM rebuilds.
   Fix: batch into buffer, flush once per microtask.

2. **Signal-driven DOM replacement** — `computed` signal updates call `renderValueToNode`
   which creates an entire new DOM subtree and replaces the old one. No diffing.
   Large lists (50+ channel messages, event lists) cause heavy layout work.

3. **Channel message history** — `loadChannelHistory` fetches all messages and sets them
   at once on the signal, triggering synchronous DOM creation for every message.
   Fix: limit initial fetch, implement virtual scrolling, or defer rendering.

4. **Build cache** — `semajsx/style` resolves to the umbrella package's pre-built `dist/`.
   After changing semajsx source, must rebuild both `packages/style` AND `packages/semajsx`:
   ```bash
   cd vendor/semajsx/packages/style && bun run build
   cd vendor/semajsx/packages/semajsx && bun run build
   ```

## Workflow

Typical performance debugging cycle:

1. `bash ~/.claude/skills/perf/scripts/run-perf.sh` — baseline
2. Make a change
3. `bash ~/.claude/skills/perf/scripts/run-perf.sh` — compare
4. Read the delta — did TBT/Style&Layout improve?
5. Repeat
