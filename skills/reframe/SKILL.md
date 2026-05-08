---
name: reframe
description: Designing in territory where the industry is still groping for shape — AI-native systems, agent-first interfaces, any domain whose category is forming. Triggers on "AI native X", "agent-first X", "redefine X", "rebuild X from scratch under Y", "reframe X for Y", "what should X look like in the new paradigm", "design a system with no precedent", or the tension between "new shoes on the old path" and "a skeleton that holds on its own". Method — strip to 3-5 abstract functions, redraw the load-bearing skeleton from the new paradigm's primitives, stress-test without traditional crutches, then add familiar flesh as projection. Do NOT trigger for incremental redesigns within an existing paradigm (use design-driven), explanatory writing (use technical-article-writing), or vague "make it AI" requests. Pairs with design-driven (upstream) and goal-driven (parallel). Args — `/reframe init`, `close`, `explain [for <audience>]`.
argument-hint: "[init | close | explain [for <audience>]]"
---

# Reframe

Methodology for designing in territory where no one yet knows the
shape. When you're building "AI native CRM" or "agent-first IDE", the
danger isn't that you fail outright — it's that you succeed at a
*traditional* version wearing the new paradigm's clothes. New buttons,
old skeleton. The user gets traditional capability with paradigm
overhead: the worst of both worlds.

This skill enforces a sequence designed to prevent that. Distill what
the domain actually does underneath its surface. Redraw the load-
bearing skeleton using the new paradigm's primitives. Test whether the
skeleton stands without traditional crutches. *Then* add the familiar
surface as a projection of the new skeleton.

## Commands

When invoked with an argument, dispatch to the corresponding file:

- `/reframe init` → Read and follow `commands/init.md` in this skill
  directory. First-time project plumbing: create `concepts/`, register
  the skill in agent configs.
- `/reframe close` → Read and follow `commands/close.md` in this skill
  directory. Finalize a concept document with a retrospective and
  archive it.
- `/reframe explain [for <audience>] [about <focus>]` → Read and follow
  `commands/explain.md` in this skill directory. Translate the
  concept document into an audience's working vocabulary; output to
  chat. Doubles as a Phase 7 narration-fidelity comprehension-test
  artifact.
- No argument → Continue with the methodology below. If `concepts/`
  contains active documents, list them and offer to resume one. If
  empty, ask the user what they want to reframe and create a new
  document from `references/template.md`.

---

## Core idea: skeleton vs flesh

Every domain has two layers, and reframing is about which one you
rebuild first.

- **Skeleton** — the load-bearing abstract functions. For a ticket
  system: information ingestion + state tracking + event notification.
  Three abstract verbs. Survives every UI redesign for thirty years.
- **Flesh** — the surface a user sees. Forms, lists, buttons,
  workflows. Tied to a specific paradigm and era.

Most "AI native" failures rebuild the flesh and call the result
innovation. The skeleton stays a CRUD database with stage fields, and
the agent becomes a smart input box bolted on top. The reframe never
happened.

A real reframe reconstructs the skeleton itself from the new
paradigm's primitives. Flesh follows. Often the user-visible result
*resembles* a traditional system — that's fine, that's the projection
— but every operation underneath flows through new primitives.

## The artifact: `concepts/<target>.md`

A reframe is a multi-session exploration. The document is the
pause-and-resume mechanism: any agent (a future you, a different
session, a teammate) can pick up where work left off because the
full thinking trail lives in the file, not in any session's memory.

One file per redefinition target. Structure follows
`references/template.md` — the template mandates expressive form
(plain-language summary, vignettes, ASCII diagrams, verb-tagged
blocks, dependency tables) because abstract methodology applied to
abstract content reads like noise without it. Treat the form
requirements as defaults; the only documented escape hatch is "v1
skeleton may be prose-only while shape is still forming."

### Directory layout

```
concepts/
  <target>.md          ← active concept document (e.g. ai-native-crm.md)
  archive/
    <target>.md        ← closed concepts moved here by /reframe close
```

Each file carries YAML frontmatter (`target / paradigm / status /
opened`) so its state is machine-readable. See
`references/template.md` for the exact frontmatter and section
structure.

### Resume-or-start flow

When the user invokes the skill with no argument:

1. List files in `concepts/` (excluding `concepts/archive/`). For
   each, read the frontmatter `status` field; offer files with
   `status: active` as resume candidates.
2. If the user picks one, load it and continue from its current
   phase. If they want a new target, create a new file from the
   template and start at Phase 1.
3. If no `concepts/` directory exists, suggest `/reframe init`
   first — but if the user prefers to skip plumbing, just create
   the directory and document inline.

---

## Phase 1: Essence Extraction

Strip the target domain to 3-5 abstract functions that survive any
paradigm. Each function is paired with a one-sentence justification
and a concrete vignette grounding the abstraction in scene.

Calibration: an essence statement should be specific enough that it
*could not* be implemented the wrong way, and abstract enough that
it prescribes no specific implementation.

Write under `## Essence` per `references/template.md`. For failure
modes (feature-listing, smuggling paradigm assumptions, over-
compression), worked examples, and "when stuck" guidance, see
`references/phase-guide.md`.

## Phase 2: Paradigm Primitives

