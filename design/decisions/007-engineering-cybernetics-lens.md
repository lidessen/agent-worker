# Engineering Cybernetics Lens — Harness Observability Invariant

**Status:** proposed (tentative — see Outcome)
**Date:** 2026-05-10 (proposed)

## Context

The project's existing data flow (DESIGN.md) is already a closed feedback
loop: Signal intake → reducer → HarnessEvent → projection → ContextPacket
→ Wake → loop → extracted HarnessEvents → next projection. Decisions 005
and 006 already commit to several control-theoretic patterns without
naming them — Tasks as projections (state estimation, not state of
record), cross-type reads through substrate surfaces (not direct store
coupling), idempotent extraction keyed by `invocationId` (replay tolerant
to disturbance), Wake as bounded execution unit (sampling), HarnessEvent
stream as durable cross-runtime recovery surface (single source of
truth for state reconstruction).

H. S. Tsien's *Engineering Cybernetics* gives a vocabulary for what's
already there: feedback loops, observability, controllability, sampled
systems, disturbance rejection, multi-rate control. The skill's
`references/control-loop.md` already absorbs the lens at the methodology
layer. The open question is whether the **project** should absorb any of
it as explicit design contracts — or leave it as implicit pattern.

The risk on each side: leaving it implicit means every new mechanism
proposal (new `HarnessType` stores, new MCP tool kinds, new Wake fields,
new substrate projections) re-derives the same judgment from scratch,
sometimes wrongly — see decision 006's cold review flagging "substrate
defined by enumeration, not by criterion." Making it explicit risks
ceremony — control-theoretic checkboxes that don't change outcomes.

This decision picks the smallest contract surface where (a) current
design *already* satisfies the principle, (b) future proposals plausibly
strain it, and (c) stating it explicitly gives reviewers a concrete
criterion to push back with. One contract: **the Harness observability
invariant**. Three other concepts (clock-domain placement,
controllability boundary as goal-legality predicate, model-identification
escalation, disturbance taxonomy) are real increments and deferred —
see Alternatives for why each was rejected for this decision.

## Recommendation

### Harness observability invariant

> **Any Harness-layer decidable state must be reconstructible from the
> durable HarnessEvent stream plus Resources (and runtime-local session
> files, for runtime continuity). New mechanisms that introduce mutable
> state read by the Harness layer must satisfy this property or
> explicitly justify exemption.**

