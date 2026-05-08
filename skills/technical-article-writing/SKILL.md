---
name: technical-article-writing
description: Methodology for writing argumentative technical articles — pieces that convince the reader of a specific claim through a chain of reasoning. Use when the user wants a technical article, essay, or book chapter that takes a position — introducing a new idea, challenging an accepted one, or arguing for a particular approach. Triggers on phrases like "write an article/essay/chapter about X," "make the case for X," "argue that Y," or structuring a multi-chapter argument about agents, architectures, systems design, or methodology. Do NOT trigger for tutorials ("how to do X"), reference or API documentation, release notes, changelogs, or pure explainers where no claim is being argued — those need a different framework.
argument-hint: "[topic | brief | revise <path>]"
---

# Technical Article Writing Methodology

A methodology skill for helping users write technical articles that build conceptual frameworks. The goal is to help the user produce content where readers are guided from familiar ground to a new idea through a chain of reasoning that feels inevitable rather than imposed.

This skill is about **how to write**, not what to write about. Apply it across topics ranging from agent architectures to system design to methodology essays.

## Arguments

| Argument | Behavior |
|----------|----------|
| (none) or free-form topic | Start a new piece — produce the Default first-response format (Phase 1–7 planning), then draft on approval. |
| `brief` | Produce only the Default first-response format scaffold (core idea, audience, reasoning chain, outline, style constraints) — stop before drafting. User reviews, then requests drafting. 想单看用户画像和 modulator 合成后的 effective voice spec，走 `/writing-profile show` 即可。|
| `revise <path>` | Run Phase 7's three revision passes + mechanical voice pass on an existing draft at `<path>`. Skip Phase 1–6. |

## Core Philosophy

A good technical article has three things going at once:

1. **A single core idea** that the whole article is building toward
2. **A chain of reasoning** where each step is the natural consequence of the previous one
3. **Calibrated detail** — enough to be concrete, little enough to not drown the reader

The most common failure is #2: facts presented in parallel rather than built into an argument. The piece reads as "here are five things about X" instead of "here is why X matters and what follows from it." The reader learns things but doesn't feel why any of it matters. The methodology below is designed to prevent that.

## Scope: what this skill is for

This skill is optimized for **argumentative technical writing** — articles, essays, or book chapters where the goal is to convince a reader of a specific claim through a chain of reasoning. It serves less well for:

- **Tutorials** — the goal is to help the reader do something, not believe something. Use a task-oriented structure instead.
- **Reference documentation** — fact catalogs organized for lookup, not for linear reading.
- **Retrospectives or field notes** — observations and reflections without a unified thesis.
- **Release notes, changelogs, API docs** — structure is dictated by the underlying artifact, not by an argument.

Before applying the methodology, check: does this piece have a claim someone could reasonably disagree with? If no, use a different framework — forcing argument structure onto non-argumentative writing damages both.

When a piece is a hybrid (e.g., a tutorial that also argues for a particular approach), apply this skill only to the argumentative spine and leave the instructional parts alone.

---

## Phase 1: Find the Core Idea

Before writing anything, help the user articulate the core idea in **one sentence**. Not a topic, not a scope — an actual claim.

### The one-sentence test

Push the user until they can finish this sentence: "The one thing I want readers to walk away believing is _______."

Weak answers:
- "I want to explain how Agent harness works" (topic, not claim)
- "I want to cover context management in Agents" (scope, not claim)

Strong answers:
- "Agent harness is fundamentally a context assembly machine, and dialogue as a context medium has a ceiling that current solutions are only patching over"
- "Type systems are not about catching bugs but about encoding domain invariants, and most teams use them wrong"

Strong answers have a **claim** that can be argued for and that someone could disagree with. If no one could disagree with the sentence, it's not a core idea — it's a topic.

### Test the idea with "so what"

Ask the user: "If a reader believes this sentence, what changes for them?" If nothing changes — no decision they make differently, no perspective they update — the idea needs sharpening.

### Identify the consequence

Great technical articles usually have a **consequence** that follows from the core idea. The layering methodology, the new framework, the redesign recommendation. If the user has a consequence in mind, note it — it will be the climax of the article. If they don't, ask whether they want the article to end on "here's the idea" or "here's what we should do about it."

