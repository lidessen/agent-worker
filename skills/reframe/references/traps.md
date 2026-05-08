# Common traps

Five named anti-patterns that recur across reframes. Use this
reference when something feels off — when the skeleton looks new
but doesn't satisfy, when stress tests pass too easily, when the
team is producing fast but the result keeps drifting toward the
familiar. Each entry includes a detection method.

These are diagnostic patterns, not phase-bound — any of them can
fire at any phase, and Phase 4 (Stress Test) and Phase 7
(Comprehension Test) are the natural places to surface them.

## New shoes, old path

Skeleton is traditional; the surface is reskinned with paradigm
vocabulary. The most common failure mode of the entire methodology.

**Detection.** Try describing the system without any paradigm-
specific verbs ("agent", "tool schema", "ambient context"). If the
description matches a traditional system in the same domain, the
reframe is cosmetic.

**Cure.** Back to Phase 3 — re-derive the skeleton from primitives
rather than from a familiar mental model. If the team can't, the
problem is upstream in Phase 2 (primitives are not yet operational
enough to load-bear).

## Novelty for novelty's sake

Skeleton is genuinely new but does the essence functions *worse*
than the traditional version. Users get fashionable architecture
and worse outcomes.

**Detection.** Walk through each essence function from Phase 1 and
ask "better, worse, or sideways for the user?" Sideways is
acceptable; worse means the reframe has lost the plot. Phase 7
comprehension tests will surface this if Phase 4 missed it.

**Cure.** Distinguish architectural novelty from user-visible
benefit. Some essence functions may stay traditional and that's
fine — that's the legitimate boundary of the reframe (Phase 4
outcome 3). Forcing novelty everywhere is the failure.

## Premature flesh

Drawing UI before the skeleton has settled. The flesh then
constrains skeleton revision — changing the skeleton breaks the
UI, so the team stops changing the skeleton. Skeleton discipline
collapses.

**Detection.** Are stress test outcomes (Phase 4) being absorbed
into v2/v3 skeleton, or are they being routed around because "the
mocks are already done"? If the latter, the flesh is driving the
skeleton.

**Cure.** Phase 6 (Flesh) is gated on Phase 4 stress tests
passing. If you're sketching UI while the skeleton is still
changing, stop. Sketches are fine; commitment to a flesh shape
isn't.

## Shapeless transfer

Borrowing patterns from mature domains without translation, ending
up with a new-domain system that is secretly the source domain in
disguise. The Transfer Log entry should record the abstract
problem and the translation; if the entry is just the source
pattern, no translation happened.

**Detection.** Read each Transfer Log entry. Is the "translated
form here" column actually different from the source? If they
look the same, the pattern was copied, not transferred.

**Cure.** Force the "what does this become *here*?" step before the
pattern enters the skeleton. Note deliberate non-transfers too — a
pattern explicitly considered and rejected (with reason) prevents
re-litigation.

## Phantom primitives

Listing capabilities the new paradigm *could* offer but the team
can't actually access — because the underlying tech isn't there
yet, the platform doesn't expose it, or the cost would be
prohibitive. Skeleton then load-bears on something that doesn't
exist.

**Detection.** For each Paradigm Primitive in Phase 2, ask "can we
actually use this in production today, with current tooling and
budget?" If the honest answer is "in two years maybe", it's a
phantom.

**Cure.** Calibrate primitives to what's available, not what's
imagined. Operational concreteness is the test in Phase 2 — if a
primitive is still a slogan or a roadmap item, drill down or
remove it.