Identify 4-8 operationally concrete building blocks the new
paradigm offers. A primitive must be specific enough that a
skeleton can be expressed *in* it; slogans don't count. If a
candidate is still a slogan ("AI native"), drill down to operational
consequences.

Write under `## Paradigm Primitives`. For an example primitive set
(AI-native), the drilling-down test, and "when stuck" guidance, see
`references/phase-guide.md`.

## Phase 3: Skeleton Reconstruction

Re-express the essence using the primitives — essence *expressed
in* primitives end-to-end, not essence with primitives sprinkled
on. Version explicitly: v1 will be wrong somewhere; v2 absorbs
what stress tests reveal.

The hardest discipline is refusing the traditional shape when the
new shape is unclear. Better to leave a placeholder ("[unresolved
in this paradigm]") than to fill it with a familiar mental model.

Output requires a text-diagram of the core flow, a Components →
Primitives dependency table, and per-component rationale (v1 may
be prose-only). Between consecutive versions, write a delta
annotation. See `references/template.md` for the format and
`references/phase-guide.md` for the "sit with the question"
discipline.

## Phase 4: Skeleton Stress Test

Probe by removing traditional crutches one at a time. Three
possible outcomes per probe: skeleton **holds** (positive evidence),
**bends** (adjust skeleton, bump version), or **collapses** (back
to Phase 1 or 2 — or document the boundary if the function
legitimately stays traditional).

Outcome 3 is not failure. Knowing where the new paradigm *doesn't*
help is part of the design.

Write under `## Stress Tests` (append-only) using the verb-tagged
block format `Date / Removed / Hypothesis / Result / Diagnosis`.
For probe-question patterns and append-only discipline, see
`references/phase-guide.md`.

## Phase 5 (cross-cutting): Transfer Learning

Mature domains have already solved isomorphic problems. Mine for
patterns, not shapes. Translate, don't copy. For each candidate
source, ask: what abstract problem did it solve, and does the new
domain face an isomorphic one? Note deliberate non-transfers too,
to prevent re-litigation.

Invoke during Phase 2 (primitive identification), Phase 3 (skeleton
drafting), or Phase 4 (rescue when skeleton bends). Write under
`## Transfer Log`. For example transfers and the two-question test,
see `references/phase-guide.md`.

## Phase 6: Flesh

Once the skeleton holds, plan the user-facing surface as a
*projection* of skeleton state. Two governance rules: **familiarity
is fine, mimicry is suspicious** (every flesh element must name
the skeleton state it projects); **flesh never adds capability the
skeleton lacks** (if it tries to, revise the skeleton instead).

Write under `## Flesh Plan` as a three-column table — element /
skeleton state / user need. If you can't fill all three columns
for a row, the element isn't flesh — it's old paradigm leaking
through. See `references/template.md` for the format and
`references/phase-guide.md` for the governance rationale.

## Phase 7: Comprehension Test

Skeleton soundness ≠ flesh comprehensibility. Phase 7 closes the
build-verify loop with the lightest credible evidence that the
projection is legible to actual users — symmetric with Phase 4
(where 4 tests bones, 7 tests skin). Without it, the methodology
is asymmetric and ships sound skeletons users can't read.

Three diagnoses with three feedback paths when users can't
navigate: **flesh problem** → revise Phase 6; **skeleton problem**
→ revise Phase 3 (also the surest signal of "novelty for novelty's
sake"); **essence problem** → revise Phase 1. Misdiagnosis turns
the loop into mindless flesh iteration that drifts the skeleton.

Use `/reframe explain for <audience>` to generate the lowest-
fidelity test artifact directly — narration tier. Write under
`## Comprehension Tests` (append-only) using the verb-tagged format
`Date / Artifact / Users / Observation / Diagnosis / Feedback`. For
the four risk tiers, the graduation boundary, and detailed diagnosis
rationale, see `references/phase-guide.md`.

---

## Common traps

Five recurring anti-patterns surface across reframes — *new shoes
on old path*, *novelty for novelty's sake*, *premature flesh*,
*shapeless transfer*, *phantom primitives*. Each has a detection
method and a cure path back into the relevant phase.

These are diagnostic patterns, not phase-bound. The natural places
to check for them are Phase 4 (Stress Test) and Phase 7
(Comprehension Test), where the skeleton and its projection are
under test. See `references/traps.md` for the full catalog.

---

## How reframe relates to the other *-driven skills

Reframe is the most upstream of the methodology skills, operating
*before* the system has a settled shape. It pairs with **design-
driven** as predecessor (settled skeleton graduates into
`design/DESIGN.md` via `/reframe close`), runs **parallel to
goal-driven** on a different axis (shape vs destination), and
lightly overlaps **evidence-driven** at Phases 4 and 7 (claims need
falsifiable observations).

For the lifecycle diagram, full pairing details (including when
*not* to substitute design-driven for reframe), and handoff
mechanics, see `references/cross-skill.md`.

## When NOT to use this skill

- The domain has clear precedent in the new paradigm (follow the
  precedent; use design-driven instead).
- The change is incremental within an existing paradigm (design-
  driven).
- The user wants to *describe* a paradigm, not design within one
  (technical-article-writing).
- No specific domain — vague "let's build something AI native"
  without a target. Get the user to name the domain first; without
  a target there's no essence to extract.