---

## Phase 2: Build the Reasoning Chain

Once the core idea is clear, work backward to construct the reasoning chain that leads there.

### The reasoning chain method

Ask the user: "Starting from something the reader already believes or can see with their own eyes, what's the shortest chain of steps that forces them to conclude the core idea?"

Each step should be:
- **Small** — a single inferential move, not a leap
- **Forced** — given the previous step, this one is the natural next thought
- **Concrete** — grounded in something the reader can verify, not abstract assertion

Write the chain out as a numbered list before drafting any prose. For example:

```
1. LLMs are text predictors — they only see tokens and predict next tokens
2. To make them do tasks, you must feed task progress back as text
3. The natural way to do this is append-only message sequences (dialogue)
4. So Agents necessarily take a dialogue form
5. Tool calls are just special messages in the dialogue
6. Modern harnesses (Claude Code etc.) are entirely about managing this dialogue
7. But dialogue has a density problem — each message serves multiple roles
8. Patches (memory/compaction) don't fix the underlying problem
9. The fix is to stop treating dialogue as the context substrate
```

Each step sets up the next. If a step feels like a leap, insert a sub-step. If a step doesn't lead anywhere, cut it.

### Check for hidden assumptions

For each step, ask: "Does the reader already believe the thing this step relies on?" If not, that belief needs to be established earlier, or the step won't land.

---

## Phase 3: Structure the Document

Translate the reasoning chain into a chapter/section structure. The mapping isn't always 1:1 — sometimes one step needs a whole section, sometimes several steps fit in one section.

### Structural rules of thumb

- **One argument per section**. If a section is trying to make two points, split it.
- **Every section should earn its place**. If removing a section doesn't weaken the argument, it's a digression — cut or move to an appendix.
- **Put the hard work early**. Establish the core framing in the first 20-30% of the document. Everything after should be consequences and applications.
- **End sections with forward motion**. The last sentence of a section should make the next section feel necessary, not optional.

### Opening calibration

The opening must do two things at once:
1. **Anchor to something the reader already knows or can observe** (not an abstract claim)
2. **Plant a seed of the core idea** without revealing it

A good test: if you removed the opening, would the rest of the document feel like it has its feet on the ground? If not, the opening isn't doing its job.

### Title and first sentence

The title and first sentence together decide whether anyone reads the rest. Treat them as their own artifact — revise them separately, and revise them last, after the draft is stable enough that you know what you're actually promising.

- **The title** should promise the core idea's *consequence*, not summarize the topic. "Why dialogue is a ceiling for agents" over "A look at agent context management." Topics don't pull readers in; stakes do.
- **The first sentence** should land the reader on concrete ground with a small surprise — an observation they haven't quite made but immediately recognize. Avoid sweeping abstractions or definitional throat-clearing. "Every agent you've used is a dialogue in disguise" beats "In this article, we will examine agent architectures."

Test: read only the title and first sentence aloud, cold, as if you'd stumbled onto them. Would you keep reading? If not, rewrite before polishing anything downstream.

### Transition calibration

Transitions between sections are where most technical writing breaks down. Each transition should:
- **Summarize** what the previous section established (one sentence)
- **Introduce tension** that motivates the next section (one sentence)

If a transition is just "Now let's talk about X," the structure hasn't earned its next step.

---

## Phase 4: Calibrate Detail

The single biggest skill in technical writing is knowing what to include and what to leave out. The principle: **every detail must either support the reasoning chain or make it more vivid. Everything else is noise.**

### The detail test

For each concrete detail (version number, implementation specifics, benchmark number, anecdote), ask:
- Does removing this weaken the argument? If no, cut it.
- Does keeping this make the argument more vivid for a reader who doesn't already agree? If no, cut it.

### Breathing room

The detail test is necessary but not sufficient. Some details earn their place by giving the prose **texture** — a well-placed anecdote, a moment of dry humor, a deliberately concrete image. These aren't load-bearing for the argument, but they give the reader a place to rest between heavier moves.

The revised rule: every detail either supports the chain, makes it vivid, **or lets the reader breathe**. Keep one or two breathing moments per chapter where they genuinely land. Cut them if they pile up, become cute, or distract from the argument immediately around them.

