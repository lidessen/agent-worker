# Stories — opt-in interpretation layer

This reference covers when and how to use the optional `goals/stories/`
layer. SKILL.md keeps a brief pointer to here; the full protocol below
loads only when you actually need stories. For the per-file template
(filename patterns, body shape), see `templates.md`.

## What stories are

GOAL.md is normative and terse — one line per criterion, one line per
invariant. That's good for fast reading and for keeping the compass
hard to change accidentally; it's insufficient for explaining *why*
each choice was made or what each criterion really means in nuance.

The optional `goals/stories/` directory is a second layer: per-topic
explanatory documents that interpret GOAL.md's terse text. Stories are
mutable (they evolve as understanding deepens), narrative (prose, not
bullet lists), and topic-organized rather than chronological.

```
goals/
├── GOAL.md                              ← terse spec, hard-change
├── stories/                             ← opt-in interpretation layer
│   ├── why-200-paid-subs.md
│   ├── what-counts-as-paid.md
│   ├── channels-considered-and-rejected.md
│   └── ...
└── record-2026-08.md
```

## What goes in a story

Each story is a topic-named markdown file (kebab-case). Typical topics:

- Why a specific criterion is set as it is, including data or context
  that informed the number or threshold
- What an ambiguous term in GOAL.md means in practice
- Background on the choice of General Line — what alternatives were
  considered, why this framing won
- Trade-offs explicitly accepted (what you're giving up to chase this)
- How understanding of a criterion has evolved through STOPs and
  resolutions

Stories don't enforce 1:1 mapping to GOAL items. One story can span
multiple criteria; one criterion may have no story (terse text is
self-explanatory).

## When stories are created

Triggered by:

- **Set time**: at the end of `/goal-driven set`, the agent proposes
  2–3 initial stories based on the interview ("why this initiative",
  "how criteria were chosen") — human picks which to write.
- **STOP resolution**: if resolving a STOP involved re-understanding
  what a criterion really means, the agent proposes adding or updating
  a story.
- **Review trigger**: during `/goal-driven review`, if a criterion
  has been ambiguous through several STOPs, the agent proposes a
  story to clarify.
- **User-initiated**: "let me explain why I'm doing this" — the agent
  helps draft.

## Modification protocols — different shapes for different artifacts

| Artifact | Modification | Frequency |
|---|---|---|
| `GOAL.md` | Line-by-line echo + Revisions log entry; deliberate event | Rare |
| `stories/X.md` | Paragraph-level echo + human approval + write + bump `Last updated`; evolving update | Occasional |
| record entry | Draft + confirm + append; routine | Per session |

The shape of friction differs more than the magnitude. GOAL changes
are **discrete events** — formal, with audit trail in Revisions —
because they invalidate prior criterion checks and any STOPs that
depend on the old wording. Story updates are **evolving** — a
paragraph here, a paragraph there, no formal log needed because they
describe rather than prescribe. Record entries are **continuous** —
every session adds one, structured but quick.

Don't conflate "more chat turns" with "more important". A multi-
paragraph story update may take more turns than a one-line GOAL
revision but is less consequential — the GOAL revision changes what
"done" means; the story update only changes how we explain it.

Each story carries a `_Last updated: YYYY-MM-DD_` footer. A story
untouched for many months while related GOAL items have shifted is a
candidate for refresh — surfaced during review.

## Distinction from record (don't conflate)

| Aspect | record | stories |
|---|---|---|
| **Role** | Event log — raw observations as they happened | Synthesis — current curated understanding distilled from accumulated events |
| Organization | Chronological (by month file) | Topical (by file name) |
| Tense | Past ("today I did X") | Present ("this criterion now means …") |
| Mutability | Append-only | Freely editable |
| Count | A few files over a project | 5–15 typical |
| Use | Reconstruct what happened | See what we currently believe |

Content can overlap; roles differ. A record entry "today's work
shifted my understanding of C2" is the *trigger* for updating
`stories/c2-meaning.md`; the story IS the synthesized current view
that absorbs many such triggers. Read record to reconstruct the
sequence of events; read stories to see the current settled
understanding distilled from those events.

## Cross-references

- record entries can point to stories: "see stories/what-counts-as-paid.md"
- STOP entries can reference stories or trigger story creation
- GOAL.md can footnote stories: `C2: P95 < 500ms (see stories/c2-rationale.md)`

## Default behavior

`/goal-driven set` does not create the `stories/` directory. The first
story being approved is what brings the directory into being. For
single-attempt projects with self-explanatory criteria, stories are
overhead — skip them; the agent only proposes them when there's
something nontrivial to interpret.
