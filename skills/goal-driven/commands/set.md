# goal-driven:set — Interview-driven GOAL.md

Create or refresh `goals/GOAL.md` and the plumbing around it. The
interview is the heart of the first run; subsequent runs are
**update mode** — refreshing scaffolding, sibling integration, and
the CLAUDE.md block without re-interviewing for the goal itself.

The interview is the whole point on first run. Do **not** draft GOAL.md
alone in your head, ask "approve?", and write the file. Section by
section, asking, echoing, getting confirmation, then moving on. The point
is that the human ends up owning the compass — the agent is the writer,
not the author.

Work in four phases: **Prepare → Interview → Draft → Wire up**. In
update mode, skip Phase 2 and Phase 3 (GOAL.md already exists and stays
human-owned); run Phase 1 detection and Phase 4 wire-up only.

## Phase 1 — Prepare

### 1.1 Detect run mode

Look at `goals/GOAL.md`:

- **First-run** — file missing or only stub content. Run all four
  phases. Tell the human: "Setting up goal-driven for the first time;
  I'll interview you for the goal."
- **Update** — file exists with real content. Tell the human: "Goal
  already set; re-running `set` will refresh the scaffolding, sibling
  integration, and CLAUDE.md block — won't touch GOAL.md or records.
  Want a redo from scratch instead? (rare — usually `/goal-driven
  review` is what you want for re-assessment.)"

  Default behavior in update mode: skip interview/draft phases, jump to
  Phase 1.2 (sibling detection) → Phase 4 (wire-up). Only redo from
  scratch if the human explicitly asks; if so, archive existing
  `goals/GOAL.md` to `goals/GOAL.archived-YYYY-MM-DD.md` and proceed
  as first-run.

### 1.2 Detect installed sibling skills

Scan for sibling methodology skills already wired into this project. The
results inform both the interview (Phase 2) and the agent-config block
written in Phase 4.

| Sibling | Detection signal |
|---|---|
| design-driven | `design/DESIGN.md` exists, OR any agent config file (see Phase 4.2 list) contains `<!-- skill:design-driven -->` block |
| evidence-driven | Any agent config file (see Phase 4.2 list) contains `<!-- skill:evidence-driven -->` block, OR pre-commit hook references evidence-driven |
| reframe | `concepts/` directory exists with at least one `.md` file, OR any agent config file contains `<!-- skill:reframe -->` block |

Note which siblings are present. No action yet — used in later phases.

### 1.3 Surface what's already known

If there's prior context — `README.md`, project notes, prior conversation,
emails, an existing scratch document, and (especially) `design/DESIGN.md`
if design-driven is installed — read it. The interview is faster when
the agent can ask "I see in your notes / design that X — is that the
north star, or a means to it?" rather than starting blank.

If the project is new with no prior writing, skip this; start the
interview from zero. (Update mode skips this section entirely.)

## Phase 2 — Interview

(First-run only. Skip in update mode.)

Four sections, drawn out one at a time and confirmed before moving on.
Phrasing is the agent's; the descriptions below are *why* each section
matters and *what good answers look like*. The interview's value is the
human's commitment to the wording — a draft the agent wrote and the
human nodded at is not the same as a wording they confirmed.

**If design-driven is installed** (per Phase 1.2 detection), use
`design/DESIGN.md` as the starting context — modules, invariants, and
non-goals there are clues to the goal's shape. Don't import them
verbatim; ask the human whether each is goal-level (compass) or
shape-level (already owned by design-driven). The interview narrows
faster when it can react to existing artifacts instead of starting
blank.

### 2.1 General Line — what should be true when this is done

Extract one or two sentences describing the world-state at success, not
the activity that produces it. The exact phrasing matters: every future
criterion check, every STOP, every review reads back to this sentence.

Failure modes to push back on:
- **Activity description** ("build a semantic search system") — that's a
  means, not an end. Push toward what it enables.
- **Vague aspiration** ("improve search") — push toward who, how, by what
  measure.

Echo the wording back before moving on; if the human edits, echo the edit.
Don't move on until they say yes.

### 2.2 Success criteria — how you'd know it's done

Extract 2–5 falsifiable statements with how each is measured. Soft
answers ("users like it", "fast enough", "we learn enough") hide what
counts; push each toward something observable. The shape of the
follow-up question is "turn the feeling into a measurement": *like-it-how*
becomes daily-active count or survey score or repeat usage; *fast-enough*
becomes a P95 number; *learn-what* becomes a specific question we'd be
able to answer that we can't now.