Ruthlessness without breathing room produces efficient prose that no one wants to finish.

### Detail asymmetry

Not all parts of an article deserve equal detail. Heuristic:
- **High detail** on the parts closest to the core idea (where the argument is being made)
- **Low detail** on supporting context (where you're just establishing background)
- **No detail, just naming** for things that exist but aren't load-bearing for this article

For example, in an article whose core idea is about context layering, Claude Code's context management deserves detail because that's where the argument lives. Claude Code's permission system, while interesting, deserves one sentence — it establishes complexity without being load-bearing.

### Known-false-detail avoidance

For technical articles, factual errors destroy credibility. Before committing to specific technical claims (what a system does, what a tool supports, version-specific behavior), **verify**. When in doubt, use web search.

Fact tracking has two directions, both required:
- **Prospective**: when you state a claim you haven't independently verified, log it in the project brief's "Claims to verify" list (section 5a of `assets/project-brief-template.md`) the same day. Unverified claims that quietly accumulate in a draft are how factual errors ship.
- **Retrospective**: when an error is caught and corrected, record it in the brief's "Verified & corrected" list (5b) so the same mistake doesn't reappear later or in adjacent sections.

---

## Phase 5: Calibrate the Voice

Technical articles fail when the voice fights the content — but "the voice" is actually two voices composed: the user's baseline voice (stable across genres) and the technical-article genre bias (density, closure, hedge policy). Compose them first, then apply the failure-mode fixes.

### Load the effective voice spec first

Before touching any of the fixes below:

1. Read `~/.claude/writing-profile/profile.md` — the `## 坐标` YAML block and the `## 机械反 AI 清单`.
2. Apply the technical-article modulator from [references/voice-calibration.md](references/voice-calibration.md) — per-axis clamp/shift/amplify plus genre extras (`formality`, `pronoun_density`, `technical_density`, `hedge_floor`).
3. Note the resulting effective spec in the project brief (or hold it in working memory for single-session pieces). It informs drafting taste below and drives the mechanical revision pass in Phase 7.

If `profile.md` is absent, tell the user once — *"No writing profile found. Output will use generic defaults; run `/writing-profile` to calibrate."* — and proceed with genre defaults only. Don't auto-invoke the profile skill.

The shared framework (what the operations mean, apply order, fallback contract) lives in [../writing-profile/references/genre-adaptation.md](../writing-profile/references/genre-adaptation.md). The recipe specific to this genre lives in [references/voice-calibration.md](references/voice-calibration.md).

With the spec in mind, watch for these failure modes:

### Failure 1: Over-abstraction
Signs: "paradigm," "fundamental," "essentially," "leveraging," abstract nouns stacked on abstract nouns.
Fix: For each abstract term, ask "what's the concrete thing this points to?" Replace the abstract term with the concrete thing wherever possible.

### Failure 2: Over-flourishing
Signs: Heavy metaphors, clever analogies every paragraph, performative writing.
Fix: Cut metaphors unless they're doing load-bearing work. A single well-placed analogy is worth ten decorative ones. If you need a metaphor to explain something, that's fine — but if you're adding one because the prose feels bare, don't.

### Failure 3: Over-hedging
Signs: "It might be argued that," "one could say," "perhaps," "to some extent."
Fix: State claims directly. If a claim is contested, state it and then acknowledge the contest directly: "X is true. Some argue Y, but Z." Not "It could perhaps be argued that X might be the case."

### Failure 4: Flat rhythm
Signs: every sentence is roughly the same length; paragraphs all the same shape; no short punches between longer builds. The writing is technically correct and somehow exhausting.
Fix: after drafting a paragraph, glance at sentence lengths. If they cluster within a narrow band, rewrite to create variation.

Short sentences carry weight. Use them on the claim.

Long sentences carry nuance, accumulation, qualification — use them where the argument is building rather than landing. A short sentence after three long ones is often the difference between prose that reads and prose that slogs.

### Voice calibration for audience

Ask the user who the audience is, specifically. "Technical readers" is not specific enough. "Someone who has built a chatbot but has never worked on an agent" — that's specific. This shapes:
- Which terms need definition on first use
- Which concepts can be assumed
- How much scaffolding is needed between steps

When in doubt, err toward explaining. Assume the reader is smart but unfamiliar.

---

## Phase 6: Decide on Visuals

Not every article needs diagrams. Most articles need fewer than the author initially thinks.

### When to use ASCII diagrams

Use ASCII when:
- The relationship is structural (layers, flows, hierarchies) and needs to be precise
- The content is close to code (message formats, config files, data structures)
- You want the diagram to be inline and text-aligned with the surrounding prose
- You want it to be easy to edit as the article evolves

Examples of good ASCII use:
- Flowcharts for loops/processes
- Stack diagrams for context composition
- Comparison tables
- Timeline diagrams
- Simplified versions of concepts that also have AI-generated visuals

### When to use AI-generated images

Use AI-generated images when:
- You need visual density/color/proportion to make a point (ASCII can't express "how much of this is wasted space")
- The concept is abstract and needs a memorable visual anchor
- The image will be referenced across multiple places in the document (worth the investment)
- The first impression matters (opening of a chapter, cover image)

Limit AI-generated images to 2-4 per chapter. Each one should be load-bearing — the chapter is worse without it.

### When to use tables

Tables are the most-used visual in technical writing and the easiest to overuse.

Use a table when:
- You're comparing **3+ items across 2+ dimensions** (e.g., three frameworks on latency, memory, and maturity)
- The comparison is what the reader is supposed to take away — the structure *is* the point

Don't use a table when:
- You have **one dimension** (use a bullet list)
- You have **two items** to compare (use prose — "Unlike X, Y does...")
- The cells will be long paragraphs — tables punish the reader when they scan-and-find nothing short enough to anchor on

Keep cells terse. If a cell needs a paragraph, the table is the wrong container.

### When to use code walkthroughs

Code in a technical article is rarely meant to be run — it's meant to be *read as argument*. Calibrate accordingly:

- **Full code block**: when the reader needs to trace exact flow and every line matters. Rare. Reserve for the two or three moments where the argument *is* the code.
- **Annotated snippet**: a short excerpt with highlighted lines and surrounding prose explaining what each does. The default choice for showing how something works.
- **Prose description with inline `code` references**: when the shape matters but the syntax doesn't. Most of the time, this is enough.

Signs you're overshowing code: the reader is skipping your code blocks. Signs you're undershowing: the reader can't picture what the system actually looks like. Aim for the middle — enough code to ground the argument, not so much that it becomes a tutorial.

### When to skip diagrams

Skip diagrams when:
- The concept is fully conveyed by prose
- The diagram would just restate the text
- The relationship is sequential and simple (just write it as prose)
- You're tempted to add a diagram because the section "feels text-heavy" — that's not a reason

### Inventory exercise

When the draft is stable, walk through the document and for each potential visual location, classify: ASCII, AI-generated, or none. Batch the AI-generated ones — commission them together for visual consistency, after the text is finalized.

---

## Phase 7: Revise

First drafts serve the writer. Revision serves the reader. Budget at least as much time for revision as for drafting — often more. Most of the craft lives here.

### Three passes, in order

Revise from structure down to sentences, never the other way around. Polishing a sentence in a paragraph you're about to cut is wasted work.

**1. Structural pass — does the chain still hold?**

Read only the section headings and the first sentence of each section. If that "skeleton read" doesn't convey the argument, the structure is broken — fix it before touching any prose. Questions to ask:
- Does each section earn its place? (If removing it leaves the argument intact, cut it.)
- Is any section doing two jobs? (Split it.)
- Do transitions land? (The last sentence of one section should make the next feel necessary.)

**2. Paragraph pass — does each paragraph earn its place?**

For each paragraph: what does it establish? If you can't answer in one clause, cut or merge it. Watch for:
- Paragraphs that restate the previous one with different words
- Throat-clearing openings ("It's worth noting that...", "One thing to consider is...")
- Paragraphs that could be collapsed into a single sentence

**3. Sentence pass — rhythm, weight, concrete language.**

Apply Phase 5 at the sentence level. Vary sentence length. Replace abstract nouns with the concrete things they point to. Cut hedges. Read passages aloud — if you stumble, the reader will too.

**3a. Mechanical voice pass — run after prose-level revision.**

With the draft otherwise clean, execute the voice spec from Phase 5 mechanically, in order:

1. **Profile's `机械反 AI 清单` (from `~/.claude/writing-profile/profile.md`)** — user-specific, always wins first. 必删 → delete, 必审查 → flag-and-rewrite, 保留 → leave even if it looks odd.
2. **Technical-article mechanical list (from [references/voice-calibration.md](references/voice-calibration.md))** — genre-universal additions (cut "本文将探讨...", "值得注意的是", "综上所述"; audit "Moreover / Furthermore / 此外" paragraph openers and hedged section endings).
3. **Axis spot-check** — pick sentence-length distribution (`D_L`), hedge count (`T_F`), first-person ratio (`E_I`). If a whole section trends hard against the user's preference on any of these, flag for rewrite.

If no profile exists, skip step 1 but still run steps 2 and 3.

### Cutting without losing

Target: 20–40% shorter than the first draft. Most technical drafts are substantially bloated on pass one; reaching this target usually makes the piece *stronger*, not weaker.

Safe cuts:
- Anything the reader could infer from context
- Transitional filler ("Moreover," "In addition," "That being said,")
- Examples that only prove a point already proven by a previous example
- Caveats for cases that aren't load-bearing for this argument

When unsure, cut and see if the piece feels damaged. Restoration is easy; noticing bloat is hard.

### When you're done

Two stop criteria:
- You can read the draft cold without flinching at any passage
- Further edits start costing the voice rather than improving clarity

If you hit the second before the first, ship anyway. Perfectionism beyond this point produces diminishing returns and can sand off what made the piece worth reading.

---

## Working With the User

### Always propose before drafting

For any significant change — new section, restructuring, new chapter — propose the plan before writing. Users consistently prefer "here's what I'm going to do, does this look right" over "here's 2000 words, what do you think."

Propose in structural terms:
- What will this section establish?
- How does it connect to what came before?
- How does it set up what comes next?

### Default first-response format

When the user brings a new piece (not mid-draft work), produce this before writing any prose. Keep it under one page.

1. **Core idea** — one sentence, filling "the reader walks away believing ___"
2. **Audience** — who specifically, not "technical readers" ("someone who has built a chatbot but has never worked on an agent" is specific)
3. **Consequence** — what changes for the reader if they believe the core idea (decision, perspective shift, redesign recommendation)
4. **Reasoning chain** — 5–8 numbered steps, from familiar to new (Phase 2)
5. **Section outline** — headings with one-line descriptions (Phase 3)
6. **Style constraints** — effective voice spec (baseline from `~/.claude/writing-profile/profile.md` + technical-article modulator from `references/voice-calibration.md`), voice rules, avoid-list, audience-specific choices (Phase 5). If no profile exists, note that and use genre defaults.
7. **Open questions** — what you need from the user before drafting

If the user has already locked in some fields, skip them and note which were provided. If fields are partially filled, mark them tentative and flag them in "Open questions."

**Why a fixed format**: without a contract, different agents (and different sessions with the same agent) freelance on what to propose first — the user ends up re-scoping the piece every session. A fixed format locks the skeleton in one review-able artifact. It costs ~5 minutes to produce and prevents hours of rework from drafting on a shaky foundation. Even if the user says "just draft it," produce this first — showing the skeleton is faster than arguing about it after 2000 words.

### Hold the line on structure

Users will often make local suggestions that are good in isolation but break the reasoning chain. When this happens, point it out:

> "That detail is interesting, but it would break the chain between step 3 and step 4 — it introduces a concept the reader doesn't have yet. Should we defer it to section X, or should I restructure the chain to accommodate it?"

Don't just silently incorporate feedback that damages the structure.

### When the user pushes back on facts

If the user corrects a factual error, immediately:
1. Fix it in the current draft
2. Add it to the project brief's "known factual constraints"
3. Audit the rest of the draft for related errors (the same mistake often appears in multiple places)

### When the user is uncertain about direction

If the user isn't sure which way to take something, offer 2-3 framed options with trade-offs:
- Option A prioritizes X but sacrifices Y
- Option B prioritizes Y but sacrifices X
- Option C is a hybrid

Don't ask "what do you want?" when you can ask "which of these directions fits best?"

---

## Multi-session continuity (operational)

This is operational hygiene, not writing craft — skip it on standalone short pieces. For multi-chapter or multi-session work, maintain a project brief that another writer (or another AI agent) could read to get up to speed in 5 minutes. This document is for **continuity**, not for the reader.

The brief plays the same role for a writing project that architectural design docs play for a code project — an artifact that survives beyond any single session so successive agents stay aligned. (Setting up this kind of succession artifact for a codebase is what the `harness` and `design-driven` skills are for.)

### Creating the brief

Use the template at `assets/project-brief-template.md` — copy it to the project directory (e.g., `BRIEF.md` alongside the draft) and fill in the fields as they get locked in. The template covers: core idea, reasoning chain, structure, style constraints, fact hygiene (claims pending verification + verified facts), terminology conventions, hidden throughline, and open questions.

### When to update the brief

Update the brief whenever:
- A factual error is corrected (add to known factual constraints)
- A terminology choice is made (add to conventions)
- The user pushes back on a style decision (add to style constraints)
- The structure shifts (update section list)

The brief is a living artifact. It's more valuable at the end of the project than at the beginning — treat each update as cheap insurance against the next session losing context.

---

## The Process at a Glance

A typical full workflow:

1. **Check scope** — is this actually argumentative writing? If not, use a different framework.
2. **Capture** the topic and the user's motivation — why write this?
3. **Extract the core idea** via the one-sentence test
4. **Build the reasoning chain** — numbered steps from familiar to new
5. **Propose structure** mapping chain to sections, including title and first sentence
6. **Compose the voice spec** — load `~/.claude/writing-profile/profile.md`, apply the technical-article modulator from `references/voice-calibration.md` (Phase 5)
7. **Set style constraints** — audience, voice rules, avoid-list (derived from the voice spec)
8. **Draft section by section**, proposing each before writing
9. **Calibrate detail** at each section — cut what doesn't support the chain
10. **Plan visuals** once the draft is stable
11. **Revise** in three passes: structural → paragraph → sentence, then the mechanical voice pass (profile's 机械反 AI 清单 + genre mechanical list). Most of the craft lives here.
12. **Maintain the brief** throughout multi-session work, update as things lock in.

The order isn't rigid. Sometimes the core idea only becomes clear after drafting two sections. Sometimes the reasoning chain shifts when the user pushes back. The skill is in knowing which phase to return to when something isn't working.

---

## Common Failure Modes and Fixes

**Symptom: The article feels like a list of facts, not an argument.**
Fix: You're missing the reasoning chain. Return to Phase 2. The reader should feel pulled forward, not pushed through a catalog.

**Symptom: The reader says "so what?"**
Fix: The core idea isn't sharp enough or the consequence isn't stated. Return to Phase 1.

**Symptom: The article is too long.**
Fix: Usually a detail calibration problem. Walk through each paragraph asking "does this support the chain?" Cut ruthlessly.

**Symptom: The reader is confused about a specific concept.**
Fix: Either a hidden assumption (Phase 2) or insufficient scaffolding for the audience (Phase 5).

**Symptom: The user keeps rewriting sections after you draft them.**
Fix: You're drafting without enough alignment. Propose structure and intent before writing.

**Symptom: Factual errors keep appearing.**
Fix: The project brief isn't being maintained. When an error is caught, add it to the brief immediately and audit the rest of the draft.

**Symptom: The prose is efficient but flat — the reader gives up halfway.**
Fix: Phase 4's breathing-room rule and Phase 5's rhythm guidance. Efficient isn't the same as readable.

**Symptom: Revision feels endless.**
Fix: Apply Phase 7's two stop criteria. Past the second, you're damaging more than you're improving.

---

## Final Notes

Most of your value lives in Phase 1, Phase 2, and Phase 7 — find the idea, build the chain, revise hard. Get those right and the rest follows. If you're tempted to skip to drafting before the one-sentence core idea is locked in, stop.
