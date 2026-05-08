# Phase guide — deep methodology per phase

This reference holds the calibration tests, common failure modes,
and worked examples for each phase. SKILL.md keeps the skeletal
description of each phase (what it does, what it outputs, where).
Load this reference when you're stuck on a specific phase, or
auditing whether a phase was done well.

For document format requirements (vignette pattern, ASCII diagrams,
verb-tagged blocks, dependency tables), see `template.md` instead —
this guide focuses on methodology, not form.

---

## Phase 1: Essence Extraction — going deeper

### Calibration test

An essence statement should be specific enough that it *could not* be
implemented the wrong way, and abstract enough that it prescribes
no specific implementation. Two anchors:

- **"Track interactions"** — too vague. Track how? Which
  interactions count? You can build this five different ways and
  get five different systems.
- **"Maintain a per-relationship running synthesis updated by every
  recorded interaction"** — essence-grade. Tells you what must be
  possible (a per-relationship object that absorbs every event)
  without saying how (no schema, no UI, no storage decision).

Useful question: would this statement still be true thirty years
from now, under any paradigm we can imagine? If yes, it's essence.
If it presumes a particular UI, storage model, or interaction
mode, it's an artifact dressed up as essence.

### Common failure modes

**Listing features instead of functions.** "Customer profile,
pipeline view, reporting dashboard" — those are flesh. The
underlying function is "remember relationships, track interactions,
surface opportunities."

**Smuggling paradigm assumptions.** "User clicks through stages" —
that's a paradigm artifact (mouse + form). The function underneath
is "advance state in response to evidence."

**Compressing too far.** "It's just data management." Too abstract
to constrain skeleton design. Look for the smallest claim that
still forbids most implementations.

### When stuck

Try writing the essence in three different paradigms. If you can
write it once and have it remain valid in mobile-app form,
voice-first form, and AI-native form — that's essence. If the
wording shifts when you change paradigm, you've still got artifact
in there.

---

## Phase 2: Paradigm Primitives — going deeper

### Calibration test

A primitive must be something a skeleton can *be expressed in*. If a
candidate is still a slogan, drill down. "AI native" → what does
"native" mean operationally? Keep drilling until the answer is
concrete enough to load-bear.

Aim for 4-8 primitives. Fewer than 4 usually means under-specified
(you'll find them when you try Phase 3 and run out of building
blocks). More than 8 means some are not load-bearing — fold them
or drop them.

### Example primitive set (AI-native)

- Every action is exposed as a tool with a JSON schema
- Agents can read arbitrary context (emails, meetings, prior chats)
  rather than only what was typed into a form
- State can be inferred from evidence instead of entered by hand
- Natural language and structured data flow both ways
- Background agents can act between user sessions

Each is operationally testable. "Tool with a JSON schema" either
exists or doesn't; "ambient context" is either readable or it
isn't. None are slogans.

### When stuck

If you've written primitives but Phase 3 keeps reaching for
traditional shapes, the primitives aren't yet load-bearing. Don't
keep trying to build a skeleton — go back and ask "what would I
need to be true for this skeleton to work?" That gap is the
missing primitive.

---

## Phase 3: Skeleton Reconstruction — going deeper

### The hardest discipline

Refuse to reach for the traditional shape when the new shape is
unclear. If you find yourself drafting "a deal table with a stage
column", catch yourself — that's old skeleton. The reframe question
is: *what is a deal, in a world where state is inferred from
evidence?* Maybe it's "a relationship trajectory with a confidence-
weighted suggested stage that the user confirms or overrides."
Maybe it's something else entirely.

Sit with the question. Premature familiarity is the failure mode
here. Better to leave a placeholder ("[unresolved: how do we
represent X in this paradigm?]") than to fill it with a traditional
shape and call it done.

### Versioning

The first skeleton will be wrong somewhere. Write v1, run stress
tests (Phase 4), write v2 in light of what failed. Keep prior
versions visible but collapsed using `<details>` tags. The delta
annotation between versions matters — readers shouldn't diff
component lists by hand to understand what changed and why.

### When stuck

If a primitive ↔ component cell in the dependency table can't be
filled, that's diagnostic information. Either the component isn't
actually expressed in primitives (old skeleton in disguise), or the
primitive isn't strong enough to load-bear (gap in Phase 2).

---

## Phase 4: Skeleton Stress Test — going deeper

### Probe questions

Probe by removing traditional crutches one at a time:

- "Suppose there are no input forms — can the skeleton still ingest
  what it needs?"
- "Suppose there are no manual stage transitions — does the
  skeleton produce stage state from evidence?"
- "Suppose there are no scheduled reports — does the skeleton
  surface what users need to know without polling?"
- "Suppose the user never logs in for a week — what still happens
  correctly?"

Each probe forces a question the new skeleton must answer
independently of the crutch. The crutches you remove should be
the ones the user is most accustomed to in the traditional system
— that's where the reframe earns its keep.

### Three outcomes

