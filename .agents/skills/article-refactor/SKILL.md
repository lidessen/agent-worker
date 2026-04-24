---
name: article-refactor
description: Methodology for refactoring existing articles or drafts using a code-refactoring metaphor — extract the information units (facts, claims, examples, metaphors) from the source into a neutral inventory, rewrite the top-level skeleton for a new thesis or audience, then inline the extracted units at appropriate sites with expansion, compression, or transformation as needed. Use when the user wants to restructure one or more existing pieces, merge multiple drafts into a new article, repurpose content for a different audience, or salvage material from old writing. Triggers on phrases like "重构这篇文章", "把这几篇合并改写", "用这些素材重写一篇", "这篇骨架我想换但素材想保留", "把旧博客整理重写", "refactor this article", "restructure this draft". Do NOT trigger for writing from scratch with no source material (use technical-article-writing) or for light polish that preserves structure (use technical-article-writing's `revise`).
argument-hint: "[<source-path>... | extract <path> | skeleton | inline]"
---

# Article Refactor Methodology

Refactor articles the way you refactor code. The source text is a monolith — tangled concerns, duplicated logic, dead code, and utility functions waiting to be extracted. The move is: pull content out into a neutral inventory, rebuild the top-level structure for the new purpose, then wire the extracted pieces back in at the right sites with the right treatment.

This skill handles heavy restructures that preserve content but change the shape of the argument. For writing from scratch, use `technical-article-writing`. For light editing that keeps structure intact, use `technical-article-writing`'s `revise`.

## The code → article metaphor

| Code concept | Article analogue |
|---|---|
| Utility function | A reusable info unit (fact, definition, metaphor) |
| Business function | A reusable argument or worked example |
| Function signature | What a unit claims, stripped of prose |
| Call site | Where a unit appears in the article |
| `main()` / top-level logic | Article skeleton — thesis + reasoning chain + sections |
| Extract function | Pull a unit out into the inventory |
| Inline | Dissolve a small unit back into surrounding prose |
| Rename | Update terminology across all uses |
| Dead code | Material that served the old draft but isn't load-bearing for the new one |
| Interface vs implementation | What a section needs (interface) vs how the prose delivers it (implementation) |

Use this vocabulary when talking to the user — it keeps decisions concrete.

## When to use this skill

Appropriate:
- One or more existing drafts or published pieces the user wants restructured
- Merging several articles or notes into one new piece
- Same material, new audience or new core idea
- Salvage — "I wrote 4000 words but the structure is wrong"

Not appropriate:
- No source material — use `technical-article-writing`
- Polish-level edits that preserve structure — use `technical-article-writing`'s `revise`
- Reference docs or tutorials — their structure is dictated by the artifact, not by an argument

## Arguments

| Argument | Behavior |
|---|---|
| (none) | Ask for source paths, then run all phases interactively |
| `<path>...` | Start extraction from these source files, run all phases |
| `extract <path>` | Run only Phase 1 — produce `INVENTORY.md` and stop |
| `skeleton` | Run only Phase 2 — assumes inventory exists |
| `inline` | Run only Phase 3 — assumes inventory and skeleton exist |

Phases are sequential. Each phase produces a durable artifact that lives alongside the target draft so later sessions can pick up from there.

**Naming convention**: every artifact is prefixed by the target draft's stem so they travel together. The target draft is the anchor; in a multi-source merge it's the planned output file, not any one source.

| Artifact | File | Produced in |
|---|---|---|
| Target draft | `<draft-name>.md` (e.g., `agent-harness.md`) | Phase 3 (starts as stub) |
| Info inventory | `<draft-name>-INVENTORY.md` | Phase 1 |
| Skeleton + wiring | `<draft-name>-SKELETON.md` | Phase 2 |
| Project brief (optional, multi-session only) | `<draft-name>-BRIEF.md` | Anywhere, if needed |

If new artifact kinds come up, follow the same `<draft-name>-<KIND>.md` shape. Keeps them grep-able and makes it obvious which piece they belong to.

---

## Phase 1: Extract

Read the source end-to-end first. Then walk it a second time, pulling out atomic information units. The goal is a library of self-contained pieces that each make sense without the original article around them.

### What counts as an atomic unit

One unit = one thing the reader is supposed to learn, notice, or accept. Good units are:
- **Small enough** to have one responsibility — a single claim, a single example, a single definition
- **Self-contained** enough to be understood outside the original surroundings
- **Neutral** — stripped of the source's rhetoric so the content can be re-styled for a new context

Common unit types:

- **fact** — verifiable claim, number, version, event
- **claim** — an assertion with reasoning behind it
- **example** — a concrete case illustrating a point
- **metaphor** — a figure of speech doing explanatory work ("dialogue is a ceiling")
- **definition** — what a term means in this context
- **anecdote** — a story the author tells
- **reasoning step** — a logical bridge from A to B
- **quote** — a citation from another source

### Record information, not expression

A unit captures *what's in it* (the facts, relationships, mechanisms, numbers, definitions), **not how the source phrased it**. Don't preserve sentences. Don't preserve rhetoric. Phrasing is rebuilt at inline time to fit the new context, audience, and voice — trying to carry the source's expression forward only contaminates the rewrite.

Think of a unit as structured data for a future sentence, not the sentence itself. Where the source has a paragraph, the unit has bullets. Where the source has a rhetorical build, the unit has a relationship diagram in words. Where the source has an anecdote, the unit has the underlying shape: who, what, tension, resolution, what it illustrates.

Example. Source passage:

> "But of course, as anyone who has tried scaling a real agent will tell you, every message in the dialogue ends up doing too many jobs at once — and this is precisely where the wheels come off."

As a unit — information only, no expression:

```
U-007 · claim: dialogue ceiling from message-role overload
  - phenomenon: dialogue-based agents degrade as scale increases
  - mechanism: each message must serve multiple roles simultaneously
  - roles mixed in one message: addressing, state, reasoning payload, tool I/O
  - framing in source: treated as obvious to practitioners
```

That's a data sheet. At inline time, this can be re-expressed as a dry assertion, a rhetorical build, a diagram, a one-liner — whatever the new section calls for.

Red flag: if you can drop a unit's content into the draft with only minor editing, the unit is carrying expression, not information. Rewrite it until it can no longer function as prose on its own.

### Inventory template

Each unit:

```markdown
## U-001 · {type}: {short name}

**Info**:
- {fact / relationship / mechanism / number / constraint}
- {fact / relationship / mechanism / number / constraint}
- ...

**Source**: {file}§{section or anchor}
**Original role**: {what the source article used this for}
**Notes**: {alternates, caveats, pitfalls — never prose phrasing}
```

Keep IDs stable across sessions — Phases 2 and 3 reference them.

### Dedup and rename while extracting

If two source passages say the same thing in different words, merge them into one unit and record both source anchors. If the source uses inconsistent terminology for the same concept, pick the canonical name in the inventory and flag the alternates in `Notes`.

### Stop condition

You're done when the article can't be reconstructed from the inventory alone — that's correct. The inventory holds the *content*; the prose and structure are intentionally left behind, because they're what you're about to rebuild.

---

## Phase 2: Reskeleton

Rebuild the top-level logic. This is where the new article is designed — its thesis, audience, reasoning chain, and section structure. The inventory doesn't drive structure; the new core idea does.

### Delegate to technical-article-writing

The mechanics of finding a core idea, building a reasoning chain, and structuring sections are covered by `technical-article-writing`'s Phases 1–3. Run those phases now. Do not re-derive them here — invoke that methodology on the new piece.

Common outputs:
- Core idea (one sentence, falsifiable claim)
- Audience (specific, not "technical readers")
- Reasoning chain (numbered steps from familiar to new)
- Section outline with one-line descriptions

### Wire section interfaces to units

Once the outline is stable, add one step specific to refactoring: for each section, list the **unit types or specific unit IDs** it needs. This is the section's "interface" — what info it expects to receive at inline time. Persist the whole skeleton + wiring to `<draft-name>-SKELETON.md`.

```markdown
### §2: Why dialogue is a context substrate
- Needs: U-001 (substrate definition), U-003 (historical claim), U-005 (example)
- Optional: U-012 (metaphor — use if the opening feels thin)
- Gap: no unit yet for the counter-argument — write during inline or cut scope
```

This turns Phase 3 into mechanical wire-up instead of a creative scramble.

### Flag dead code, don't delete yet

If the inventory contains units that don't appear in any section's needs list, list them as "not wired" and revisit at the end of Phase 3. Sometimes an orphaned unit earns a place once drafting begins. If still unused after inline, archive — don't force-fit.

---

## Phase 3: Inline

Wire the inventory into the skeleton. For each section, walk its "needs" list and decide how each unit enters the prose. The question is never "paste this unit here" — it's "how should this unit land in *this* context?"

### Five inline operations

**Expand** — the source compressed this unit; the new context needs more.
Example: a throwaway reference in the original becomes the paragraph the new argument pivots on.

**Compress** — the source was verbose; the new context only needs a gloss.
Example: a three-paragraph anecdote becomes a single clause.

**Transform (化用)** — keep the content, change the framing.
Example: an academic-flavored claim gets reframed as a conversational observation; a rhetorical question becomes a direct assertion; a metaphor gets re-cast in an image that fits the new audience.

**Combine** — two units fuse into one treatment.
Example: U-003 (fact) and U-005 (example) are best delivered as a single sentence where the example illustrates the fact.

**Inline-dissolve** — the unit is too small to earn its own paragraph; it disappears into surrounding prose.
Example: a definition becomes a dependent clause inside another sentence.

**Gap** — the section needs something the inventory doesn't have.
Two responses: write a new unit (and add it to the inventory) or scope the section back to what the inventory actually supports. Don't paper over a gap with filler.

### Rename consistently

If the new piece uses different terminology than the source, rename everywhere — inventory included, so future sessions don't get confused. Keep a "terminology mapping" note in the inventory when the rename is non-trivial.

### Track coverage

As each unit is inlined, mark it with the section ID in the inventory (e.g., `Used in: §2`). At the end:

- **Used where needed**: done.
- **Unused units**: reconsider once — any of them actually load-bearing? If not, archive.
- **Gaps filled with new units**: add them to the inventory before closing the project.

### Hand off to revision

Once inline is done, the draft is a first pass, not a finished piece. Hand off to `technical-article-writing`'s Phase 7 revision (structural → paragraph → sentence → mechanical voice). The refactor gets content into the right shape; revision makes it read well.

---

## Working with the user

### Surface the inventory before drafting

After Phase 1, show the user the inventory and ask: "Is this the set of things worth salvaging? Anything missing? Anything here that's actually dead?" Users often spot missing units or notice ones they never liked.

### Propose the skeleton before inline

After Phase 2, show the section outline with the "needs" wiring. This is the last cheap moment to restructure. Once inline begins, structural changes get expensive.

### Hold the line when inline pressure pushes back on the skeleton

During Phase 3 you'll sometimes find that a section's needs list doesn't quite land — units resist the intended role. Two responses:
- **Local fix**: adjust how units are transformed/combined. Preferred.
- **Structural fix**: return to Phase 2, adjust the section. Do this only when the local fix would require distorting content.

If you find yourself repeatedly adjusting the skeleton to accommodate units, the skeleton is wrong — stop inlining and redesign.

### Don't let the inventory become a draft

Most common failure: the inventory gets written in article voice. Then inline is just copy-paste and the new piece inherits the old voice. Keep the inventory neutral. Prose lives in the final draft, not in the inventory.

---

## Common failure modes

**Symptom: The refactored piece reads like the original with sections shuffled.**
The inventory was recorded in source voice. Transform never happened. Re-extract with stricter neutrality.

**Symptom: Units are too big — each one is basically a section.**
Wrong granularity. Split until each unit holds one responsibility.

**Symptom: Section "Needs: ..." entries are vague ("needs some examples").**
Skeleton is underspecified. Name unit IDs concretely or mark the section speculative until it can be specified.

**Symptom: A lot of inventory goes unused.**
Either the source was bigger-scope than the new piece (fine, archive) or the new skeleton is avoiding the strongest material (problem — revisit Phase 2).

**Symptom: Gaps keep appearing during inline.**
Phase 2 was over-optimistic about what the inventory could support. Either scope the new piece smaller or budget new-unit writing into the refactor.

---

## Relationship to other writing skills

- Designing the new article's thesis and structure — `technical-article-writing`'s Phases 1–3 handle this. Invoke during Reskeleton rather than re-deriving.
- Calibrating voice and revising the final draft — `technical-article-writing`'s Phases 5 and 7 handle this. Inline produces a first draft; revision produces the shipped piece.
- User-specific voice profile — if `~/.claude/writing-profile/profile.md` exists, revision honors it through `technical-article-writing`.

The split: this skill owns content deconstruction and reassembly. `technical-article-writing` owns argumentative structure and prose craft. They compose.
