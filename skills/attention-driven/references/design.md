# Design Reference

Design is the current system-shape layer.

## Design Directory

`design/` is the architectural source of truth when present:

- `design/DESIGN.md`: current system shape.
- `design/packages/*.md`: per-package or per-area shape.
- `design/decisions/*.md`: reasoning records for shape changes.
- `blueprints/*.md`: task-level implementation records.

## 30/70

Design captures the 30% that changes the system's shape:

- module boundaries;
- data flow;
- key mechanisms;
- durable ownership;
- major tradeoffs and non-goals.

The agent owns the 70% inside that shape: local APIs, helpers, algorithms,
internal organization, and implementation strategy.

The design constraint applies across the whole development cycle, not only
"architecture tasks": planning scopes against design, coding stays inside the
owning boundary, testing checks named mechanisms, review prioritizes shape
violations over style, debugging proposes when the real fix crosses a boundary,
and rollback preserves adopted shape.

## Decision Trigger

Write a decision when the task changes shape:

- add/remove/merge modules;
- change how modules connect;
- change durable artifact ownership;
- introduce or remove a key mechanism;
- adopt a new architectural pattern.

If unsure, prefer action inside current shape unless a real boundary changes.
Do not inflate small refactors into decisions.

From the localized engineering-control lens, a design decision changes the
working model: what the system is, how parts connect, where observations are
taken, and which corrections are valid. If implementation keeps applying local
corrections but the gap recurs, suspect the system-shape assumption before
adding more patches.

## Blueprint Trigger

Write a blueprint when the work is non-trivial, resumable across sessions, or
needs explicit verification criteria. Keep it lightweight. A blueprint is not a
second design source; it is an implementation record.

Before drafting, check current state and pending claims:

- current state: `design/DESIGN.md` plus code;
- pending claims: active blueprints, recent blueprint follow-ups, and proposed
  design decisions.

Past blueprints are records, not state. Do not reconstruct current behavior
from old blueprint Approach sections; read design and code. If they disagree,
audit drift before layering new work on a stale skeleton.

For active blueprints, TODO/State is scaffold. State is a resumption surface,
not a spec. If a completed TODO matters for handoff, update State immediately
with what changed and what evidence supports it.

## Drift Handling

- `DESIGN.md` stale but implementation is accepted reality: doc-only drift.
- Implementation violates accepted design: implementation drift.
- Both are unclear: decision needed.
- Old blueprint/decision is historically awkward: leave history alone unless it
  misleads current state.

Close-out keeps design as current state. Before finishing substantial work,
check whether `DESIGN.md` or package docs need a doc-only update, whether a
follow-up is a real pending claim, or whether a repeated pattern should be
promoted into design. Skipping close-out rots the skeleton.

## Audit Buckets

- Doc-only drift: code is accepted reality and design fell behind.
- Shape-level drift: code changed system shape without a decision; write a
  retroactive decision rather than laundering it silently.
- Code-should-change: code violates design and the design still seems right;
  ask the human before "fixing" it.

## Cold Review

For substantial shape changes, use `references/cold-review-prompt.md` with a
fresh reviewer before asking the human to adopt the decision.
