# Cross-skill positioning

How reframe relates to design-driven, goal-driven, and evidence-
driven. SKILL.md keeps a brief mention; the frontmatter description
already has a "Pairs with" summary for trigger disambiguation. This
reference holds the full lifecycle picture and detailed pairing
descriptions.

## The lifecycle stack

Reframe is the most upstream of the methodology skills — it operates
*before* the system has a settled shape:

```
[concept layer]   reframe          ← shape not yet decided
                    │ (settled)
                    ▼
[structure layer] design-driven    ← shape decided, architecture maintained
                    │
                    ▼
[execution layer] evidence-driven  ← discipline overlay during implementation

  vertical: goal-driven runs in parallel as the destination compass
```

Reframe only enters a project's stack when the team is in unsettled
paradigm territory. Once `/reframe close` graduates the skeleton
into `design/DESIGN.md`, the stack reverts to the three core layers
(strategy / architecture / execution) and reframe steps out.

## Pairings

### Pairs with design-driven as predecessor

When a concept's skeleton settles (Phase 4 stress tests *and*
Phase 7 comprehension tests both pass), `/reframe close` graduates
it into `design/DESIGN.md`. Reframe is the *pre-architectural
sketchbook*; design-driven is *post-settlement architecture*.

**Don't substitute design-driven for reframe in unsettled
territory.** Design-driven assumes a shape exists to be documented.
If the shape itself is the question — because no industry precedent
exists — DESIGN.md will be premature and will lock in a traditional
skeleton dressed in new vocabulary. This is the most common failure
of teams that skip reframe: they jump to design-driven, codify a
traditional shape, and then can't change it because everything
downstream depends on it.

The signal that it's safe to graduate to design-driven: stress
tests have stopped revealing skeleton problems for several rounds,
and at least one comprehension test has shown users navigating the
projected flesh without prompting. Until then, stay in reframe.

### Pairs with goal-driven as parallel companion

Goal-driven manages "why and how far" (destination); reframe manages
"what shape in a new paradigm". Different axes — neither subsumes
the other. A multi-month initiative in unsettled territory often
uses both: `GOAL.md` for destination, `concepts/<target>.md` for
shape. They reference each other but neither depends on the other.

When both are running:
- A criterion in `GOAL.md` might depend on a Phase outcome in the
  concept doc ("C2 met" might require Phase 7 to show users
  understand the new flow).
- A reframe pivot (essence revision via Phase 7 diagnosis) might
  trigger a goal-driven STOP if it changes what "done" means.
- The concept doc graduates via `/reframe close` while goal-driven
  keeps running — the goal compass outlives the reframe.

### Light overlap with evidence-driven

Phase 4 stress tests and Phase 7 comprehension tests both borrow
evidence-driven discipline (don't claim "skeleton holds" or "users
understand it" without a falsifiable observation). But reframe is
primarily conceptual exploration, not execution discipline —
evidence-driven earns its keep later, during implementation of the
settled skeleton.

When both are installed, the concept document's Stress Tests and
Comprehension Tests entries should follow evidence-driven's rule:
every verdict cites an observation that could have shown the
opposite. Captured observations carry forward when the concept
graduates — they become the seed for the blueprint's Verification
section.

Handoff direction is always concept → design → evidence → code.
Evidence-driven doesn't read or write `concepts/` files; it raises
the signal-to-noise ratio of verdicts inside them.

## When reframe is the wrong tool

Even in apparently new-paradigm territory, reframe is the wrong tool
if:

- **The domain has clear precedent in the new paradigm.** Follow
  the precedent; use design-driven directly.
- **The change is incremental within an existing paradigm.** Use
  design-driven; reframing what doesn't need reframing wastes
  cycles.
- **No specific domain.** "Let's build something AI native" without
  a target gives Phase 1 nothing to extract from. Get the user to
  name the domain first.
- **The user wants to *describe* a paradigm, not design within
  one.** Use technical-article-writing instead.