**Scope clause — "Harness-layer decidable state."** State that any
orchestration tick, capability check, extraction, projection rebuild,
recovery sweep, or cross-Harness read may consult to make a Harness-level
decision. The invariant is deliberately scoped to the Harness layer; it
does not claim that every byte of state inside a running Wake (e.g. the
LLM's context window, the loop's intermediate scratch, an MCP tool's
network connection) is reconstructible. Wake-internal state is
runtime-local by design (DESIGN.md "Runtime-local usage/session
semantics"). The invariant fixes what the *Harness layer* can rely on,
not what runs inside the loop.

**Classification of current durable state.**

| State | Class | Notes |
| --- | --- | --- |
| HarnessEvent stream, Resources, Documents | substrate truth | reconstructed from JSONL |
| Track / chronicle / timeline / status | satisfying projection | projection over events; rebuildable |
| Task projection (decision 005) | satisfying projection | projection over events; rebuildable |
| Type-contributed stores (channels, inbox, channel bridge) | satisfying projection or extension | projected from events; type owns the projection |
| Protected invocation records | substrate truth | durable; idempotency anchor |
| External-effect outbox / commit record | substrate truth | durable on disk; required by DESIGN.md for non-idempotent effects |
| Capability allowance ledger | satisfying projection | derived from Wake / capability HarnessEvents |
| Runtime-local session files (Codex `threadIdFile` etc.) | scoped exemption | DESIGN.md already accepts as runtime-local, not cross-runtime durable; recovery surface, not decidable state shared across Harnesses |
| `HarnessTypeRegistry` and MCP hub | scaffolding, not decidable state | populated from harness config + type plug-ins at construction; same config produces same registry on restart; not consulted to make decisions about the world, only to dispatch |
| EventBus subscriber set, per-run-log file handles | scaffolding, not decidable state | in-process plumbing; no decision reads them |

**Exemption — bounded, durable-source, external.** A proposal may exempt
mutable state from reconstructibility if and only if it names a
regeneration source that is **(a)** durable, **(b)** external to the
exempted state itself, and **(c)** sufficient to rebuild the exempted
state without reading the state being exempted. "Cache regenerated on
miss from the HarnessEvent stream" qualifies. "Cache regenerated from
itself plus a config file" does not qualify if the exempted state is
the source of truth for any decision. Examples that qualify:

- Performance caches whose miss path reads HarnessEvent / Resource /
  config (durable, external).
- Ephemeral connection state rebuilt on reconnect from durable session
  metadata (websocket session, MCP stdio handle).
- Pure derivation results that are deterministic functions of durable
  state.

This invariant codifies the current event-first JSONL design and the
cross-type-read discipline from decision 006 into one criterion future
proposals must address.

## Alternatives seriously considered

- **Do nothing — leave control-theoretic patterns implicit.** Strongest
  case: zero design churn; current design already behaves correctly;
  contributors who don't think in control-theoretic terms aren't taxed.
  Rejected: decision 006's cold review explicitly flagged the same
  failure mode (substrate by enumeration, not by criterion). The cost
  of implicit criteria is paid once per new-mechanism proposal in
  re-derivation effort and occasional wrong derivation. A few
  paragraphs in DESIGN.md prevent that.

- **Bigger import — also formalize clock-domain placement,
  controllability boundary as a goal-legality predicate,
  model-identification escalation, disturbance taxonomy.** Strongest
  case: a single decision absorbs the lens end-to-end; future proposals
  have a richer filter. Rejected: each is a real increment with its own
  consequences, and none has concrete near-term pressure. Bundling
  risks ceremony without proportional benefit. Defer to follow-on
  decisions if pressure appears.

- **Include a clock-domain placement contract in this decision.** An
  earlier draft of this proposal paired the observability invariant with
  a "every mechanism declares its clock domain; cross-domain coupling
  goes through HarnessEvent or Resource" contract. Rejected after cold
  review: 006 already says "cross-type read happens through substrate
  surfaces" structurally; restating it along the time axis with no
  current-design mechanism it would catch beyond what 006 already
  catches is documentation, not contract. Reconsider only when a
  proposal genuinely strains time-domain coupling (e.g. a mechanism
  wanting Wake-internal state visible to the orchestrator tick within
  the same Wake) — at that point the contract has a concrete subject
  to filter.

- **Adopt control-theoretic vocabulary (plant / sensor / actuator /
  error) as user-facing terminology.** Rejected per
  `references/control-loop.md`: source vocabulary is scaffolding, not
  user-facing form. Renaming Harness / HarnessEvent / Wake to plant /
  sensor / sample is pure disturbance — it loses the project's own
  established terms without adding judgment power. Only the *operating
  principles* transfer.

- **Write the lens as a documentation appendix, not a Constraint.**
  Rejected: a non-binding appendix doesn't filter proposals. The whole
  point is to give reviewers a concrete criterion to push back with.

- **Defer entirely — let `references/control-loop.md` (skill layer) do
  the work.** The skill already gives reviewers feedback / observation /
  durable-evidence language. Rejected, narrowly: the skill tells a
  reviewer how to think; it does not tell them which property the
  agent-worker codebase commits to. A reviewer pushing back with
  "this violates 007's observability invariant for capability ledgers"
  is more grounded than "control-loop.md says feedback should go through
  durable evidence." But this margin is real reason for the tentative
  status (Outcome).

## Pre-mortem

A year from now this is being ripped out because:

- **The observability invariant turned out too strong.** Some
  legitimate mechanism — a long-lived in-memory connection pool, a
  streaming buffer, a reasoning-trace ring buffer — could not satisfy
  reconstructibility and the exemption clause was abused. Mitigation:
  the hardened exemption clause requires the regeneration source to be
  durable, external, and sufficient. Reviewers reject "regenerated from
  itself" or "regenerated from in-memory subscriptions." If exemption
  is invoked frequently, that signals the invariant is mis-drawn and
  should be revised, not bypassed.

- **It became checklist ceremony.** Future decisions added an
  observability section that nobody read or tested. Mitigation: each
  invocation must give a concrete current example of what the
  criterion catches — the test of the criterion is whether it rejects
  something. If a decision invokes the criterion and the answer is
  "trivially yes," the section should be omitted, not rote-filled.

- **Validated only against currently-conforming mechanisms.** All worked
  examples in the classification table satisfy the invariant — that's
  by construction; the invariant was drafted from current design. The
  first real test is the next proposal that genuinely strains it: a
  streaming reasoning trace, multi-Wake speculative parallelism, a
  persistent vector index whose state is partly opaque. A criterion
  validated only against conforming examples has no falsification track
  record. Mitigation: the proposal is marked tentative; flip to adopted
  only after at least one decision genuinely strains and survives the
  invariant. Until then, contributors may invoke the criterion as
  *current-best-statement-of-intent*, not as binding precedent.

- **Tsien's framing turned out to be a mismatch for LLM-driven
  systems.** The plant in Engineering Cybernetics is a stationary
  physical system; LLMs are non-stationary and partly adversarial.
  Mitigation: this decision deliberately imports only operating
  principles that survive the mismatch (durable observation surface for
  the Harness layer). Stability proofs, optimal control, adaptive
  control identification, and the assumption that all decidable state
  is observable from outside the loop *are* mismatched and were already
  excluded. The scope clause makes the exclusion explicit.

## Consequences

- `design/DESIGN.md` Constraints section gains the Harness observability
  invariant. The classification table from this decision is referenced,
  not copied — DESIGN.md gets the invariant statement and the
  exemption clause; the classification is a 007 artifact that future
  reviewers consult.
- Future `design/decisions/NNN-...md` proposals that introduce new
  mutable state, new projections, new substrate fields, new HarnessType
  stores, or new MCP tool surfaces should address the criterion when
  it bites. If the answer is trivial, the section is omitted.
- No code changes. No new mechanism. No vocabulary import — DESIGN.md
  continues to use Harness / HarnessEvent / Wake / Handoff /
  CapabilityBoundary / Track. The control-theoretic source is named in
  a single sentence pointing at this decision and at
  `skills/attention-driven/references/control-loop.md`.
- Decision 006's "cross-type read through substrate surfaces" rule is
  preserved verbatim. This decision adds an orthogonal criterion (state
  must be reconstructible) without modifying 006's criterion (state
  must not be read through cross-type imports). The two criteria
  compose: a proposed mechanism must pass both.
