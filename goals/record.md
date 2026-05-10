# Record

Session-by-session log. Each entry: what was done, observations, per-criterion
check with concrete evidence, judgment naming the principal tension.

## 2026-05-09 — Kickoff

- What I did: established `goals/GOAL.md` via interview (`/goal-driven set`).
  General Line, 4 criteria (C1–C4), 3 invariants, 5 non-goals confirmed
  section by section.
- Observations: All criteria depend on a continuous monitor that does not
  yet exist; consequently C1–C4 will return `unclear` until the monitor
  is built. This is a known precondition, not a deficiency — see GOAL.md
  conventions.
- Criteria check:
  - C1 unclear (monitor not built; no observation possible)
  - C2 unclear (monitor not built; binding inventory not yet instrumented)
  - C3 unclear (monitor not built; no intervention log)
  - C4 unclear (monitor not built; no activity sampling)
- Judgment: no change. Principal tension on entering real work is the
  monitor itself — without it, no criterion can be exercised. Next
  session begins by drafting the observability monitor proposal in
  `design/decisions/`.
- Next: draft `design/decisions/004-observability-monitor.md` (placeholder
  identified during set; concrete shape to be designed).

## 2026-05-10 — Decision 006 + slice 1 (Harness as agent environment)

- What I did:
  - Started session by surfacing principal tension (monitor) and proposing
    track A (decision 004) vs track B (decision 005's queued slices).
    Human chose B.
  - Drafted hook-protocol blueprint (`blueprints/handoff-extension-hook-protocol.md`).
    Human flagged two structural concerns:
    (1) blueprint was slice-shaped, not terminal-shaped;
    (2) "Workspace" privileges multi-agent coordination flavor in the
    kernel name, foreclosing the General Line's "shapeable work environment".
  - Drafted `design/decisions/006-harness-as-agent-environment.md`:
    rename `Workspace` → `Harness`, `HarnessType` as shape primitive
    (one type per Harness, fixed at construction), substrate criterion
    splits universal mechanism from type-specific content. Adversarial
    cold-review subagent surfaced 5 findings; addressed 4 inline (lifecycle,
    consequences/rename surface, substrate criterion, scope sequencing) and
    defended 1 (YAGNI — TaskTrackingHarness from 005 forces the substrate
    cut now). Adopted by human.
  - Reshaped design layer: renamed `design/packages/workspace.md` →
    `harness.md`; new `harness-types/coordination.md`; updated DESIGN.md
    architecture diagram, modules, key mechanisms; forward-reference
    notes added to decisions 003/004/005; deleted invalidated
    hook-protocol blueprint. Committed as `0eb8bfe`.
  - Built and shipped slice 1: harness rename + HarnessType registry.
    Whole-codebase rename (88+ files, package import, HTTP routes, CLI,
    storage paths). New `internals/harness/src/type/` module. `Handoff`
    gains `harnessTypeId`; registry threaded Daemon → Harness → MCP tools.
    `runProduceExtension` wired into all 3 Handoff write sites.
    `runConsumeExtension` helper lands with unit-test coverage but no
    live caller (deferred to auto-checkpoint blueprint). Committed as `c9f8be2`.

- Observations:
  - 935 tests pass / 0 fail (baseline 922, +13 new harness-type tests).
  - Typecheck clean across affected packages.
  - A2A smoke `bun internals/harness/test/a2a/coordination-harness.ts T1` PASS.
  - Refactor posture honored: zero `Workspace` PascalCase identifiers
    remain in source; remaining `[Ww]orkspace` hits are all intentional
    (Bun protocol, Codex sandbox mode, generic English, test mocks).
  - The methodology pushback from the human ("not temporary, terminal
    shape") forced a substantive re-think mid-session — without it, the
    original hook-protocol blueprint would have shipped HarnessType as
    a sidecar to a class still called Workspace, which would have been
    immediate technical debt.

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. Monitor still
    not built; no concurrency measurements taken this session.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory work; OSS fallbacks not exercised.
  - C3 (Intervention budget) — `unclear`. No intervention log
    instrumented this session.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — not violated. No
    agents dispatched; the design changes structurally *strengthen*
    Inv-1 by making "harness owns context" explicit at the type level.
  - Inv-2 (Every binding has OSS fallback) — not exercised this session.
  - Inv-3 (Auto-test before user acceptance) — N/A; this session was
    design + structural code, not work submitted for acceptance.

- Judgment: principal tension is still the **monitor** (C1–C4 all
  unclear, second consecutive entry). This session deliberately deferred
  the monitor to land structural rework (006 + slice 1) at the user's
  direction — defensible because the structural shape directly
  determines what the monitor will instrument. But two consecutive
  `unclear` entries on every criterion is now visible as a known
  liability per GOAL conventions ("`unclear` accumulating ≥ 2 months
  on a criterion triggers a review"). Not yet at the threshold (1 day,
  not 2 months), but the trajectory is clear.

- Next: human chooses between (a) continue slice 2 of decision 006
  (substrate cut — extract channels/inbox/bridge into the coordination
  HarnessType), keeping momentum on the structural rework; or (b)
  pivot to track A (decision 004 — observability monitor) and start
  measuring against C1–C4. Recommendation: (a) one more slice to land
  the substrate cut while the rename context is fresh, then pivot to
  (b) before the `unclear` trail grows further.
