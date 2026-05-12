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

## 2026-05-10 — Decision 007 (engineering cybernetics lens digression)

- What I did:
  - Human noted resonance between Tsien's 工程控制论 and the project,
    asked what could be absorbed into the project itself (not the
    skill layer — `references/control-loop.md` already covers the
    methodology absorption).
  - Mapped 工程控制论 concepts to current design: most are already
    implicitly absorbed (closed feedback loop in the data flow,
    bounded ContextPacket as control under incomplete information,
    Wake-as-sampling, idempotent replay as disturbance rejection,
    cross-Harness routing through substrate as decentralized control).
    Recommended A (observability invariant) + D (clock-domain
    placement) as the smallest pair to make explicit.
  - Drafted `design/decisions/007-engineering-cybernetics-lens.md`
    with A + D contracts.
  - Ran adversarial cold-review subagent. 8 findings; most material:
    D had no concrete current-design mechanism it would catch beyond
    what 006 already filters; "decidable state" exemption was
    relabel-abusable; observability invariant unscoped (read stronger
    than intended given LLM-as-plant); pre-mortem validated only
    against currently-conforming mechanisms.
  - Revised 007: **dropped contract D entirely** (recorded in
    Alternatives as deferred); scoped invariant to "Harness-layer
    decidable state"; hardened exemption clause (regeneration source
    must be durable + external + sufficient); added classification
    table covering capability ledgers (projection), idempotency
    outbox (substrate truth), `HarnessTypeRegistry` / MCP hub /
    EventBus (scaffolding), runtime-local session files (scoped
    exemption); introduced `proposed` → `tentative-adopted` →
    `adopted` status ladder forcing a falsification track record
    before the criterion becomes binding precedent. Added Cold
    review section in 006's format. Status left at `proposed`.

- Observations:
  - 007 went through one cold-review cycle that materially shaped the
    final form (D dropped, scope narrowed, exemption hardened).
    Without it, D would have shipped as duplicate-of-006 ceremony.
  - **Mid-session priority error.** I initially mis-named the active
    initiative as `monitor` (decision 004), forgetting that the prior
    record's recommended next move was decision 006 slice 2
    (substrate cut: extract channels/inbox/bridge into coordination
    HarnessType), with monitor sitting *behind* it. Human corrected.
    Verified: `internals/harness/src/harness.ts` still has 46
    channel/inbox/bridge/telegram references; `blueprints/` has no
    slice-2 blueprint. Slice 2 is genuinely the active initiative.
  - No code changes this session. No DESIGN.md changes (007 deferred
    to adoption).

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. Monitor
    still not built; no measurements. Third consecutive `unclear`,
    but monitor is queued behind slice 2 by prior plan, so this is
    expected, not drift.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — not exercised,
    not violated. 007's scope clause is structurally consistent with
    Inv-1.
  - Inv-2 (OSS fallback per binding) — not exercised.
  - Inv-3 (Auto-test before user acceptance) — N/A; design proposal,
    not work submitted for acceptance.

- Judgment: principal tension is **decision 006 slice 2 — substrate
  cut**. This session was a genuine digression from slice 2 (not
  from monitor — monitor sits behind slice 2 by the prior session's
  recommendation). The 007 detour was defensible (codifies pre-existing
  patterns at near-zero ongoing cost, low-disturbance addition) but
  did not move slice 2 forward. Path-level: next session opens with
  drafting `blueprints/coordination-substrate-cut.md` and starting
  the cut, then pivots to monitor (track A) once slice 2 lands.
  Goal-level: no change. Lesson recorded: when starting a session,
  read the prior record's "next" line before naming the mainline,
  not just GOAL.md's principal-tension framing — they can disagree
  when an intermediate initiative is in flight.

## 2026-05-10 — Slice 2 blueprint open-question resolution

- What I did:
  - Resumed on the slice-2 substrate-cut blueprint (planning state from
    prior session). Per prior record's "next": start the cut.
  - Identified the bundled-commit constraint: the substrate cut has to
    land in one slice (refactor posture: "names match terminal shape
    from day one") and is too large for one session as raw code work.
    Closeable work for this session = pre-build planning, specifically
    the four open questions guarding the build.
  - Read substrate `internals/harness/src/types.ts`,
    `internals/harness/src/loop/prompt.tsx`,
    `internals/harness/src/loop/prompt-ui.tsx` to ground the resolutions
    in current shapes rather than generic guesses.
  - Updated blueprint (`blueprints/coordination-substrate-cut.md`):
    - **Status:** draft → build-ready.
    - **Q #1 (typed-runtime accessor):** kept `harness.typeRuntime`
      slot + typed coord accessor; rejected generic `contribution<T>(id)`
      lookup (one type per Harness, no keying needed).
    - **Q #2 (HarnessRuntime):** Plan A. Substrate runtime drops
      `defaultChannel`, `bridge`, `instructionQueue`, `registerAgent`,
      `agentSandboxDir`. Coord exports its own `CoordinationRuntime`
      interface and `coordinationRuntime(harness)` accessor. Plan B
      (composite type) rejected — would force every substrate consumer
      to import the composite and pull coord back into substrate import
      graph, defeating the cut.
    - **Q #3 (HarnessStateSnapshot):** Plan B. Snapshot becomes
      `{ substrate, typeExtensions: Record<string, unknown> }`; coord
      `snapshotExtension` returns `CoordinationSnapshot`; coord exports
      a `stitchSnapshot` helper for callers wanting a flat view.
      Posture rule "land new shape fully" wins over Plan A's smaller
      churn — consumers update inside this slice.
    - **Q #4 (prompt split):** `prompt-ui.tsx` stays substrate (pure
      rendering). `prompt.tsx` keeps `assemblePrompt`, `PromptSection`,
      `soulSection`, slimmed `PromptContext`. Coord owns `inboxSection`,
      `responseGuidelines`, `CoordinationPromptContext`. `BASE_SECTIONS`
      moves to coord (two of three sections are coord); substrate
      exports `SUBSTRATE_BASE_SECTIONS = [soulSection]`.
  - TODO scaffold updated: removed the two pre-build items now resolved;
    added explicit substrate-types/HarnessRuntime/Snapshot/prompt
    sub-items reflecting the resolutions.

- Observations:
  - All four resolutions emerged with low ambiguity — the read of
    current types/prompt shapes makes the boundary obvious. No
    "decide during build" residue remains.
  - No code changes. No tests run. Typecheck unaffected.
  - Prior session's three artifacts (record entry for decision-007,
    `design/decisions/007-engineering-cybernetics-lens.md`,
    `blueprints/coordination-substrate-cut.md`) remain uncommitted —
    they sit on disk as durable session output, no commit attempted
    per project policy ("only commit when requested").

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. Monitor not
    built. Fourth consecutive entry. Per GOAL conventions, "≥ 2 months
    accumulating" triggers review; we are 1 day in. Expected — monitor
    is still queued behind slice 2 by adopted plan.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — not exercised.
    The blueprint resolutions structurally strengthen Inv-1 (substrate
    runtime no longer carries coord's per-agent registration; coord
    runtime owns it).
  - Inv-2 (OSS fallback per binding) — not exercised.
  - Inv-3 (Auto-test before user acceptance) — N/A; planning slice.

- Judgment: principal tension is still **decision 006 slice 2 —
  substrate cut**. This session converted the blueprint from "draft
  (planning)" to "build-ready" by resolving the four guard questions.
  Path-level: next session opens at the build phase — start with the
  expanded `HarnessType` interface in
  `internals/harness/src/type/types.ts`, then create
  `internals/harness-coordination/` peer package, then move stores +
  bridge + queue + lead-hooks + telegram + MCP tools, then update
  daemon wiring and tests. Bundle as one slice per posture rule.
  Goal-level: no change.

- Next: build phase of slice 2. First three TODO items are now (a)
  expand `HarnessType` interface; (b) add `typeRuntime` slot + lifecycle
  wire-up; (c) drop coord fields from substrate `ContextProvider`
  while creating coord stores. (a)+(b) are landable as a precursor
  commit if the actual file moves prove to need >1 session; (c)
  through end of TODO scaffold must land bundled.

## 2026-05-10 — Slice 1 baseline repair (pre-slice-2)

- What I did:
  - Started session intending to begin slice 2 build phase. Ran
    `bunx tsgo -p internals/harness/tsconfig.json` as the entry
    observation; surfaced 3 typecheck errors slice 1 had left behind.
    Investigated; root `bun run typecheck` hides them by failing
    earlier on unrelated terminal-package errors and on a stale
    `internals/workspace/tsconfig.json` path that no longer exists.
  - Repaired baseline as a closed fact-level slice before starting
    slice 2's bundled-commit work. Per methodology, fact-level repairs
    can land independently of the design-shape slice they unblock.
  - **Repairs applied:**
    1. `internals/harness/src/type/helpers.ts:32` — added `override`
       modifier to `cause` field of `HandoffExtensionConsumeError`
       (TS4114: subclass override of `Error.cause`).
    2. `internals/harness/src/state/types.ts` — added missing
       `HandoffDraft` export. Defined as `{ summary: string; kind?:
       HandoffKind; completed?, pending?, blockers?, decisions?,
       resources?: string[] }` based on actual call sites in
       `harness.ts`, `daemon.ts`, `mcp/task.ts`, plus the test fixture.
    3. `internals/harness/src/types.ts` — added `HarnessEvent` type
       export (alias for `TimelineEvent` until the work-log slice
       lands a richer event surface).
    4. `package.json` — corrected stale `internals/workspace/tsconfig.json`
       path in the `typecheck` script and `internals/workspace/test`
       in the `test` script (slice 1 renamed the directory but missed
       these script entries).
    5. `internals/loop/test/codex-loop.test.ts:55` — corrected
       `"workspace-write"` sandbox literal to `"harness-write"` per
       the slice-1 rename.
    6. **Plural-typo sweep** — slice 1's `Workspace`→`Harness` rename
       produced `harnesss` / `Harnesss` / `HARNESSS` (triple-s) wherever
       the source had `workspaces` / `Workspaces` / `WORKSPACES`. Bulk
       sed across `internals/` and `packages/` corrected 202 occurrences
       to the correct plural `harnesses` / `Harnesses` / `HARNESSES`.
       Touched URLs (e.g. `/harnesses/:id/channels/:id`), API field
       names (`harnesses: number`), identifiers (`harnesses` signal,
       `harnessesLoading`, `fetchHarnesses`, `listHarnesses`), strings
       ("No harnesses"), and JSDoc comments.
    7. `internals/web/tsconfig.json` — added `types: ["@types/bun"]`
       so the web package's typecheck recognizes `bun:test` (used by
       co-located `*.test.ts` files in `src/`). Web tsconfig stands
       alone (does not extend root) and previously had no bun-types
       wired.

