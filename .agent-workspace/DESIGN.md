# Agent Worker Development Workspace Design

## Overview

Dogfood workspace: agents develop agent-worker + semajsx using agent-worker itself.
Runs alongside the global workspace in the same daemon.
Inspired by open-source community patterns: maintainer + contributors + bot.

## Two Repos

```
~/workspaces/agent-worker/              ← Repo A: runtime + knowledge base
  .agent-workspace/
    workspace.yml                       ← workspace definition
    documents/                          ← team docs (git tracked)
    chronicle/                          ← historian records (git tracked)
  packages/...                          ← daemon runs from here

~/.agent-worker/workspace-data/agent-worker-dev/
  sandbox/                              ← Repo B: agents' working copy
```

- **Repo A**: stable version. Daemon code + knowledge persistence. Not modified by agents.
- **Repo B**: cloned during setup. Agents branch, code, and test here freely.

## Team

Assignment based on model benchmarks + usage budget.

| Agent | Runtime | Model | Budget | Domain | Rationale |
|-------|---------|-------|--------|--------|-----------|
| `maintainer` | claude-code | Opus 4.6 | $100/mo | Architecture, review, critical code | GPQA 91.3% deep reasoning |
| `kimi-code` | ai-sdk | K2.5 | coding plan | **Workhorse**: web UI, semajsx, frontend, refactor | Strongest frontend, good debug/refactor |
| `minimax` | ai-sdk | M2.7 | coding plan | **Workhorse**: workspace, agent, shared, e2e | 97% skill adherence, agent infra |
| `codex` | codex | GPT-5.4 | $20/mo | CLI, daemon, terminal tasks (sparingly) | Terminal-Bench SOTA, but tightest budget |
| `cursor` | cursor | auto | — | Trivial fixes (backup) | Fast but unstable |
| `bot` | ai-sdk | deepseek | API, very cheap | Chronicle, retrospective reports | Cheap & stable |

### Budget strategy

- **kimi-code + minimax are the primary developers** — coding plan gives generous usage
- **codex has the tightest budget ($20/mo)** — reserve for terminal/system tasks only
- **maintainer (opus)** — $100/mo is sufficient; spend on judgment and review, not grunt work
- **cursor** — unreliable, only for trivial tasks
- **deepseek** — extremely cheap, runs continuously without concern

### Domain mapping

```
packages/web (UI, semajsx)           → kimi-code    [workhorse]
vendor/semajsx (framework)           → kimi-code    [workhorse]
packages/workspace (MCP, context)    → minimax      [workhorse]
packages/agent (runtime, tools)      → minimax      [workhorse]
packages/shared (utils)              → minimax      [workhorse]
packages/agent-worker (daemon, CLI)  → codex        [sparingly]
packages/loop (CLI loops)            → codex        [sparingly]
Cross-package architecture           → maintainer
Trivial fixes                        → cursor       [backup]
```

### Design principles

- Maintainer writes critical code and reviews all PRs
- Contributors matched to domains by model capability, not randomly
- Budget constraints are real — codex limited to high-value terminal tasks
- Cursor is unreliable — only trivial tasks
- minimax not suited for rapid prototyping (weak vibe coding) but excellent at patient delivery

## Channels

| Channel | Purpose |
|---------|---------|
| `#general` | Requirements, task assignment, coordination |
| `#dev` | Technical discussion, completion reports, blockers |
| `#review` | Maintainer's review feedback |

3 channels is enough. More creates coordination overhead.

## Workflows

### Feature

```
Requirement → maintainer breaks down tasks → assigns to contributors
  → contributor creates branch, implements, self-tests
  → reports in #dev + @maintainer for review
  → maintainer feedback in #review
  → approved → merge
  → bot records milestone
```

### Bug fix

```
Report → maintainer confirms → assigns to contributor
  → fix + add tests → maintainer review → merge
  → bot records correction
```

### Retrospective (every 3-5 features)

```
maintainer: "@bot prepare retrospective"
  → bot reads chronicle + channel history → writes report
  → maintainer reviews → discusses in #general
  → update conventions, adjust assignments, clean tech debt
```

### Architecture change

```
maintainer writes ADR (problem → solution → impact)
  → optional: ask codex or contributor to analyze first
  → implement → maintainer reviews boundaries carefully
  → bot records decision
```

## Tech debt

**Detection:**
- maintainer finds during review
- contributors find during implementation
- bot summarizes during retrospective

**Priority:** P0 (immediate) / P1 (next sprint) / P2 (track it)

**Focus areas:** type safety, test coverage, dependency health, code duplication, API consistency, semajsx memory leaks.

## Quality gates

Before merge:
1. `bun test` passes
2. `oxlint` clean
3. `tsgo --build` no new type errors
4. maintainer approves

For major changes:
5. Web UI Lighthouse not regressed
6. No new circular dependencies

## Storage

**Git tracked (project knowledge, .agent-workspace/):**
- `documents/` — team docs
- `chronicle/` — historian records
- `workspace.yml`, `DESIGN.md`

**Gitignored (runtime state):**
- `channels/`, `agents/`, `status.json`, `resources/`
