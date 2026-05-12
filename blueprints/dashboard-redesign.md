# Dashboard redesign proposal

> 2026-05-12 — Hermes, after analyzing Claude Code Agent View interaction patterns.

## Design principles

1. **Work-first, not resource-first.** The primary screen answers "what needs my attention" not "what agents exist."
2. **Stay-in-place interaction.** Peek progress, reply, cancel — all without navigating away from the list.
3. **One-step dispatch.** Task input lives on the main screen, not behind a dialog.
4. **Color as signal, grayscale as hierarchy.** Red = needs you. Green = working. Gray = idle.

## Component tree

```
DashboardView
├── StatsBar          # 3 running · 2 need you · 5 idle
├── TaskInput         # Fixed bottom: type task → pick agent → Enter
├── WorkList          # Unified list, grouped by attention level
│   ├── Group: Needs you    (blocked / rescue / fatal)
│   ├── Group: Working      (in progress, live activity)
│   ├── Group: Idle         (waiting for task)
│   └── Group: Recently done (collapsed default)
└── PeekPanel         # Right panel: live activity for selected row
    ├── AgentHeader
    ├── ActivityFeed  # SSE stream
    └── QuickActions  # Pause / Resume / Cancel / Open full chat
```

## WorkRow

```
┌─ state bar ─┬─ primary ────────────────┬─ meta ──────┬─ actions ─┐
│  🔴 needs   │ codex                    │ global·2m   │ [Resume]  │
│     you     │ blocked: auth            │              │ [Config]  │
│  🟢 working │ codex                    │ global·30s  │ [Peek]    │
│             │ tool: shell · npm test   │ task_a056a3 │ [Cancel]  │
│  ⚪ idle     │ deepseek                 │ global·10m  │ [Assign]  │
│             │ ai-sdk · deepseek-chat   │              │            │
└─────────────┴──────────────────────────┴─────────────┴───────────┘
```

## PeekPanel

- Slide-in right panel on row selection (Arrow keys navigate, Esc closes)
- Live activity feed from `/agents/:name/responses/stream`
- Inline reply input
- Quick actions: Pause / Resume / Cancel / Open full chat

## TaskInput

- Always-visible input at bottom of list
- `To: [agent ▾]  Priority: [normal ▾]  [Send →]`
- Enter sends, Shift+Enter newline
- Auto-creates task + dispatches to selected agent
- Remember last agent in localStorage

## Data flow

- New store `work-feed.ts`: merges agent state + harness state + events → `WorkItem[]` sorted by attention
- Existing SSE endpoints feed peek panel and live activity
- `POST /harnesses/global/send` or task create + dispatch for new tasks

## Implementation order

1. WorkRow — change row content from identity to activity (smallest change, biggest perception shift)
2. Grouping — split flat list into Needs you / Working / Idle / Done
3. PeekPanel — inline activity panel consuming existing SSE
4. TaskInput — bottom input bar
5. StatsBar — top numbers