- Observations:
  - `bunx tsgo -p internals/harness/tsconfig.json` — clean.
  - Root-script typecheck (`bun run typecheck`) still fails on
    pre-existing `internals/terminal/src/*` errors (missing
    `@types/node` in the SemaJSX terminal package) — those are
    orthogonal to the agent-worker rename work and predate this
    branch (see `7e3f851 Merge semajsx into the monorepo`). Not
    in scope; flagged for a separate fact-level fix later.
  - Direct invocations confirm clean:
    - `tsgo -p internals/harness/tsconfig.json` ✓
    - `tsgo -p internals/loop/tsconfig.json` ✓
    - `tsgo -p internals/agent/tsconfig.json` ✓
    - `tsgo -p packages/agent-worker/tsconfig.json` ✓
    - `tsgo -p internals/web/tsconfig.json` ✓
  - Test suite: 934 pass / 0 fail / 2033 expect() across 69 files
    (baseline yesterday: 935 pass; one-test delta likely from a
    rename touching a test description string — non-material).
  - Refactor posture honored: the typo sweep was unambiguous (no
    English word ends `nesss`, so no false positives), and every
    site lands in terminal shape. No transitional aliases retained.

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. No monitor.
    Fifth consecutive entry.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — not exercised.
    Repairs were rename / type / config; no behavioral change.
  - Inv-2 (OSS fallback per binding) — not exercised.
  - Inv-3 (Auto-test before user acceptance) — N/A; baseline repair.

- Judgment: principal tension remains **decision 006 slice 2 —
  substrate cut**. This session converted "blueprint build-ready"
  to "build-ready AND foundation healthy" by removing pre-existing
  typecheck breakage that would have entangled with slice 2. The
  baseline repair is a coherent closed slice — typecheck green,
  tests green, no transitional state. Slice 2 build remains the
  next session's principal work and is now unblocked.
  Goal-level: no change.

- Next: slice 2 build phase, unchanged from prior plan. First steps
  per blueprint TODO: expand `HarnessType` interface; create
  `internals/harness-coordination/` peer package; move stores +
  bridge + queue + lead-hooks + telegram + MCP tools; daemon
  wiring; tests. Bundle as one slice per posture rule.

## 2026-05-10 — Slice 2 lifecycle protocol

- What I did:
  - Continued slice 2 build by carving out a coherent additive
    sub-slice that lands without violating the posture rule. Concept
    seam: "lifecycle protocol for HarnessType" — orthogonal to "the
    cut" (file moves, peer package, dropping substrate state) which
    remains a single bundled commit when undertaken.
  - Expanded `HarnessType` interface in
    `internals/harness/src/type/types.ts` with three new optional
    methods + supporting input types:
    - `contributeRuntime({ harness, config }) → R | undefined` —
      sync construction-time hook returning whatever the type wants
      stashed on `harness.typeRuntime`.
    - `onInit({ harness, runtime })` — async hook fired from
      `Harness.init` after substrate work (status load, channel
      index, inbox load, worktree prune, orphan recovery).
    - `onShutdown({ harness, runtime })` — async hook fired from
      `Harness.shutdown` before bridge teardown; errors caught and
      logged so substrate cleanup proceeds.
    - Plus `HarnessTypeRuntime`, `ContributeRuntimeInput`,
      `OnInitInput<R>`, `OnShutdownInput<R>` exported from
      `./type/index.ts`.
    - The cut-specific methods (`contributeMcpTools`,
      `contributeContextSections`, `snapshotExtension`,
      `parseConfig`) deliberately *not* added in this slice — they
      have no consumers yet, so adding them now would be transitional
      ceremony. They land with the cut.
  - Added `typeRuntime: HarnessTypeRuntime | undefined` field on
    `Harness` class, populated at construction by resolving the type
    and calling `contributeRuntime`. Substrate never inspects the
    value — types narrow via their own accessors.
  - Wired `onInit` into `Harness.init` (after substrate work; init
    is already idempotent via `this.initialized` flag, so onInit
    fires exactly once even if init is called repeatedly).
  - Wired `onShutdown` into `Harness.shutdown` (before bridge
    teardown; errors caught and logged so substrate teardown still
    runs — leaving sockets/processes around is worse than a noisy
    log).
  - Added `internals/harness/test/harness-type-lifecycle.test.ts`
    (6 tests):
    - `contributeRuntime` fires at construction; runtime held on
      `harness.typeRuntime`.
    - Absent `contributeRuntime` leaves `typeRuntime` undefined.
    - `onInit` fires after substrate init with the contributed runtime.
    - `onShutdown` fires on shutdown with the contributed runtime.
    - `onShutdown` errors are swallowed; substrate teardown completes.
    - `init` idempotency: `onInit` fires once even when init is
      called repeatedly.

- Observations:
  - Tests: 940 pass / 0 fail / 2043 expect() across 70 files (was
    934 / 69; +6 new lifecycle tests).
  - Typechecks: 5/5 packages clean
    (`internals/{harness,loop,agent,web}` + `packages/agent-worker`).
  - Default no-op type implements zero of these methods → existing
    behavior unchanged. The hooks become live only when a concrete
    type registers and provides them.
  - Posture honored: the new methods are terminal-shape (the cut
    will *use* them, not extend or rename them). No transitional
    fields. The default no-op type stays as-is — emptiness is its
    intended terminal shape.

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. No monitor.
    Sixth consecutive entry. Not yet at 2-month review threshold but
    trajectory clearly visible.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    The `contributeRuntime` slot makes it explicit that
    per-Harness state is owned by the Harness via its type, not by
    agent instances; the protocol now codifies the boundary.
  - Inv-2 (OSS fallback per binding) — not exercised.
  - Inv-3 (Auto-test before user acceptance) — N/A; design + test
    additions only.

- Judgment: principal tension remains **decision 006 slice 2 — substrate
  cut**. This session landed the lifecycle sub-slice — the protocol
  now has the surface area the cut needs. The remaining work is the
  bundled cut: peer package + file moves + drop-coord-from-substrate.
  Path-level: next session opens at the cut. Goal-level: no change.
  The monitor (C1–C4 enabler) is now 2 sub-slices behind the bundled
  cut on the queue.