- `references/control-loop.md` (skill layer) and this decision (project
  layer) sit at different layers and can drift independently — the
  skill keeps the methodology lens for any project; this decision keeps
  the agent-worker-specific contract.

Per CLAUDE.md refactor posture: this lands fully in DESIGN.md when
adopted — no transitional wording, no migration markers.

## Cold review

Findings from an adversarial reviewer in a fresh context (subagent),
with in-line responses.

- **Completeness — capability allowance ledgers, idempotency outbox,
  and runtime registries unclassified.** Original draft listed ledgers
  as "satisfying-by-construction" without saying which side of the line
  they sit on; the external-effect outbox required by DESIGN.md was
  unaddressed; `HarnessTypeRegistry`, MCP hub, EventBus subscriber set
  were ambiguous between "decidable state" and "scaffolding."
  *Fixed.* Recommendation now includes a classification table covering
  ledgers (satisfying projection), outbox (substrate truth), registries
  / EventBus / file handles (scaffolding, not decidable state — populated
  deterministically from harness config + type plug-ins), and runtime-
  local session files (scoped exemption, recovery surface only).

- **Consistency — clock-domain table contradicted 006's structural
  framing.** Original draft promoted "cross-Harness exchange" to its
  own clock domain and claimed the contract *generalized* 006, when it
  actually substituted "advance trigger" for 006's "universality"
  criterion.
  *Fixed by removal.* The clock-domain placement contract has been
  dropped from this decision and recorded in Alternatives as deferred.
  006's substrate-surface rule stays the structural criterion; the
  observability invariant is the orthogonal property criterion.
  Reconsider clock-domain placement only when a near-future mechanism
  strains time-domain coupling beyond what 006 already filters.

- **Clarity — "decidable state" exemption was relabel-abusable.** The
  original regeneration-source rule could be satisfied by "regenerated
  from itself plus a config file" or "rebuilt on next tick from
  in-memory subscriptions."
  *Fixed.* Exemption clause now requires the regeneration source to be
  **(a)** durable, **(b)** external to the exempted state, and **(c)**
  sufficient to rebuild without reading the exempted state. The scope
  clause additionally restricts the invariant to Harness-layer
  decidable state, removing the implicit overreach into Wake-internal
  state.

- **Scope — contract D had no concrete current-design example it
  rejected.** The original draft's only worked example was hypothetical
  ("orchestrator tick reads mid-Wake transient state"). With D doing no
  filtering work beyond what 006 already does, it was the most likely
  candidate for the pre-mortem's "checklist ceremony" failure mode.
  *Fixed by removal.* See above. The decision now carries a single
  contract whose load-bearing weight is concentrated, not diluted.

- **Differentiation — project-layer absorption may duplicate
  `control-loop.md`.** Reviewer noted that the skill already gives
  reviewers the operating principle. The project layer earns its keep
  only if a future proposal needs *agent-worker-specific* phrasing.
  *Defended, with caveat.* The skill tells a reviewer how to think; the
  decision tells them which property the codebase commits to. "This
  violates 007's observability invariant for capability ledgers" is a
  more grounded pushback than a methodology-layer reference. But the
  margin is genuinely thin, which is why the proposal is marked
  tentative — see Outcome.

- **LLM-as-plant — invariant assumed well-defined system state.**
  Reviewer flagged that mid-Wake decidable state is partly inside the
  LLM's context window (correctly treated as runtime-local). The
  invariant as originally written read stronger than intended.
  *Fixed.* Scope clause now restricts the invariant to "Harness-layer
  decidable state," with explicit exclusion of Wake-internal state.

- **Pre-mortem — validated only against currently-conforming
  mechanisms.** Reviewer noted that all worked examples satisfy the
  invariant by construction; a criterion has no falsification track
  record until it has rejected something.
  *Fixed.* New pre-mortem item names this directly. The proposal is
  marked tentative; flip to adopted only after at least one decision
  genuinely strains and survives the invariant. Until then, the
  criterion is current-best-statement-of-intent, not binding precedent.

## Outcome

Pending review.

When adopted, status flips to `tentative-adopted`: the invariant is the
codebase's stated commitment, but reviewers should treat it as
provisional and propose revisions if a near-future mechanism either
fails the criterion non-trivially or finds the exemption clause
mis-drawn. Status flips to `adopted` after at least one independent
decision invokes the criterion and the result is preserved as
precedent.