1. **Skeleton holds.** New primitives carry the load. Record this
   — it's positive evidence the reframe is real, not cosmetic.
2. **Skeleton bends but holds with adjustment.** Modify the
   skeleton to absorb the load. Bump the version.
3. **Skeleton collapses.** Either essence was misidentified (back
   to Phase 1), primitives are insufficient (back to Phase 2), or
   this particular function genuinely doesn't redefine in the new
   paradigm — it stays traditional, and that's the boundary of the
   reframe.

Outcome 3 is not failure. Knowing where the new paradigm *doesn't*
help is part of the design. Document the boundary explicitly so it
doesn't get re-litigated.

### Append-only discipline

Don't delete failed attempts. Their existence is the evidence that
the surviving skeleton was tested. A stress test log of three
entries with all "held" verdicts is *less* trustworthy than a log
of seven entries with three "bent" outcomes — the latter shows
real probing happened.

---

## Phase 5: Transfer Learning — going deeper

### Two questions per source

For each candidate source domain, ask:

1. What problem did the source domain solve, *abstractly*? (Not
   the implementation — the underlying problem.)
2. Does the new domain face an isomorphic problem?

If yes, the source pattern *seeds* the new design — never as a
verbatim copy. The translation step is where the value lives.

### Example transfers

- AI agent context management ↔ software engineering's information
  architecture (L1/L2/L3 layering, just-in-time loading, the
  principle that more context isn't always better)
- Conversation memory across sessions ↔ email threading and
  version control merge semantics
- Tool schema design ↔ API design conventions and Unix pipe
  composability
- Agent attention/budget management ↔ Kanban WIP limits and OS
  scheduler quotas
- Background agent coordination ↔ build system DAGs

### Non-transfers matter too

Note deliberate non-transfers: "considered borrowing X but it
relies on assumption Y that doesn't hold here." This prevents the
same pattern from being re-litigated when a new team member
encounters it. The Transfer Log entry's "considered, not taken"
form does this work.

### When to invoke

Transfer is cross-cutting — invoke during Phase 2 (primitive
identification), Phase 3 (skeleton drafting), or Phase 4 (rescue
when skeleton bends). It's never a separate sequential step;
it's a tool you reach for when stuck or when looking for prior
art.

---

## Phase 6: Flesh — going deeper

### The two governance rules

**Familiarity is fine, mimicry is suspicious.** A list view that
resembles a traditional one is fine *as long as* it's a projection
of skeleton state. If you can't name which skeleton state it
projects, it's not flesh — it's old paradigm leaking through, and
the data behind it is probably in the wrong shape.

**Flesh never adds capability the skeleton lacks.** If the user
needs to do X, X must be expressible in the skeleton. If not, the
right move is to revise the skeleton (back to Phase 3), not to
bolt X onto the surface. A surface capability the skeleton can't
reason about will fight the rest of the system forever.

### When stuck

If a flesh element keeps wanting to do something the skeleton
can't, that's diagnostic. Don't engineer around it at the surface
— stop and ask: is this a real user need? If yes, revise the
skeleton. If no, drop the flesh element.

---

## Phase 7: Comprehension Test — going deeper

### How to test (lightest credible evidence)

Match the artifact's fidelity to the risk:

- **Lowest risk** — narrate the flow in plain language to a target
  user; ask them to predict what happens next at each step.
  `/reframe explain for <audience>` produces this artifact directly
  — generate it, walk it through with the target user, log
  reactions.
- **Medium risk** — wireframe walkthrough or paper prototype.
- **Higher risk** — interactive mock with real interaction patterns.
- **Highest risk** — working prototype on a thin slice of the
  skeleton.

Reframe does not prescribe research methodology. The discipline is
"the cheapest evidence that would change your mind". Heavier
artifacts are scope creep into UX research; lighter ones leave the
question unanswered.

### Three diagnoses, three feedback paths

When users cannot navigate the flesh, the cause matters — different
causes feed back into different earlier phases. Misdiagnosis turns
the loop into mindless flesh iteration that drifts the skeleton.

1. **Flesh problem.** Skeleton is sound; the projection is awkward.
   *Feedback → Phase 6.* Revise how skeleton state is surfaced
   without changing the skeleton.
2. **Skeleton problem.** No projection of this skeleton can land
   in the user's head — the bones are too foreign for the audience.
   *Feedback → Phase 3.* This is also the most common signal that
   the reframe has slipped into "novelty for novelty's sake".
3. **Essence problem.** The flesh projects the skeleton faithfully
   and the skeleton holds, but it doesn't serve what users actually
   need. The wrong functions were extracted as essence.
   *Feedback → Phase 1.* Hardest diagnosis to face, but the
   cheapest place to learn it is here, not after launch.

### Boundary: this is the last gate before graduation

Phase 7 is the final check before the concept can graduate via
`/reframe close`. It is not the start of full user research — that
discipline belongs downstream, in design-driven's blueprint Verify
sections and in the implementation phase. Phase 7 ends as soon as
there's enough evidence to know which (if any) of the three
feedback paths to walk.