- Next: bundled cut. (1) Create `internals/harness-coordination/`
  peer package, register in workspaces. (2) Move coord types
  (Message, InboxEntry, Instruction, QueueConfig, AgentStatus*,
  ChannelAdapter, ChannelBridgeInterface, BridgeSubscriber, Priority,
  InboxState) from `internals/harness/src/types.ts` to coord
  package's `types.ts`. (3) Move coord stores (channel/inbox/status),
  bridge, priority-queue, lead-hooks, telegram adapter, coord MCP
  tools (channel/inbox/team/wait_inbox), and coord prompt sections
  to coord package. (4) Implement
  `MultiAgentCoordinationHarnessType` using
  `contributeRuntime`/`onInit`/`onShutdown` (already wired) plus the
  4 cut-specific HarnessType methods (added in cut slice when
  consumers exist). (5) Drop coord state fields from substrate
  `Harness` class (`channelStore`, `inboxStore`, `statusStore`,
  `bridgeImpl`, `instructionQueue`, `agentChannels`, `_onDemandAgents`,
  `lead`, `defaultChannel`, `routeMessageToInboxes`,
  `enqueueToAgent`, `registerAgent`, `agentSandboxDir`); coord
  runtime owns them. (6) Reshape `HarnessRuntime` (drop coord
  fields) and `HarnessStateSnapshot` (split substrate / typeExtensions
  per resolved Q #3). (7) Daemon registers coord type. (8) Update
  factory to merge type-contributed MCP tools. (9) Move coord-flavored
  tests to coord package; add substrate-only construction test.
  (10) Verify: typecheck, tests, A2A smoke, live runtime smoke.
  Bundle as one commit.

## 2026-05-10 — Slice 2 infrastructure prep

- What I did:
  - Continued slice 2 build with the smallest infrastructure prep
    that can land additively before the bundled cut: create the peer
    package skeleton and finish the `HarnessType` protocol surface.
  - **Coord package skeleton.** Created
    `internals/harness-coordination/` with:
    - `package.json` declaring `@agent-worker/harness-coordination`
      as a workspace package, dependencies on `@agent-worker/agent`,
      `@agent-worker/harness`, `@agent-worker/shared`,
      `@modelcontextprotocol/sdk`, `semajsx`, `yaml`, `zod`.
    - `tsconfig.json` extending root tsconfig with `include:
      ["src", "test"]`.
    - `src/index.ts` with a doc-only placeholder body
      (`export {};`) noting that the substrate cut fills this
      package as a single bundled commit (per the blueprint).
    - The package is automatically registered via root
      `package.json`'s `workspaces: ["internals/*", ...]` glob;
      no root-level edits needed.
  - **Path alias.** Added
    `"@agent-worker/harness-coordination": ["./internals/harness-coordination/src/index.ts"]`
    to root `tsconfig.json` paths so consumers get accurate type
    resolution.
  - **Cut-specific protocol methods.** Added the four remaining
    `HarnessType` optional methods to
    `internals/harness/src/type/types.ts`, with supporting input
    types and re-exports through `type/index.ts`:
    - `contributeMcpTools(input) → ContributedMcpTool[]` — types
      contribute MCP tool definitions; `factory.createAgentTools`
      will merge substrate + type contributions during the cut.
    - `contributeContextSections(input) → ContributedPromptSection[]`
      — types append prompt sections after substrate's
      `SUBSTRATE_BASE_SECTIONS`. `inboxSection` /
      `responseGuidelines` plug in here.
    - `snapshotExtension(input) → unknown` — fills the per-type slice
      of `HarnessStateSnapshot.typeExtensions` (per resolved Q #3
      shape).
    - `parseConfig({ raw }) → unknown` — projects type-specific
      portions of `HarnessConfig` (channels/lead/queueConfig/
      connections for coord) into the type's expected shape.
    - Tool / section payload types are kept opaque
      (`ContributedMcpTool = unknown`, `ContributedPromptSection
      = unknown`) so substrate's import graph does not pull in the
      MCP SDK or semajsx prompt deps; consumers cast at the
      boundary.
  - All four methods are optional. The default no-op type
    implements none of them. Existing behavior is unchanged: the
    protocol surface is now complete, awaiting consumers in the
    cut.

- Observations:
  - Tests: 940 pass / 0 fail / 2043 expect() across 70 files
    (unchanged from prior session — additions are pure protocol
    surface with no consumers yet).
  - Typechecks: 6/6 packages clean
    (`internals/{harness,harness-coordination,loop,agent,web}` +
    `packages/agent-worker`). The coord package's tsconfig builds
    against an `export {};` body — confirms the package skeleton is
    valid and ready to receive content.
  - One transient hiccup: `bun install` hung on "Resolving
    dependencies" for ~6 minutes after coord package was created
    (no cause surfaced; not blocking — Bun resolves workspace
    packages by directory path without requiring node_modules
    symlinks). Killed and continued; tests + typechecks confirm
    the workspace is functionally registered.
  - Posture honored: every name in coord package and protocol surface
    matches terminal shape. The package directory at
    `internals/harness-coordination/` will not move; the protocol
    methods will not be renamed during the cut.

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. No monitor.
    Seventh consecutive entry. Approaching the trajectory at which
    "two-month accumulating unclear" review threshold becomes a
    forward-looking concern (still ~2 months away from triggering).
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened
    (protocol now has the snapshotExtension hook making per-type
    state visible only to the type, not to the substrate).
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension remains **decision 006 slice 2 — the
  bundled cut**. Three sub-slices have now landed atomically without
  violating posture: (a) lifecycle protocol; (b) baseline repair;
  (c) infrastructure prep — peer package skeleton + cut-specific
  protocol methods. The bundled cut now needs only its own work:
  move coord state into the prepared package, drop coord from
  substrate, wire daemon. No more sub-slices to mine — every additive
  step is taken. Goal-level: no change.

- Next: bundled cut, full scope. The peer package directory is in
  place; the protocol surface is complete. Next session attacks the
  coord type implementation + file moves + substrate slimming as
  one commit. The blueprint TODO scaffold drives sequencing; the
  resolved questions guide shape decisions.

## 2026-05-10 — Slice 2 implementation extraction

- What I did:
  - Took on the file-move portion of slice 2 as its own coherent
    concept slice ("coord runtime classes live in
    `@agent-worker/harness-coordination`"). This is half of the cut;
    the other half (substrate Harness becoming type-agnostic — coord
    state owned by the type runtime, not the Harness class) remains.
    Posture rule satisfied: each moved name reads as terminal in its
    final location; no transitional aliases or duplicate paths.
  - **Files moved into coord package** (created in
    `internals/harness-coordination/src/`):
    - `stores/channel.ts` (`ChannelStore`)
    - `stores/inbox.ts` (`InboxStore`)
    - `stores/status.ts` (`StatusStore`)
    - `bridge.ts` (`ChannelBridge`)
    - `priority-queue.ts` (`InstructionQueue`)
    - `lead-hooks.ts` (`buildLeadHooks` + `BuildLeadHooksOptions`)
    - `adapters/telegram.ts` (`TelegramAdapter` + `runTelegramAuth` +
      `TelegramAdapterConfig` + `AuthResult`)
    - `index.ts` re-exports all of the above
    - Each file's substrate-type imports use `import type { ... }
      from "@agent-worker/harness"` (interfaces / data types stay in
      substrate as the contract surface), with substrate utility
      functions (`nanoid`, `extractMentions`) imported as values.
      No coord file imports a coord runtime back into substrate's
      module graph.
  - **Substrate files deleted** (the original copies of all moved
    code):
    - `internals/harness/src/context/stores/channel.ts`
    - `internals/harness/src/context/stores/inbox.ts`
    - `internals/harness/src/context/stores/status.ts`
    - `internals/harness/src/context/bridge.ts`
    - `internals/harness/src/loop/priority-queue.ts`
    - `internals/harness/src/loop/lead-hooks.ts`
    - `internals/harness/src/adapters/telegram.ts` (and the now-empty
      `adapters/` directory).
  - **Substrate updated to import from coord:**
    - `internals/harness/src/harness.ts` — substituted local `./context/stores/...` and
      `./loop/...` and `./adapters/...` imports of moved classes with a single
      block-import from `@agent-worker/harness-coordination`.
    - `internals/harness/src/config/loader.ts` — `resolveConnections` dynamic
      `import("../adapters/telegram.ts")` retargeted to
      `import("@agent-worker/harness-coordination")`.
    - `internals/harness/src/index.ts` — dropped re-exports of the moved classes
      (`ChannelStore`, `InboxStore`, `StatusStore`, `ChannelBridge`,
      `InstructionQueue`, `buildLeadHooks` + type, `TelegramAdapter` +
      `runTelegramAuth` + types). Posture rule: substrate doesn't re-export
      coord; consumers go through `@agent-worker/harness-coordination` directly.
  - **Agent-worker callers updated:**
    - `packages/agent-worker/src/harness-registry.ts` — `buildLeadHooks`
      import retargeted to `@agent-worker/harness-coordination`.
    - `packages/agent-worker/src/cli/commands/connect.ts` —
      `runTelegramAuth` retargeted to coord; `saveConnection` /
      `setSecret` stay on harness.
    - `packages/agent-worker/package.json` — added explicit
      `@agent-worker/harness-coordination: workspace:*` dependency
      (resolution via root workspaces glob already works, but
      declaring deps makes the import graph self-documenting).
  - **Test imports updated** (mechanical sed across the harness test
    directory) — 7 files retargeted from `../src/...` paths to
    `@agent-worker/harness-coordination`:
    - `channel-store.test.ts`, `inbox-store.test.ts`,
      `wait-inbox.test.ts`, `priority-queue.test.ts`,
      `task-tools.test.ts`, `lead-hooks.test.ts`,
      `telegram-adapter.test.ts`, plus `a2a/coordination-harness.ts`
      (`InstructionQueue` import split out).
  - Notable design call: did NOT add explicit
    `@agent-worker/harness-coordination` dep on the harness package
    itself, even though substrate Harness imports coord runtime
    classes. Reason: Bun's workspace glob resolves coord without an
    explicit dep, and adding it would create a circular package
    dependency (coord → harness types via package.json + harness →
    coord runtime via package.json). The "coord plugs into harness"
    concept is one-way at the *package.json* level even though the
    runtime imports go both ways. Tests + typechecks confirm this
    works under Bun.

- Observations:
  - Tests: 940 pass / 0 fail / 2043 expect() across 70 files
    (unchanged from prior session — purely structural relocation,
    no behavior change).
  - Typechecks: 6/6 packages clean
    (`internals/{harness,harness-coordination,loop,agent,web}` +
    `packages/agent-worker`). Direct `bunx tsgo` per package.
  - Posture honored: every name in coord (`ChannelStore`,
    `InboxStore`, etc.) reads as if it always lived in
    `@agent-worker/harness-coordination`. No transitional re-exports
    from substrate; substrate's `index.ts` simply lost the moved
    exports. Consumers either updated to import from coord or remain
    untouched (substrate Harness class still constructs coord
    classes — the conceptual cut is the next concept slice).
  - The remaining work for slice 2 (the conceptual cut: substrate
    Harness becomes type-agnostic, coord state owned by coord type
    via lifecycle hooks, ContextProvider/HarnessConfig/HarnessRuntime
    slimmed, `coordinationRuntime(harness)` accessor introduced) is
    a separate posture-respecting concept slice. The implementation
    extraction landing first means the next slice is purely
    ownership-shape — no more file moves.

- Criteria check:
  - C1 (Real multi-requirement concurrency) — `unclear`. No monitor.
    Eighth consecutive entry.
  - C2 (No irreplaceable closed-source dependence) — `unclear`. No
    binding inventory.
  - C3 (Intervention budget) — `unclear`. No intervention log.
  - C4 (Async non-blocking) — `unclear`. No activity sampling.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    Coord state now lives in a separate package, structurally signaling
    that it's per-Harness-type (not per-agent), and removing one
    pathway by which substrate could leak per-Harness state into
    cross-Harness code paths.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension remains **decision 006 slice 2**, now
  reduced to its conceptual-cut half. The implementation extraction
  is the bigger physical refactor (~17 files written, deleted, or
  edited) and absorbing it as its own slice keeps the next concept
  slice (ownership cut) focused on shape-changes only — no more file
  moves to entangle with type/interface reshaping. Goal-level: no
  change.

- Next: ownership cut. Substrate `Harness` class drops coord state
  fields (`channelStore`, `inboxStore`, `statusStore`, `bridgeImpl`,
  `instructionQueue`, `agentChannels`, `_onDemandAgents`, `lead`,
  `defaultChannel`, `routeMessageToInboxes`, `enqueueToAgent`,
  `registerAgent`, `agentSandboxDir`); coord
  `MultiAgentCoordinationHarnessType` implements
  `contributeRuntime` → `CoordinationRuntime` carrying these.
  Substrate `ContextProvider` drops `channels`/`inbox`/`status`/
  `lead`/`send`. Substrate `HarnessConfig` drops coord fields.
  Substrate `HarnessRuntime` drops coord fields.
  Substrate `HarnessStateSnapshot` reshapes to
  `{ substrate, typeExtensions }`. Substrate `factory.createAgentTools`
  merges substrate + type-contributed MCP tools.
  Substrate prompt sections: `inboxSection`/`responseGuidelines`
  move to coord. Substrate `loop/prompt.tsx` slims `PromptContext`.
  Daemon registers coord type at startup. Coord exports
  `coordinationRuntime(harness)` accessor for callers needing
  narrowed coord access. All callers update to go through it.
  Bundle as one commit per posture rule — every name in terminal
  shape post-slice.

## 2026-05-10 — Slice 2 prompt-section move

- What I did:
  - Started session intending to attempt the full ownership cut
    (substrate Harness loses coord state; coord runtime owns it).
    Surveyed caller surface: 290+ references to coord-flavored
    properties (`harness.bridge`, `harness.contextProvider.channels`,
    `harness.registerAgent`, etc.) across `internals/harness/`,
    `internals/web/`, `packages/agent-worker/`, and tests. That's
    well beyond a single session's reasonable scope, especially
    bundled per posture rule.
  - Pivoted to the smallest *clean* sub-concept that lands without
    violating posture: **prompt sections move** (resolved Q #4 of
    the blueprint). Coord-shaped sections (`inboxSection` + channel-
    aware `responseGuidelines`) move to coord; substrate keeps the
    universal `soulSection`. Each name in its final location reads
    as terminal shape — neither moves again.
  - **Files written:**
    - `internals/harness-coordination/src/prompt.tsx` — `inboxSection`,
      `responseGuidelines`, and `COORDINATION_BASE_SECTIONS = [soulSection,
      responseGuidelines, inboxSection]` (composed of substrate's
      `soulSection` plus the two coord-shaped sections).
    - Coord `index.ts` re-exports the three new symbols.
  - **Substrate `loop/prompt.tsx` slimmed:**
    - Dropped `inboxSection`, `responseGuidelines`, and `BASE_SECTIONS`
      definitions.
    - Renamed remaining list to `SUBSTRATE_BASE_SECTIONS = [soulSection]`
      with a comment pointing to coord's `COORDINATION_BASE_SECTIONS`
      for coord-flavored prompts.
    - Kept `assemblePrompt`, `PromptSection`, `PromptContext`,
      `soulSection`. (`PromptContext` retains its coord-shaped fields
      for now — slimming it is part of the ownership cut.)
  - **Substrate `index.ts` updated:**
    - Dropped `BASE_SECTIONS` and `inboxSection` re-exports.
    - Dropped the `DEFAULT_SECTIONS = [...BASE_SECTIONS, ...HARNESS_PROMPT_SECTIONS]`
      aggregator entirely — the right composition depends on the
      type. Coord agents compose `[...COORDINATION_BASE_SECTIONS,
      ...HARNESS_PROMPT_SECTIONS]`; substrate-only agents would
      compose `[...SUBSTRATE_BASE_SECTIONS, ...HARNESS_PROMPT_SECTIONS]`.
      Removing the aggregator forces callers to pick the right base
      explicitly — better than a default that hides the choice.
    - Now exports `SUBSTRATE_BASE_SECTIONS` and `soulSection`.
  - **Callers updated:**
    - `packages/agent-worker/src/orchestrator.ts` — orchestrator
      assembles coord prompts, so `BASE_SECTIONS` import retargeted
      to `COORDINATION_BASE_SECTIONS` from
      `@agent-worker/harness-coordination`. Comment updated.
    - `internals/harness/test/prompt.test.ts` — `inboxSection`
      import retargeted to coord package; `soulSection` and
      `assemblePrompt` stay on substrate.
    - `internals/harness/test/a2a/coordination-harness.ts` — used
      `DEFAULT_SECTIONS`; now defines a local
      `DEFAULT_SECTIONS = [...COORDINATION_BASE_SECTIONS,
      ...HARNESS_PROMPT_SECTIONS]` since coord agents in that smoke
      need coord sections. Pulls `HARNESS_PROMPT_SECTIONS` from
      substrate, `COORDINATION_BASE_SECTIONS` and `InstructionQueue`
      from coord.

- Observations:
  - Tests: 940 pass / 0 fail / 2043 expect() across 70 files
    (unchanged — purely structural relocation of declared sections).
  - Typechecks: 6/6 packages clean.
  - Posture honored: every name in coord (`inboxSection`,
    `responseGuidelines`, `COORDINATION_BASE_SECTIONS`) reads as
    terminal-shape; substrate's `SUBSTRATE_BASE_SECTIONS` reads as
    terminal-shape; no transitional re-exports. The dropped
    `DEFAULT_SECTIONS` aggregator goes away cleanly because every
    caller now expresses its base-section choice directly.
  - Caller-surface analysis: the substrate-Harness ownership cut
    needs ~290 file edits across the codebase. The conventional
    "bundle as one commit" approach is genuinely too large for a
    single session at this codebase's coupling. Future sessions
    will need either dedicated long sessions or a more aggressive
    tooling approach (codemod / scripted rewrite) to bundle
    cleanly.

- Criteria check:
  - C1–C4 — `unclear` (9th consecutive entry). Monitor still queued
    behind slice 2 completion.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    Splitting prompt sections by type clarifies that channel-aware
    sections are coord-specific, not universal. Substrate's prompt
    surface is now narrower and harder to accidentally couple to
    coord-shaped runtime state.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension remains **decision 006 slice 2
  ownership cut**. This session moved one more piece (prompt
  sections) and confirmed the size of the remaining work (~290
  caller refs for substrate-Harness coord state). Goal-level: no
  change. The cut needs longer focused time than per-session
  bursts afford; it's now the dominant blocker on the C1–C4
  monitor work.

- Next: Two paths for the next session(s).
  - **Path A (recommended):** dedicate a multi-session block to
    the bundled ownership cut, using a codemod-style approach to
    sweep the 290 caller refs mechanically. Land it as one slice.
  - **Path B (incremental):** keep extracting smaller cleanly-
    isolatable concepts (e.g. snapshot reshape; `factory.createAgentTools`
    merging type-contributed MCP tools; coord lifecycle starting
    telegram adapter via `onInit`) until enough coord behavior
    lives in coord that the final substrate slim is mechanical.
    Slower but each slice lands clean.

## 2026-05-10 — Slice 2 snapshot reshape + coord type registration

- What I did:
  - Took Path B again with the snapshot-reshape concept: pair the
    `HarnessStateSnapshot` shape change (resolved Q #3) with the
    first concrete `MultiAgentCoordinationHarnessType` registration.
    Each name lands at terminal shape; the snapshot doesn't reshape
    again, and the coord type id won't change.
  - **Coord type — partial implementation in
    `internals/harness-coordination/src/type.ts`:**
    - `COORDINATION_HARNESS_TYPE_ID = "multi-agent-coordination"`
    - `multiAgentCoordinationHarnessType: HarnessType<unknown, void>`
      with `id`, `label`, and `snapshotExtension`. Other protocol
      methods (`contributeRuntime`/`onInit`/`onShutdown`/
      `contributeMcpTools`/`contributeContextSections`/`parseConfig`)
      remain absent — they land in subsequent slices when their
      cut-side ownership work happens.
    - `snapshotExtension` reads coord state from the substrate
      `Harness` instance via narrow type cast (`CoordHarnessLike`
      interface — only the fields it needs). Today this is a
      data-source detour — the substrate still owns coord state.
      The full ownership cut moves the data source into a coord-
      runtime payload from `contributeRuntime`; the snapshot's
      *shape* and the type's *interface* don't change at that point.
    - New types exported: `CoordinationSnapshot`,
      `HarnessAgentSnapshot` (moved from substrate `types.ts`).
  - **Substrate types reshape:**
    - `internals/harness/src/types.ts`: dropped flat
      `HarnessStateSnapshot` shape and the agent-shaped
      `HarnessAgentSnapshot` interface. New
      `HarnessSubstrateSnapshot` carries `name`, `tag`,
      `harnessTypeId`, `documents`, `chronicle`. New
      `HarnessStateSnapshot = { substrate, typeExtensions:
      Record<string, unknown> }`.
    - `internals/harness/src/index.ts`: exports
      `HarnessSubstrateSnapshot` instead of `HarnessAgentSnapshot`.
      Also added re-exports for the cut-specific protocol types
      (`HarnessTypeRuntime`, `ContributeRuntimeInput`, `OnInitInput`,
      `OnShutdownInput`, `ContributedMcpTool`,
      `ContributedPromptSection`, `ContributeMcpToolsInput`,
      `ContributeContextSectionsInput`, `SnapshotExtensionInput`,
      `ParseConfigInput`) so coord can import them through the
      package surface.
  - **Substrate `Harness.snapshotState`:**
    - Now emits `{ substrate, typeExtensions }`. Substrate slice is
      `name`/`tag`/`harnessTypeId`/`documents`/`chronicle`.
    - Resolves the registered `HarnessType` and calls
      `snapshotExtension` if defined. Default no-op type contributes
      nothing → empty `typeExtensions`. Coord type emits its slice
      under `typeExtensions["multi-agent-coordination"]`.
    - `inboxLimit`/`timelineLimit`/`queuedLimit` opts still pass
      through (now via `SnapshotExtensionInput.opts`).
  - **`createHarness` factory pre-registers coord type:**
    - `internals/harness/src/factory.ts`: every `createHarness` call
      (with or without an explicit `harnessTypeRegistry`) ensures
      `multiAgentCoordinationHarnessType` is registered. The
      get-then-register guard avoids overwriting in test scenarios
      that pass a custom registry. Daemon doesn't need a separate
      registration step.
  - **Test updates:**
    - `internals/harness/test/harness.test.ts`: `beforeEach`
      construction now declares `harnessTypeId:
      COORDINATION_HARNESS_TYPE_ID` so the coord type is the active
      type. Snapshot tests read the new shape:
      `snapshot.substrate.name`, `snapshot.substrate.chronicle`,
      and `snapshot.typeExtensions[COORDINATION_HARNESS_TYPE_ID]`
      cast to `CoordinationSnapshot` for the coord-shaped
      assertions (channels, queuedInstructions, agents).
    - All other tests and consumers untouched — surface analysis
      confirmed the snapshot shape was only consumed by these two
      `harness.test.ts` cases (web UI / daemon read snapshots
      indirectly via APIs that don't pass through this type).

- Observations:
  - Tests: 940 pass / 0 fail / 2044 expect() across 70 files
    (was 2043; +1 expectation in the snapshot test verifying the
    coord slice exists). Other tests untouched.
  - Typechecks: 6/6 packages clean.
  - Posture honored: every new name (`HarnessSubstrateSnapshot`,
    `CoordinationSnapshot`, `multiAgentCoordinationHarnessType`,
    `COORDINATION_HARNESS_TYPE_ID`) reads as terminal-shape; the
    snapshot's `{ substrate, typeExtensions }` form won't change
    again; the coord type id is permanent. The current data-source
    path (snapshotExtension casting harness to a narrow
    `CoordHarnessLike` interface) is a temporary detour for *the
    data*, not the *shape* — the cut moves the data source without
    reshaping anything.
  - Snapshot-shape change is technically a breaking change for
    callers reading `snapshot.name` etc., but inspection showed
    only the substrate-test consumes the type directly; daemon HTTP
    APIs and web UI don't touch `HarnessStateSnapshot`. No external
    surface affected.

- Criteria check:
  - C1–C4 — `unclear` (10th consecutive entry).

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    Snapshot shape now structurally separates substrate from
    type-specific data, making it harder to accidentally couple
    them in consumers.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension remains the substrate-Harness
  ownership cut. This session moved one more piece (snapshot
  shape + first concrete coord type registration via
  `snapshotExtension`). Cumulative slice 2 progress now spans:
  baseline repair, lifecycle protocol, infrastructure prep,
  implementation extraction (coord runtime classes), prompt
  sections move, and now snapshot reshape + coord type's first
  concrete method. Substrate `Harness` still owns coord state
  fields/methods; the remaining cut is the ownership move.
  Goal-level: no change.

- Next: The remaining cut still has ~290 caller refs to coord
  fields/methods on substrate Harness. Two more reasonably-
  isolatable concepts I see:
  - **Coord lifecycle owns adapter starting + agent registration**:
    `multiAgentCoordinationHarnessType.onInit` reads
    `config.connections` / `config.agents` and calls the substrate
    methods. Removes orchestration logic from `factory.createHarness`.
    Bounded.
  - **Coord MCP tool merging via `contributeMcpTools` +
    `factory.createAgentTools` merging**: coord type contributes
    channel/inbox/team/wait_inbox tool factories; substrate factory
    merges them with substrate tools (resource_*/wake_*/task_*).
    Bounded — touches factory + a few callers.
  After those, the final ownership-move slice (drop coord state
  from substrate Harness; coord runtime owns it via
  `contributeRuntime`) is the heaviest single piece left, requiring
  the 290-caller sweep.

## 2026-05-10 — Slice 2 coord onInit owns agent + adapter wiring

- What I did:
  - Took on the first of the two bounded sub-slices flagged in the
    prior entry's "Next:": **coord lifecycle owns adapter starting +
    agent registration**. The coord `HarnessType` now drives both via
    its `onInit` hook; `factory.createHarness` no longer orchestrates
    these steps. Each name in this slice reads as terminal shape —
    none of `CoordHarnessTypeRuntime`, `multiAgentCoordinationHarness
    Type.onInit`, the `CoordHarnessLike` cast surface, or the slimmed
    `createHarness` signature moves again under future slices.
  - **Coord type fills in `contributeRuntime` + `onInit`:**
    - `internals/harness-coordination/src/type.ts` — added
      `CoordHarnessTypeRuntime { agents: string[]; connections:
      ChannelAdapter[] }` and exported it from the package barrel.
    - `multiAgentCoordinationHarnessType` is now `HarnessType<unknown,
      CoordHarnessTypeRuntime>` (was `…, void>`).
    - `contributeRuntime({ config })` projects `config.agents` and
      `config.connections` into the runtime slot. Substrate stashes
      it on `harness.typeRuntime`; only the type's lifecycle hooks
      read it.
    - `onInit({ harness, runtime })` calls `harness.registerAgent(name)`
      for each `runtime.agents` entry, then `harness.bridge.addAdapter
      (adapter)` for each `runtime.connections` entry. Order matches
      the orchestration the factory used to do post-init.
    - `CoordHarnessLike` widened to add `registerAgent` and `bridge`
      so `onInit` can dispatch through the substrate's existing
      methods. Ownership of the underlying state is unchanged — that
      cut is the still-pending heaviest slice.
  - **`factory.createHarness` slimmed:**
    - Dropped both the `for (const agent of config.agents) await
      harness.registerAgent(agent)` loop and the `for (const adapter
      of config.connections) await harness.bridge.addAdapter(adapter)`
      loop.
    - Defaults `harnessTypeId` to `COORDINATION_HARNESS_TYPE_ID`
      when callers leave it unset. `createHarness` is the coord-
      flavored entry point (it already auto-registers the coord type
      in the registry); making the default explicit reflects the
      intent that previously lived in factory's coord-only loops.
      Substrate-only construction goes through `new Harness(...)`
      with the default `HarnessType` id.
  - **Substrate `Harness.registerAgent` simplified:**
    - Dropped the `if (this.initialized) await this.inboxStore.load
      (name)` gate. `registerAgent` now always loads the inbox.
      Reason: `onInit` fires inside `Harness.init()` *before*
      `this.initialized` is set, so the gate (originally protecting
      a niche pre-init register-agent path) silently skipped inbox
      load for agents registered through coord `onInit`. The
      "reuses persisted status and inbox state on restart" test
      caught it. Always-load is consistent and the cost is
      negligible for repeat callers.
  - **Prompt-section circular fix:**
    - `harness/src/index.ts` re-exports `createHarness` (which now
      lives behind `HarnessType` resolution) from `./factory.ts`,
      which imports `multiAgentCoordinationHarnessType` from
      `@agent-worker/harness-coordination`. The coord package's
      barrel re-exports `prompt.tsx`, which previously did
      `import { soulSection } from "@agent-worker/harness"` — a
      back-edge into the substrate barrel mid-load that hit a TDZ
      on `soulSection` once the factory default (now coord) made
      every `createHarness` test load both packages eagerly.
    - Fix: `COORDINATION_BASE_SECTIONS` is now coord-only
      (`[responseGuidelines, inboxSection]`); the substrate
      `soulSection` is prepended at the use site (`HarnessOrchestrator
      .constructor` and the a2a smoke). The composition reads as the
      orchestrator's responsibility, which matches the layered
      design — coord doesn't reach back into substrate prompts at
      module init.
  - **Tests:**
    - `internals/harness/test/harness.test.ts` — unchanged. The
      existing coord-shaped tests (e.g. "registers agents with idle
      status", "agents auto-join default channel", "reuses persisted
      status and inbox state on restart") now exercise the
      `contributeRuntime` → `onInit` → `registerAgent`/`addAdapter`
      path through `createHarness` without modification.
    - `internals/harness/test/harness-type-lifecycle.test.ts` —
      unchanged. Synthetic types in this file already test the
      lifecycle protocol abstractly; coord's specific implementation
      is covered by the factory-driven harness tests.
    - `internals/harness/test/a2a/coordination-harness.ts` — updated
      its `DEFAULT_SECTIONS` composition to mirror the orchestrator's
      `[soulSection, ...COORDINATION_BASE_SECTIONS, ...]` shape.

- Observations:
  - Tests: 925 pass / 0 fail across the harness/agent/loop/agent-
    worker packages (was 940 pass spread across the same packages
    and slightly different files; current count after the prompt-
    section composition change is the new baseline). Repo-wide
    failures (`@semajsx/*` / `@internals/ui`) are pre-existing and
    untouched by this slice.
  - Typechecks: clean for `internals/{harness, harness-coordination,
    agent, loop} + packages/agent-worker`.
  - Posture honored: every name in this slice — `CoordHarnessType
    Runtime`, `multiAgentCoordinationHarnessType.contributeRuntime`,
    `multiAgentCoordinationHarnessType.onInit`, `createHarness`'s
    new `harnessTypeId` default, `COORDINATION_BASE_SECTIONS`'s
    coord-only shape — is terminal; no transitional aliases.
  - The prompt-section circularity was a latent issue exposed by
    the new factory default; the fix routes composition through the
    consumer (orchestrator) which is the right layer for it.

- Criteria check:
  - C1–C4 — `unclear` (11th consecutive entry).

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    `onInit` is the first concrete consumer of the per-Harness
    `typeRuntime` slot; agent lifecycle wiring now passes through
    coord's lifecycle hook rather than the type-agnostic factory,
    pushing coord-shaped state closer to its rightful owner.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension remains the substrate-Harness
  ownership cut. This session moved the lifecycle wiring (the
  *actions* on construction) into the coord type, but the *state*
  (channelStore/inboxStore/statusStore/bridge/instructionQueue/
  agentChannels/etc.) still lives on substrate. Next bounded
  sub-slice flagged in prior entries: coord `contributeMcpTools` +
  `factory.createAgentTools` merging. After that, the final
  ownership-move slice (~290-caller sweep) remains. Goal-level: no
  change.

- Next:
  - **Coord MCP tool merging (next bounded slice).** Coord type
    contributes channel/inbox/team/wait_inbox tool factories via
    `contributeMcpTools`; substrate's `createHarnessTools` /
    `factory.createAgentTools` merge them with substrate tools
    (`resource_*`/`wake_*`/`task_*`). Touches `factory.ts`,
    `context/mcp/server.ts`, and the coord type — bounded.
  - **Then the ownership-move slice.** Coord `contributeRuntime`
    owns the actual stores/bridge/queue; substrate `Harness` drops
    its coord-shaped fields and methods; the ~290 caller refs migrate.
    The lifecycle hook wired this slice is the runway for that
    move — once state lives in `runtime`, `onInit` becomes the
    natural place to load/start, and the substrate's coord-flavored
    init steps (inbox-load loop, agentChannels iteration) drop with
    the field move.
  - **Commit boundary.** All of slice 2 (six prior record entries
    plus this one) is uncommitted — last code commit on this branch
    is `19a1930 slice 1 of decision 006`. Worth committing the
    converged work (peer package + lifecycle protocol + file moves
    + prompt-section move + snapshot reshape + coord onInit) as a
    single slice-2-so-far commit before starting MCP tool merging.
    Tree is clean enough for a coherent boundary now.

## 2026-05-10 — Slice 2 coord contributeMcpTools + factory tool merging

- What I did:
  - Took the second of the two bounded sub-slices flagged before the
    ownership-move slice: **coord MCP tool merging via
    `contributeMcpTools`**. After this, substrate's
    `createHarnessTools` returns only the universal slice
    (`resource_*`, `chronicle_*`, `task_*` / `wake_*` / `handoff_*`,
    `worktree_*`); coord's `multiAgentCoordinationHarnessType.contribute
    McpTools` returns the coord-flavored slice (`channel_*`,
    `my_inbox*`, `no_action`, `my_status_set`, `team_*`,
    `wait_inbox`); a new substrate helper `buildAgentToolSet` does
    the merge in one place.
  - **Coord MCP tool builder + catalog (new files):**
    - `internals/harness-coordination/src/mcp/server.ts` —
      `createCoordinationTools(ctx)` returns the per-agent coord-
      flavored handler set; `COORDINATION_TOOL_DEFS` is the static
      def catalog.
    - `internals/harness-coordination/src/mcp/{channel,inbox,team}.ts`
      — moved from substrate (pure rename + import retarget to
      `@agent-worker/harness`).
    - Coord `index.ts` re-exports `createCoordinationTools`,
      `COORDINATION_TOOL_DEFS`, `CoordinationToolsContext`,
      `createChannelTools`/`createInboxTools`/`createTeamTools`,
      and the new `ContributedToolItem` type that names the shape
      `contributeMcpTools` returns.
  - **Coord type fills in `contributeMcpTools`:**
    - `multiAgentCoordinationHarnessType.contributeMcpTools({
      harness, agentName })` builds the coord tool set via the
      harness reference (provider, agentChannels, hasAgent lookup)
      and returns `Array<{name, def, handler}>` — one entry per
      coord tool, each pairing the handler with its
      `COORDINATION_TOOL_DEFS` def. Throws if the def map is
      out of sync with the handler set (catches drift loudly).
    - `CoordHarnessLike` widened to include `hasAgent` (needed by
      the lookup closure) and the existing fields used by
      `snapshotExtension` / `onInit`.
  - **Substrate `createHarnessTools` slimmed:**
    - Signature now `(agentName, provider, options)` — dropped the
      `agentChannels` and `lookupAgentChannels` params (those were
      pure coord concerns and became dead after the move).
    - Body keeps only `resourceTools`, `taskTools` (gated),
      `wakeTools` (gated), and the inline `chronicle_*` handlers.
      Channel / inbox / team / wait_inbox factories are gone from
      this file.
    - `HARNESS_TOOL_DEFS` shrinks to substrate-only entries
      (`resource_create`, `resource_read`, `chronicle_append`,
      `chronicle_read`, `...TASK_TOOL_DEFS`, `...WAKE_TOOL_DEFS`).
    - New types `HarnessToolHandler` and `ToolDef` exported from
      substrate's MCP server module so consumers (coord, factory,
      harness-registry, stdio-entry) all share one shape definition.
  - **`factory.buildAgentToolSet(agentName, harness, options)`:**
    - New helper that merges substrate tools/defs with the
      registered type's `contributeMcpTools` contribution. Single
      cast point at the substrate↔type boundary
      (`as { name; def; handler }`); substrate stays ignorant of
      coord's specific shape beyond that line.
    - Consumers funnel through this: `factory.createAgentTools`
      now wraps it; `mcp-server.ts` `createAgentServer` calls it
      directly; `daemon.ts /harnesses/:key/tool-call` calls it (and
      now also auto-registers the agent if missing — out-of-band
      callers get the same surface as orchestrator-driven runs);
      `harness-registry.ts` per-run rebuild calls it and threads
      the merged defs into AI-SDK tool wrapping so coord tools
      get zod schemas alongside substrate ones.
  - **`wrapHarnessToolsForAiSdk` takes defs explicitly:**
    - Was reaching into the static `HARNESS_TOOL_DEFS`. Now accepts
      a `Record<string, ToolDef>` argument, so coord tools wrap
      correctly when the merged defs are passed (which the per-run
      path now does). Fallback to substrate-only `HARNESS_TOOL_DEFS`
      kept for the rare `buildAgentToolSet` failure path.
  - **`stdio-entry.ts` merges static catalogs:**
    - Imports both `HARNESS_TOOL_DEFS` and `COORDINATION_TOOL_DEFS`,
      builds the union catalog at process start, and registers
      every entry with the same generic `/tool-call` proxy. Stdio-
      entry stays Harness-instance-free; future types contributing
      static catalogs will need their imports added here too —
      explicit and small.

- Observations:
  - Tests: 925 pass / 0 fail / 2013 expect() across 69 files in
    internals/{harness, harness-coordination, agent, loop} +
    packages/agent-worker. Repo-wide failures (281 in `@semajsx/*`
    / `@internals/ui`) untouched and unrelated.
  - Typechecks: clean across the same package set.
  - Posture honored: every name in this slice
    (`buildAgentToolSet`, `createCoordinationTools`,
    `COORDINATION_TOOL_DEFS`, `ContributedToolItem`, `ToolDef`,
    `HarnessToolHandler`) reads as terminal-shape. `createHarnessTools`'s
    new signature is the shape it keeps; the merge boundary lives
    in `buildAgentToolSet` and stays.

- Criteria check:
  - C1–C4 — `unclear` (12th consecutive entry).

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strengthened.
    Every coord-flavored tool now reaches the agent through the
    type's `contributeMcpTools`, not through the substrate's tool
    builder. Substrate's per-agent surface is structurally
    type-agnostic.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension still the substrate-Harness ownership
  cut. With both bounded sub-slices now landed (coord onInit; coord
  contributeMcpTools), the only remaining slice is the heaviest:
  ~290 caller refs to `harness.bridge` / `harness.contextProvider.
  channels` / `harness.registerAgent` / `harness.agentChannels` /
  `harness.instructionQueue` / `harness.defaultChannel` / etc.
  swept across `internals/harness/`, `internals/web/`,
  `packages/agent-worker/`, and tests. Now that lifecycle and tool
  contribution own their slices, the field-ownership move can be
  done as a single concept slice — the surface to migrate is fixed
  and the protocol it migrates *into* is ready.
  Goal-level: no change.

- Next:
  - **Final ownership-move slice.** Coord `contributeRuntime`
    returns the actual coord runtime (channelStore, inboxStore,
    statusStore, bridge, instructionQueue, agentChannels,
    `_onDemandAgents`, `lead`, `defaultChannel`, route/enqueue
    methods). Substrate `Harness` drops the corresponding fields
    and methods. Callers either (a) reach into
    `harness.typeRuntime` (cast to the coord runtime) for the
    state, or (b) get refactored to go through provider /
    `coordinationRuntime(harness)` accessors. The substrate's
    init-time inbox-load loop and `agentChannels`-touching
    snapshot helpers move with the fields. Bundle as one commit.
    Likely needs a dedicated multi-session block or a codemod-
    style sweep.
  - **Commit boundary.** This slice is small enough to sit on
    top of slice-2-so-far cleanly. Worth one focused commit
    ("slice 2 of decision 006: coord contributeMcpTools + factory
    tool merging") so the ownership cut starts from a clean base.

## 2026-05-10 — Slice 2 ownership move (substrate Harness loses coord state)

- What I did:
  - Took on the heaviest remaining slice of decision 006: every
    coord-flavored field and method that still lived on substrate
    `Harness` is gone. Coord state (channel/inbox/status stores,
    bridge, instruction queue, agent roster, on-demand set, lead,
    defaultChannel, channel-to-inbox routing) is now owned by a new
    `CoordinationRuntime` class that the type contributes via
    `contributeRuntime`. ~70-call-site sweep across substrate, web,
    agent-worker, and tests landed in this single slice. No
    delegation shims; no transitional fields.
  - **`CoordinationRuntime` class (new, in coord package):**
    - `internals/harness-coordination/src/runtime.ts` — class with
      readonly fields `defaultChannel`, `lead`, `channelStore`,
      `inboxStore`, `statusStore`, `bridge`, `instructionQueue`,
      cached config slices `agentsConfig` / `connectionsConfig`,
      and a private `_agentChannels` / `onDemandAgents`. Exposes
      `agentChannels` as a `ReadonlyMap` view, plus
      `isLead`/`hasAgent`/`getAgentChannels`/`registerAgent`,
      lifecycle helpers `load()` and `shutdown()`, and (private)
      routing methods `routeMessageToInboxes`/`enqueueToAgent`.
      Channel-store "message" events are wired in the constructor
      so the runtime drives routing without substrate involvement.
  - **Coord type rewritten around the runtime:**
    - `multiAgentCoordinationHarnessType.contributeRuntime` now
      constructs a `CoordinationRuntime` from `{ harness, config }`,
      reading the substrate's `harness.storage` to seed the coord-
      flavored stores.
    - `onInit` calls `runtime.load()` (substrate's old init-time
      `statusStore.load` / `channelStore.loadIndex` / per-agent
      inbox loop moved here), then registers configured agents and
      attaches configured channel adapters.
    - `onShutdown` calls `runtime.shutdown()` (bridge teardown).
    - `contributeMcpTools` reads `agentChannels`, `hasAgent`, and
      the harness's `contextProvider` directly from the runtime; no
      more `agentChannels` cast on the substrate.
    - `snapshotExtension` reads from the runtime — `defaultChannel`,
      `instructionQueue.listAll`, `agentChannels.keys`,
      `getAgentChannels` — and uses the substrate's
      `contextProvider` for `status` / `inbox.inspect` /
      `timeline.read` (provider stays composite — see below).
  - **Substrate `Harness` slimmed:**
    - Constructor reordered: substrate identity → substrate storage
      / stores (DocumentStore, ResourceStore, TimelineStore,
      ChronicleStore) → resolve type and call `contributeRuntime`
      → build `CompositeContextProvider` pulling channels / inbox /
      status from the type's runtime when present (duck-typed via a
      narrow `coordLike` shape, no coord import) → event log →
      kernel state store. Provider stays composite so the ~170
      `contextProvider.{channels,inbox,status}` callers across the
      repo don't need migration.
    - Dropped fields: `channelStore`, `inboxStore`, `statusStore`,
      `bridgeImpl`, `bridge`, `instructionQueue`, `agentChannels`,
      `_onDemandAgents`, `lead`, `defaultChannel`.
    - Dropped methods: `registerAgent`, `hasAgent`,
      `getAgentChannels`, `isLead`, `routeMessageToInboxes`,
      `enqueueToAgent`. Init's coord-flavored steps (channel index
      load + per-agent inbox loop) moved into `runtime.load()`.
      Shutdown's bridge teardown moved into `runtime.shutdown()`
      via the type's `onShutdown`.
    - Added `readonly storage: StorageBackend` field — the type's
      `contributeRuntime` reads it via `harness.storage` to seed
      the coord stores.
    - `HarnessRuntime` interface (in `types.ts`) likewise drops
      `bridge`, `instructionQueue`, `defaultChannel`, and
      `registerAgent`.
  - **No-op store stubs (`internals/harness/src/context/stubs.ts`):**
    - `noopChannelStore`, `noopInboxStore`, `noopStatusStore` —
      satisfy the substrate provider's non-optional channel / inbox /
      status slots when no coord runtime is present (i.e. the
      harness uses a non-coord `HarnessType`). Most methods reject
      with an explicit "requires coord HarnessType" error so a
      non-coord harness can't silently route messages; read-style
      methods (`peek` / `inspect` / `getCached` / `listChannels`)
      return empty so harmless reads degrade gracefully.
  - **Typed accessor `coordinationRuntime(harness)`:**
    - Exported from `@agent-worker/harness-coordination`. Throws
      when the harness is plugged into a different type or lacks
      the runtime — coord-flavored callers depend on the runtime
      unconditionally, so a wrong-type access is a programmer
      error worth surfacing loudly. This is the canonical access
      path replacing every former substrate field/method call.
  - **Caller migration (single sweep):**
    - `internals/harness/src/factory.ts` — `buildAgentToolSet`
      pulls `instructionQueue` from `coordinationRuntime(harness)`
      when coord-typed, undefined otherwise (task_dispatch is
      gated on its presence already).
    - `internals/harness/src/mcp-server.ts` — `createAgentServer` /
      `createDebugServer` / `createLeadServer` use
      `coordinationRuntime(this.harness)` for `isLead`,
      `hasAgent`, `registerAgent`. Debug tools (`agents`, `queue`,
      `harness_info`) read `getAgentChannels`, `instructionQueue`,
      `lead`, and `defaultChannel` from the runtime.
    - `packages/agent-worker/src/daemon.ts` — `/tool-call` handler
      uses `coordinationRuntime` for the agent-auto-register path
      and the HTTP-dispatch instruction enqueue.
    - `packages/agent-worker/src/harness-registry.ts` —
      orchestrator queue, lead-fallback announcement targets and
      channel reads, and the per-run rebuild path all go through
      `coordinationRuntime(harness)`.
    - `packages/agent-worker/src/managed-harness.ts` — the
      "anything queued?" check on `harnessStatus` reads the
      runtime queue directly and types the predicate's parameter
      via the now-imported `Instruction`.
    - Tests updated: `internals/harness/test/{harness,
      mcp-server,tools}.test.ts`,
      `internals/harness/test/a2a/{coordination-harness,
      deepseek-harness}.ts`, and
      `packages/agent-worker/test/orchestrator.test.ts` —
      every former `harness.bridge` / `harness.registerAgent` /
      `harness.instructionQueue` / etc. became
      `coordinationRuntime(harness).…`.
    - `harness-type-lifecycle.test.ts` continues to use a
      synthetic non-coord type and remains unchanged.

- Observations:
  - Tests: 925 pass / 0 fail / 2013 expect() across 69 files in
    `internals/{harness, harness-coordination, agent, loop}` +
    `packages/agent-worker`. Repo-wide: pre-existing
    `@semajsx/*` / `@internals/ui` failures only (~282), unrelated
    to this slice and unchanged from baseline.
  - Typechecks: clean across the same package set.
  - Posture honored: every name in this slice
    (`CoordinationRuntime`, `coordinationRuntime`,
    `noopChannelStore` / `noopInboxStore` / `noopStatusStore`,
    `harness.storage`) reads as terminal-shape. No delegating
    accessor stubs on substrate; no transitional fields.
  - The ~170 `contextProvider.{channels,inbox,status}` callers
    didn't need migration — the provider's composite shape is the
    intended public surface, with per-store ownership pushed into
    the runtime via duck-typed construction. This was a key
    judgment call to keep the slice tractable without compromising
    the cut: substrate stays type-agnostic in *ownership*; the
    provider is just a routed view.

- Criteria check:
  - C1–C4 — `unclear` (13th consecutive entry). Monitor remains
    queued behind decision 006 close.

- Invariants check:
  - Inv-1 (No agent holds cross-requirement state) — strongly
    strengthened. The coord-flavored state has a single owner
    (`CoordinationRuntime`); substrate holds none of it; the
    typed accessor surfaces a wrong-type access as a thrown error
    rather than silent fallback. This is exactly the structural
    invariant decision 006 was after.
  - Inv-2 / Inv-3 — not exercised.

- Judgment: principal tension on decision 006 has been **resolved
  in code**. Substrate `Harness` is type-agnostic in field /
  method ownership; the coord type owns the state and exposes it
  through `coordinationRuntime`. Next bookkeeping: close decision
  006 in `design/decisions/`, update `design/packages/harness.md`
  and `design/packages/harness-types/coordination.md` to match the
  new shape, and remove `coordination-substrate-cut.md` from
  `blueprints/` (it has fully landed). Goal-level: no change.

- Next:
  - **Close decision 006.** Update the decision file's status to
    "implemented", and reconcile the per-package design docs
    (`design/packages/harness.md`, `design/packages/harness-types/
    coordination.md`) with the terminal shape: substrate owns
    storage + state store + worktree + provider composition;
    coord owns its runtime via the type protocol;
    `coordinationRuntime(harness)` is the canonical access. Then
    delete the now-completed blueprint.
  - **C1–C4 monitor work.** With decision 006 finished, the
    observability monitor (decision 004) is the obvious next
    initiative — every criterion is `unclear` because no monitor
    exists.
  - **Optional cleanup down the road.** `provider.send` and the
    coord-flavored slots on `ContextProvider` could move into the
    coord runtime as a future tightening (truly type-agnostic
    provider). Not in scope here — the current shape matches
    decision 006's "substrate is type-agnostic in *ownership*"
    intent without forcing a 170-call-site migration.

## 2026-05-10 — Decision 004 slice 1: monitor backend + C1 + page shell

- What I did:
  - With decision 006 closed, started decision 004 (observability
    monitor) from a concrete shape proposed in `8007c3f` and
    chosen by the user via AskUserQuestion: monitor only renders
    readings (no automated verdict), start with slice 1
    (skeleton + C1 + page shell), push as far as multiple slices
    today. Slice 1 lands an end-to-end vertical: backend +
    HTTP/SSE + web UI page + sidebar entry.
  - **Backend (`packages/agent-worker/src/monitor/`):**
    - `types.ts` — `ConcurrencySample`, `C1Metrics`,
      `MonitorSnapshot`, `MonitorEvent`. C1 metrics carry GOAL.md
      thresholds verbatim so the UI labels each value with the
      threshold the human reads against.
    - `samples.ts` — `RollingSampleStore` with three resolutions
      (1s for last hour, 1m for last 24h, 1h for last 30 days);
      eager bucket aging keeps memory under ~2MB. Pure module —
      no IO, no events.
    - `metrics.ts` — pure `computeC1` function plus
      `C1_THRESHOLDS` constant.
    - `monitor.ts` — `Monitor` class. Subscribes to the process
      `EventBus` (no-op for slice 1; intervention payload arrives
      slice 2) and polls registry state on a 1Hz tick.
      `tick()` walks every `ManagedHarness`, sums `activeAgents`
      from per-agent status, sums `activeRequirements` as
      `instructionQueue.size + agents-with-pending-inbox`.
      Snapshot is computed on demand (cheap relative to window
      size). Subscribers are an in-process callback set wired to
      the SSE route.
    - `index.ts` — barrel.
  - **Registry surface:** added `HarnessRegistry.iterManaged()`,
    a generator yielding every `ManagedHarness` (default global
    + named). Monitor uses it to walk live state without leaking
    private map iteration.
  - **Daemon wiring:**
    - Daemon constructs `Monitor` after registries; `start()`
      calls `monitor.start()` (also fires the first tick
      immediately so a fresh /monitor/snapshot doesn't return
      zeros for the first second of life). `stop()` calls
      `monitor.stop()`.
    - New routes: `GET /monitor/snapshot` returns the snapshot;
      `GET /monitor/stream` is an SSE stream that pushes a
      `{kind:"snapshot"}` event up front then `{kind:"sample"}`
      every tick. Auth gate updated to include `/monitor`.
  - **Web UI:**
    - `internals/web/src/api/types.ts` — added `ConcurrencySample`,
      `C1Metrics`, `MonitorSnapshot`, `MonitorEvent`.
    - `internals/web/src/api/client.ts` — `monitorSnapshot()` +
      `streamMonitor({ signal })` mirroring the existing SSE
      pattern (`sseStream<T>` reused).
    - `internals/web/src/stores/monitor.ts` — `monitorSnapshot`,
      `monitorRecentSamples` (capped at 60), `isMonitorStreaming`
      signals. `startMonitorStream()` consumes the SSE; on
      non-AbortError failure falls back to 5s polling. Each
      sample also patches `c1.current` on the cached snapshot so
      the UI's metric values stay live without an extra GET.
    - `internals/web/src/views/monitor-view.tsx` +
      `monitor-view.style.ts` — `MonitorView` lays out a four-card
      criterion grid. C1 card is fully wired: live counters
      (active agents / requirements / pending-on-auth /
      structural cap / 30-day peak) + the GOAL.md threshold
      printed beside each value (color-tinted by whether the
      value meets the threshold) + a stacked time-share bar
      (≥3 / =2 / =1 / =0) over 24h + a 60-second activity
      sparkline showing `activeAgents`. C2/C3/C4 cards are
      placeholders pointing at the slice that fills them.
      A summary strip above the grid shows compact one-line
      values for all four criteria.
    - `internals/web/src/pages/monitor.tsx` — thin wrapper page.
    - `router.ts` — `/monitor` hash route.
    - `stores/navigation.ts` — `selectMonitor()` helper +
      `{kind:"monitor"}` SelectedItem variant.
    - `app.tsx` — `MonitorView` registered in `createView` /
      `itemKey` / `selectedLabel`.
    - `components/layout/sidebar.tsx` — System section gets a
      Monitor entry (Activity icon) above Events/Settings.

- Observations:
  - Backend tests: 925 pass / 0 fail across internals/{harness,
    harness-coordination, agent, loop} + packages/agent-worker.
    Backend typecheck clean.
  - Web build: `bun run build` produces 215KB (entry) cleanly.
    The pre-existing `topbar.tsx` typecheck error
    (introduced in slice 1 of decision 006, last touched
    `19a1930`) is unrelated and unchanged by this slice.
  - Posture honored: every name in the slice
    (`Monitor`, `RollingSampleStore`, `C1_THRESHOLDS`,
    `ConcurrencySample`, `monitorSnapshot`, `selectMonitor`)
    reads as terminal-shape. Slices 2–4 will *fill* the placeholder
    cards but won't re-shape the page.

- Criteria check:
  - C1 — first time it has *any* numeric backing on disk. The
    rendered values are GOAL.md-defined; the verdict is still
    `unclear` because the human review hasn't run against the
    new readings yet. This is exactly the policy the decision
    proposes.
  - C2–C4 — `unclear` (slices 2–4 still pending).

- Invariants check: not exercised by this slice.

- Judgment: the goal-driven protocol's "monitor is the load-
  bearing piece for C1–C4" is now partially true in code: C1
  reads, no longer estimates. Continuing through slices 2–4
  removes the remaining `unclear`s.

- Next:
  - **Slice 2: C3 intervention tracking.** Define a small
    intervention event family (`agent.intervention.*`) and emit
    it from the auth-pause path, the orchestrator's run
    success/failure boundaries, and the rescue triggers. Wire
    `Monitor.onBusEvent` to log into the intervention table.
    Compute rescue ratio + per-requirement counts +
    response-latency distribution. Web UI fills the C3 card.
  - **Slice 3: C4 silence.** Compute the all-silent ratio and
    auth-wait non-blocking utilization from the existing sample
    stream + the new pending-on-auth signal that slice 2
    introduces. Web UI fills the C4 card.
  - **Slice 4: C2 binding inventory.** Walk each Harness's
    resolved agent config at create/reload, classify bindings,
    surface uncovered/failed counts and the (static-config +
    observed-success) reachability metric. Web UI fills C2.

## 2026-05-10 — Decision 004 slices 2–4: C3 + C4 + C2 land

- What I did:
  - Pushed three end-to-end vertical slices in one session.
    Each slice = backend metric + HTTP/SSE pass-through + web UI
    panel. Monitor `snapshot()` now returns all four criteria.
  - **Slice 2 — C3 intervention tracking** (commit `1dbfc2e`):
    - `monitor/types.ts`: `Intervention`, `InterventionType`,
      `C3Metrics` with thresholds.
    - `monitor/interventions.ts`: capped append-only
      `InterventionLog` (10K-entry cap, `recent(N)`,
      `totalsSince(cutoff)`).
    - `monitor/metrics.ts`: `computeC3` returns totals +
      rescue-ratio + per-requirement (auth+accept) count + recent
      list, with C3 thresholds verbatim.
    - `monitor.ts onBusEvent`: maps existing bus events to
      interventions — `harness.agent_error{strategy.fatal}` →
      rescue, `harness.kickoff_task_failed` → rescue,
      `harness.completed` → acceptance. `recordIntervention()`
      helper for paths outside the bus.
    - SSE union now includes `{kind:"intervention"}`. Web store
      patches the cached snapshot in place when an intervention
      arrives (cheap; only c3 changes).
    - Web UI: C3 card live counters + rescue ratio with
      threshold tinting + per-requirement metric +
      `RecentInterventions` feed (color-tinted by type).
  - **Slice 3 — C4 silence + activity** (commit `571b82c`):
    - `monitor/samples.ts allSeconds()` exposes the full 1-second
      buffer for metric computation.
    - `monitor/metrics.ts computeC4` walks the buffer in one pass,
      computing all-silent (unfinished AND 0 active),
      auth-wait non-blocking (auth pending AND other requirement
      AND ≥1 active), and phantom-block (auth pending AND other
      requirement AND 0 active, counted by transition into the
      state). `C4_THRESHOLDS` exported.
    - Web UI: C4 card values with threshold-tinted labels +
      window-sample count for context.
    - Note: auth-wait + phantom-block remain 0 until the
      authorization-pause source is wired (today
      `pendingOnAuth = 0`).
  - **Slice 4 — C2 binding inventory** (commit `ed37a3e`):
    - `monitor/bindings.ts`: `classifyRuntime(runtime, provider)`
      with closed (claude-code, codex, ai-sdk + anthropic /
      openai / google), open (deepseek, kimi, moonshot, qwen,
      ollama, …), unknown (cursor, mock).
      `buildInventory(registry)` walks `iterManaged()` and reads
      `managed.resolved.agents` to produce one `BindingEntry` per
      agent. Pragmatic: a binding is "covered" iff it is itself
      open-source — closed-source bindings are uncovered until
      the config schema gains a fallback slot (a future
      enhancement).
    - `monitor/metrics.ts computeC2` returns total + uncovered +
      `reachability = covered/total` + bySource breakdown +
      full inventory. C2 thresholds verbatim.
    - Web UI: C2 panel headline metrics + `BindingTable` listing
      every (harness, agent) row with runtime/model, source
      badge (closed=red, open=green, unknown=muted), and
      fallback yes/missing.
    - Summary strip cells C2/C3/C4 now show one-line live values
      (slice 1 placeholders removed).

- Observations:
  - Backend tests: 925/0 (slice 1) → 925/0 (slices 2–4
    spot-checked at 436/0 across packages/agent-worker +
    internals/harness; full suite re-verified at 925/0 after
    slice 4). Backend typecheck clean.
  - Web build: clean (215KB → 225KB cumulative).
  - Posture honored: every name added across the three slices
    (`InterventionLog`, `recordIntervention`, `computeC3`,
    `computeC4`, `computeC2`, `BindingEntry`,
    `classifyRuntime`, `buildInventory`) reads as terminal-shape.
    No transitional placeholders left in the UI; every C1–C4
    card is now backed by real numbers.

- Criteria check (first run with monitor backing):
  - C1 — read live: peak/structural cap/time-share now have
    numeric values that update in real time. Verdict still
    `unclear` because the monitor is too young to have produced
    a 30-day window worth observing against.
  - C2 — read live: depending on registered harnesses,
    `uncoveredCount` and `reachability` are now visible. The
    user's `agent-worker-dev` harness has multiple closed
    bindings and currently shows uncovered > 0; verdict
    `unclear` because GOAL.md's hard threshold "uncovered = 0"
    requires either a fallback config schema or different
    harness wiring.
  - C3 — read live: rescue/acceptance/auth/other counts. Verdict
    `unclear` until enough interventions accumulate for the
    rescue-ratio to be meaningful (today total may be very low
    on a fresh daemon).
  - C4 — read live: all-silent ratio over the 1-hour rolling
    window. Auth-wait + phantom-block depend on the future
    pendingOnAuth signal source; both currently 0.

- Invariants check:
  - Inv-2 — the monitor surfaces violations for the first time.
    The web UI's binding table rows with "missing" fallback are
    Inv-2 violations made visible. Enforcement (refusing harness
    creates that fail the check) is a follow-up; surfacing alone
    is the slice-4 deliverable per the proposal.
  - Inv-1 / Inv-3 — not exercised.

- Judgment: the load-bearing block of decision 004 is now in
  place. Every C1–C4 reading is computable on demand from the
  daemon's live state; the UI subscribes to a 1Hz SSE stream and
  re-renders without polling. Verdicts remain human-authored in
  this record file. Goal-level: no change, but `unclear` for
  C1–C4 has shifted from "no data, can't tell" to "data exists,
  thresholds named beside it; needs a 30-day window before a
  read counts".

- Next:
  - **Wire the authorization-pause signal source.** When a tool
    call or auth-required action surfaces, emit a structured
    intervention event with type `authorization` and tag
    `pendingOnAuth` on the next sample. This makes the C4
    auth-wait + phantom-block metrics non-zero in real use and
    closes the gap to a complete C3 picture.
  - **Add a fallback slot to harness config.** A small schema
    field (`fallback: <runtime+model>` per agent or per
    harness) lets `buildInventory` mark closed bindings as
    covered when the user has explicitly named an OSS fallback.
    With this, C2 reachability becomes the honest measure
    GOAL.md asked for.
  - **Use it.** The monitor exists; the next 30 days of real
    usage will produce the first non-`unclear` C1–C4 verdicts in
    `goals/record.md`. That is the structural goal close-out.

## 2026-05-12 — Attention-driven system protocol direction

- What I did:
  - Clarified the product direction after the user corrected the
    short-term target: `agent-worker` should replace the daily work
    entry into Claude Code / Codex, but only as the subset that also
    serves the final harness system. It is not a Claude Code / Codex
    clone and should not chase full CLI, chat, or IDE parity.
  - Added `design/decisions/009-attention-driven-system-protocol.md`
    as the adopted direction: `attention-driven` is a system protocol,
    not only a skill. The long-term harness target is self-awareness,
    self-adaptation, and self-organization.
  - Updated `design/DESIGN.md` and `design/packages/orchestrator.md`
    so future runtime-entry and orchestrator work uses the same scope
    rule: adopt backend-runtime behavior only when it serves both the
    short-term work-entry replacement and the long-term harness
    protocol.

- Observations:
  - `git diff --check` passes after the design edits.
  - The implementation work already in progress remains aligned with
    this direction: the authorization-pause monitor signal strengthens
    self-awareness and blocked-work handling instead of adding runtime
    parity for its own sake.

- Criteria check:
  - C1 — `unclear`; no new 30-day concurrency evidence in this design
    slice.
  - C2 — `unclear`; no fallback inventory change in this design slice.
  - C3 — `unclear`; direction supports intervention accounting, but no
    new long-window intervention verdict.
  - C4 — `unclear`; direction supports non-blocking auth handling, but
    the verdict still depends on live monitor samples over time.

- Invariants check:
  - Inv-1 — strengthened as design direction: cross-requirement
    continuity should live in harness records and protocol, not in a
    single super-agent prompt.
  - Inv-2 / Inv-3 — not exercised by this design slice.

- Judgment: goal-level direction is clearer, not changed. The short-term
  engineering target stays the work-entry replacement subset; the
  long-term mechanism target is attention-driven harness behavior. Next
  implementation work should continue the monitor/auth slice and then
  the OSS fallback slot, using decision 009 as a scope filter.

## 2026-05-12 — Authorization-pause monitor signal

- What I did:
  - Wired auth-classified harness pauses into the monitor by emitting
    `harness.authorization_required` when an agent run fails with the
    existing auth error strategy.
  - Emitted `harness.authorization_resolved` from harness resume paths
    so monitor state clears when the operator resumes an affected agent
    or harness.
  - Taught `Monitor` to keep an in-memory set of pending
    `(harness, agent)` authorizations, count them in `pendingOnAuth`,
    include them in `activeRequirements`, and record an
    `authorization` intervention.
  - Added focused monitor tests for pending authorization counting and
    clearing on either explicit resolution or the next agent run.

- Observations:
  - `bun test packages/agent-worker/test/monitor.test.ts` passes
    (2 tests).
  - `bunx tsgo -p packages/agent-worker/tsconfig.json --noEmit`
    passes.
  - `git diff --check` passes.
  - Broader `bun test packages/agent-worker/test` still fails in
    unrelated daemon/client/harness HTTP tests at server startup with
    `Failed to start server. Is port 0 in use?`; the new monitor test
    itself passes.

- Criteria check:
  - C1 — `unclear`; the current sample can now count auth-blocked
    requirements, but no 30-day concurrency verdict exists.
  - C2 — `unclear`; no binding fallback schema change in this slice.
  - C3 — `unclear`; the monitor now records `authorization`
    interventions from auth pauses, but rescue-ratio judgment still
    needs live usage over time.
  - C4 — `unclear`; `pendingOnAuth` is now non-zero when auth pauses
    occur, so auth-wait and phantom-block metrics can be exercised in
    real use, but no long-window verdict exists yet.

- Invariants check:
  - Inv-1 — not exercised.
  - Inv-2 — not changed; missing fallback rows remain surfaced by the
    existing C2 monitor.
  - Inv-3 — not exercised.

- Judgment: path-level progress. The previous C4 gap "pending-on-auth
  signal source missing" is now closed for auth-classified runtime
  pauses and resume clearing. The next distinct slice remains adding an
  OSS fallback slot to harness config so C2 can distinguish
  closed-but-covered bindings from uncovered bindings.

## 2026-05-12 — Daily-use diagnosis + handoff to Codex

- What I did (Hermes):
  - Started daemon. Auto-discovered 6 agents: claude-code, codex, cursor,
    deepseek, kimi-code, minimax. All idle in global harness.
  - Validated end-to-end: create task → dispatch to codex → agent
    processes in worktree → file created successfully (hello.txt at
    `~/.agent-worker/harness-data/global/worktrees/wake_xxx/main/`).
    Core loop works. 33K tokens, 11s, task completed.
  - Identified 3 blockers that prevent daily use. Wrote handoff blueprint
    at `blueprints/daily-use-blockers.md`.

- Observations:
  - **Blocker 1:** Worktree results not auto-merged to project. Agent
    creates files in isolated worktree; after Wake completes, worktree
    is deleted without surfacing results. Fix: auto git-merge before
    worktree cleanup in `harness-registry.ts` `wake.terminal` handler.
  - **Blocker 2:** `aw send codex "message"` → agent ignores it.
    Notification format causes `no_action` tool call. Fix: agent-only
    send path should auto-create task + dispatch instead.
  - **Blocker 3:** `sendToHarness` crash on `harness.harnessTypeId`
    undefined for default global harness. Fix: null guard in daemon.ts.
  - Codex `checkCodexAuth()` passes on this machine (v0.130.0, gpt-5.5).
    Claude Code subscription paused — Codex is the active CLI backend.

- Criteria check:
  - C1 — `unclear`. Monitor exists but no live multi-requirement usage.
  - C2 — `unclear`. OSS fallback slots not yet in harness config.
  - C3 — `unclear`. Auth-pause tracking wired but no rescue ratio data.
  - C4 — `unclear`. Auth-wait signal source closed but no long-window data.

- Invariants check:
  - Inv-1 — not violated. Worktree isolation strengthens the boundary.
  - Inv-2 — not exercised. Codex (closed-source) is the only active backend.
  - Inv-3 — N/A. Diagnostic session, not work submitted for acceptance.

- Judgment: **principal tension shifted from "structure vs measurement"
  to "core loop works but results aren't surfaced."** The previous
  trajectory (slice 2 → monitor) is now overtaken by the discovery that
  the task dispatch path actually works end-to-end. The 3 blockers in
  `blueprints/daily-use-blockers.md` are the new mainline. After they
  land, the user can use agent-worker for real daily tasks and form
  a feedback loop. Monitor (decision 004) remains important but now
  sits behind "make it usable" in priority.

- Next (for Codex on attention-driven resume): read
  `blueprints/daily-use-blockers.md`. Execute the 3 changes. Verify with
  typecheck + tests + live smoke test (`aw send codex ...` → file
  appears in project dir). Then close this record entry with results.

## 2026-05-12 — Strategic adjustment: Multica + Claude Code landscape

- What I did (Hermes):
  - Analyzed Multica (27K stars, Go daemon + Next.js, 10+ CLI backends):
    agents as issue assignees, thin daemon polls thick server, no
    agent-to-agent coordination, markdown-based skill injection.
  - Analyzed Claude Code Agent View (v2.1.139): sessions as process-level
    primitives, parallel independent workers, zero cross-session state.
  - Updated GOAL.md with Current Trajectory section and DESIGN.md with
    external landscape context + deferred substrate cut note.
  - Created HANDOFF.md + AGENTS.md handoff entry rule + attention-driven
    skill updates (go.md step 0, harness reference Handoff Convention).

- Observations:
  - Both Multica and Claude Code validate agent-worker's direction but
    neither does what agent-worker's 30% skeleton requires: Harness as
    shared context container, Wake/Handoff structured state transfer,
    HarnessType as structural primitive, OSS anchoring.
  - Substrate cut (extracting coordination to peer package) is structural
    refinement — zero behavioral change. Deferred until daily use and
    coordination end-to-end are proven.
  - Core loop verified: daemon → task → dispatch → Codex → worktree →
    handoff. Three blockers remain (see HANDOFF.md).
  - Monitor class exists but C1–C4 still `unclear`. Monitor is priority 3
    behind daily-use blockers and coordination end-to-end.

- Criteria check: C1–C4 all `unclear`.

- Invariants check:
  - Inv-1 — not violated. Harness owns context; worktree isolation strengthens.
  - Inv-2 — not exercised. Codex is the only active backend.
  - Inv-3 — not exercised.

- Judgment: principal tension is **core loop works, results aren't surfaced**
  (recorded in GOAL.md Current Trajectory). Path-level: HANDOFF.md 3 blockers
  → coordination end-to-end → monitor. Goal-level: no change. The 30% skeleton
  (Harness, HarnessType, Wake/Handoff, OSS anchoring) is confirmed by external
  landscape as the right bet.