If a criterion is genuinely soft (e.g., "the team feels less burned
out"), require a paired proxy — oncall pages per week, voluntary
overtime hours, a self-report at end-of-week. A criterion without a way
to observe it is decoration; either find a proxy or cut it.

Number criteria stably as `C1, C2, C3, ...`. **IDs are never reused** —
if C2 is later retired, C2 stays as retired in GOAL.md; new ones become
C5, C6. This keeps old record entries' references resolvable.

Echo each criterion back with its measurement, one at a time, before
adding the next.

More than 5 criteria is usually a sign that some are path-level (how)
rather than goal-level (what). Push back on bloat — it weakens the compass.

### 2.3 Invariants — what must stay true regardless of path

Extract 0–4 non-negotiables that hold every step of the way, not just at
the end. Invariants differ from criteria: criteria are achieved by the
end; invariants must hold throughout. Violating an invariant is a STOP
signal even if criteria are on track.

Common patterns to prompt with when the human draws a blank: data
boundaries ("user data stays local"), process rules ("no weekends"),
scope walls ("only contracted work"), quality floors ("test coverage
doesn't drop").

If design-driven is installed and `design/DESIGN.md` lists invariants
or non-goals at the architecture layer, surface them: "DESIGN.md says
*<invariant>* — should this also be a goal invariant, or is it
purely shape-level?" Goal invariants are about the initiative's
direction (the project must always X); design invariants are about
the system's structure. Same words, different scope — keep them
separate, but cross-check.

Past 4 invariants, some are probably criteria or non-goals in disguise.

### 2.4 Non-goals — the forbidden zones

Non-goals draw a perimeter: types of work that, even when tempting, this
initiative will not pursue. They are **scope boundaries, not inverted
goals.** The job of a non-goal is to pre-empt scope creep — when someone
later argues "but it would be *great* if we also did X", the non-goal is
the answer that has already been thought through.

**The single most common failure: non-goals that are just goals
restated in the negative.** "We want fast search → non-goal: slow
search." That delimits nothing — nothing realistic was tempting in that
direction. A real non-goal names *something an honest reviewer might
lobby for* and then declines it, with a reason.

Pressure-test each candidate with this question: *"If we did this,
would we be doing the **wrong work**, or just **less of the right
work**?"* Wrong-work items belong in non-goals. Less-of-the-right items
belong in prioritization or as stretch notes — not in GOAL.md.

Anti-pattern → fix:

- "Don't ship a buggy product" — inverted goal; cut.
- "Not for casual users" — too abstract. Turn it into a forbidden
  scope: "No beginner onboarding flow this round; ships only for users
  who already know the domain."
- "Avoid scope creep" — meaningless. Name the specific creep: "No
  generic policy platform across BUs — this initiative ships for one
  BU's needs only."

Common shapes that produce real non-goals:

- **Adjacent platforms tempting to re-implement.** "We don't build our
  own agent runtime — we integrate with existing frameworks." A
  reviewer who thinks runtime ownership matters hits this line and
  knows the trade-off was already weighed.
- **Adjacent users we won't serve in this iteration.** "No multi-tenant
  isolation; single-tenant only this round."
- **Possible 'phase 2' features that will get lobbied for.** Name as
  non-goals, not 'later goals'. 'Later' converges with 'now' under
  pressure; 'forbidden, with a reason' doesn't.
- **Metrics / outcomes that will rise as side effects.** Don't pretend
  they're the goal: "Not optimizing for DAU — retention is the target;
  DAU may move but isn't measured."
- **Replacing systems we should integrate with.** "We don't rewrite
  CRM/ticketing/IM — only integrate via tools."

Most humans first say they don't have any non-goals. They do; they just
haven't named them. Prompt with: *"Is there work an outsider would
suggest you should also do, that you've already decided against? Why?"*
Then run candidates through the wrong-work / less-of-right test before
accepting them.

Echo each non-goal back **with the reason it's out of scope**, not just
the name; confirm. A non-goal without a reason rots into a question mark
the next time someone lobbies for it.

## Phase 3 — Draft

Now, and only now, write `goals/GOAL.md` using the format in
`../references/templates.md`. The file is just a transcript of what the
human confirmed in the interview, structured. No new claims should appear
in the file that didn't come from the interview.

After writing, show the file in chat: "Wrote `goals/GOAL.md`. Final
version below — say if anything looks off."

This is a final check, not a review — by Phase 3 the content has been
confirmed three times (during interview, during echo, as you wrote). The
final read catches typos and ordering issues, not substance.

## Phase 4 — Wire up

This phase runs in **both** first-run and update mode. It's idempotent:
each step does nothing if state is already current, or refreshes
otherwise. Re-running `/goal-driven set` on a project that's already set
up is the supported way to refresh the CLAUDE.md block after siblings
get installed or removed.

### 4.1 Ensure plumbing exists

If missing (idempotent — skip what's already there):

- `goals/` directory
- `goals/record.md` (single record file, heading only)

Don't create `OPEN-STOPS.md` or monthly-rotation files now; they're
added later when project volume or open-STOP count makes them
load-bearing. See SKILL.md "Structure follows need."

### 4.2 Write the agent-config block (idempotent)

Goal-driven owns a delimited block in every AI agent config file the
project uses. The markers make the block re-runnable: on update, replace
between the markers; on first run, append the block.

**Marker convention:**

```
<!-- skill:goal-driven -->
...content...
<!-- /skill:goal-driven -->
```

**Where to write.** Common config locations — write only to those that
already exist (don't create new agent configs for tools the project
doesn't use):

- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `AGENTS.md` or `codex.md` — Codex / OpenAI agents
- `.github/copilot-instructions.md` — GitHub Copilot
- `.windsurfrules` — Windsurf
- Any other agent instruction file the project uses

**Algorithm for each file.** If the file contains
`<!-- skill:goal-driven -->`, replace everything between markers
(inclusive of markers) with the new block. Otherwise, append the new
block at the end (preceded by a blank line).

**Block content** — base, plus a conditional Interactions subsection
populated from Phase 1.2 detection. The template below shows the full
block with both possible Interactions lines; **emit only the lines
whose sibling was actually detected**, and omit the entire `### Interactions`
heading if no siblings were detected. Do not copy the meta-instruction
itself into the file.

```markdown
<!-- skill:goal-driven -->
## Goal-driven planning

When working on this initiative, follow the goal-driven protocol:

- At session start, read `goals/GOAL.md` and surface any open STOPs
  (from `OPEN-STOPS.md` if it exists, otherwise by scanning recent
  record entries). If the project uses monthly records, ensure the
  current month's file exists; on rollover, propose a carry-over entry
  in chat before appending.
- At session end, draft a record entry in chat (what done, observations,
  per-criterion check with evidence, judgment) and get confirmation
  before appending.
- If a criterion verdict is `✗`, or new evidence questions the north
  star, surface a STOP in chat and wait for the human's decision. Never
  silently rewrite the path past a STOP.
- Never edit `GOAL.md` without an explicit, confirmed change request
  from the human, echoed back line by line.

### Interactions

- **with design-driven** (detected: `design/DESIGN.md` present) —
  goal-driven owns *why* and *how-far*; design-driven owns
  *what-shape*. A goal pivot that crosses module boundaries also
  triggers a `design/decisions/NNN-*.md` proposal. A design proposal
  that would violate a GOAL invariant triggers a Type A STOP first.
  Cross-reference by ID, not content (record entry: "adopted
  decision 003"; decision: "blocks STOP from 2026-05-02 if rejected").
- **with evidence-driven** (detected: evidence-driven block in this
  file) — every criterion ✓/✗ in record entries cites a falsifiable
  observation. STOP signals that depend on build observations are
  credible only when those observations carry evidence-driven trails.
<!-- /skill:goal-driven -->
```

**Show the block in chat before writing.** Especially in update mode —
the human should see whether siblings were detected correctly. If a
sibling is installed but wasn't detected (e.g., because it lives in an
unusual path), the human can flag it before the write.

A SessionStart hook can enforce the protocol mechanically — emit a
reminder to read GOAL.md and surface open STOPs at every session start.
This is opt-in and rarely necessary; the skill description usually
carries enough weight on its own. If the human asks for it, the harness
or hookify skill can generate the config.

### 4.3 Suggest sibling refresh

After writing goal-driven's block, scan each detected sibling's block
in the same agent-config files. If a sibling block exists but lacks any
mention of goal-driven (or refers to it in a stale way), nudge — don't
edit the sibling's block:

> I refreshed `<!-- skill:goal-driven -->` to mention design-driven /
> evidence-driven. Their own blocks may be out of date for the reverse
> direction — re-running `/design-driven init` and `/evidence-driven
> init` will refresh them with the latest cross-references. Want me to
> do that now, or leave for later?

If the human says yes, dispatch to those skills' init commands. If no
or "later", that's fine — the cross-references are useful but not
load-bearing.

**Do not edit sibling blocks directly.** Each skill owns its block;
goal-driven only writes between its own markers.

### 4.4 First record entry (first-run only)

Add a "kickoff" entry to the record. Format:

```markdown
## YYYY-MM-DD — Kickoff
- What I did: established GOAL.md via interview.
- Observations: General Line confirmed; <N> success criteria; <M> invariants.
- Criteria check: all unclear — no work done yet.
- Judgment: no change. Next session begins real work.
```

This anchors the record so the next session has something to read. In
update mode, skip — record already has entries.

### 4.5 Propose initial stories (opt-in, first-run only)

Look at the GOAL.md just written and ask: are there choices in here
that future-you (or a future agent) would want context on? Typical
candidates:

- A criterion whose number / threshold deserves explaining
- A non-goal that's tempting to revisit later (story explains why we
  said no the first time)
- A phrasing of the General Line that took multiple iterations to land on
- An invariant whose cost we explicitly accepted

Propose **at most one** — the highest-value candidate. The human
just spent the interview confirming GOAL.md line by line; piling on
2–3 more paragraph-echo cycles right after burns out the willingness
to engage carefully:

> One thing in the GOAL feels worth interpreting now beyond the terse
> text: `stories/why-X.md` — <one-line reason>. Want me to draft it,
> or leave for later when a STOP makes the choice live?

If the human says yes, draft paragraph by paragraph in chat (same
protocol as story updates — see `../references/stories.md`), get
approval, write to `goals/stories/<topic>.md`. Creating the first
story brings the directory into being.

If the human says no or "not now", that's fine — possibly the more
common answer at set time. Other candidate stories will surface
organically when a STOP resolution or review finding makes them live.
Don't push.

See `references/templates.md` for the story file template.

### 4.6 Commit

Commit `goals/`, agent config updates, and any hook configs together.
One commit, clear message:

- First-run: `goal-driven: set GOAL.md and record scaffolding`
- Update: `goal-driven: refresh agent config blocks (siblings: <list>)`

If update mode produced no actual changes (block already current,
plumbing already in place), skip the commit — empty commits add noise.
Just report: "Re-run produced no changes; setup is already current."

### 4.7 Tell the human what's next

First-run:

- The compass is set. From now on, every work session ends with a record
  entry the agent will draft and ask them to confirm.
- If a criterion fails or the General Line feels wrong, the agent will STOP
  and ask before continuing.
- They don't need to remember any of this — the agent's protocol carries
  it. Their job is to approve, redirect, and decide at STOPs.

Update:

- Summarize what changed (e.g., "added evidence-driven cross-reference
  to the goal-driven block").
- Mention any sibling refreshes still pending (per Phase 4.3).

## Avoid these failure modes

**Drafting before interviewing.** Tempting because the agent has a guess.
Don't. The interview's purpose is the human's commitment to the wording —
a draft you wrote and they nodded at is not the same as a wording they
confirmed phrase by phrase.

**Letting soft criteria slide.** "We'll know it when we see it" sounds
human and accommodating. It's also exactly the criterion that will be
silently treated as `✓` in every future session. Push for falsifiability
or a proxy. If the human resists, name the tradeoff explicitly: "Without
a proxy, I won't know when to STOP. Are you OK with that?"

**Listing too many criteria.** If you end up with 8, some are path-level.
Ask: "Would this still feel achieved if we did the others but missed
this one?" If yes, it's probably a path detail. If "achieved" depends on
all 8 simultaneously, the goal is too compound — split or reframe.

**Skipping non-goals.** The human will say "I don't have any non-goals".
They do; they just haven't named them. Prompt with: "What did you almost
include but decided to leave out? What would be a sign of scope creep
later?"

**Accepting inverted goals as non-goals.** "We want X → non-goal: not
X" delimits nothing. If a non-goal candidate doesn't name a specific
*tempting* path the initiative declines, it isn't doing the work of a
non-goal. Push for a forbidden zone with a reason, or cut the line.
