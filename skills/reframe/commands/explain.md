# reframe:explain — Audience-tailored translation

Translate a concept document (or a specific section) into the
audience's native vocabulary. Concept documents are dense methodology
applied to dense content — useful for the team writing them, opaque
to almost everyone else who needs to understand them. Explain is the
bridge.

This is not a summary. It's a translation: methodology vocabulary
(essence, primitives, skeleton, flesh, stress test) replaced with
the audience's working vocabulary, structured around the audience's
actual concerns. Summaries preserve the original's structure at
smaller scale; translations reshape for the receiver.

Output goes to chat by default. **Don't persist as a file** unless
the user explicitly requests a snapshot — explanations drift from
concept docs as concepts evolve, and a stale snapshot in the repo
is worse than no snapshot. If a snapshot is requested, save it
under `concepts/<slug>-explain-<audience>-YYYY-MM-DD.md` with a
prominent header noting the source concept version and warning
that drift may have occurred.

## Inputs

Parsed from the invocation:

```
/reframe explain [target] [for <audience>] [about <focus>]
```

- **target** — concept slug. Defaults to the active concept if
  exactly one is open in `concepts/`; otherwise asks.
- **audience** — natural language: "for sales reps", "for the new
  backend engineer", "for our exec team", "for a designer joining
  the project". Push for specificity if vague — "for users" →
  "for what kind of user?".
- **focus** — optional: "about Phase 6 flesh", "about the v2
  skeleton", "about why we rejected the chronological log".
  Default is the whole concept.

If any input is missing or vague, ask in chat before generating.
Don't guess.

## Process

### 1. Read the concept document fully

All sections, including stress tests and comprehension tests. The
most informative parts are usually the verb-tagged log entries —
that's where validation evidence lives. Don't skip them; an
explanation grounded in evidence is far more useful than one
grounded in claims.

### 2. Build the audience profile

In one or two sentences in chat, state what you understand about
the audience: their working vocabulary, what they care about, what
they'd skip past. Confirm before generating. Common shapes:

- **End user (e.g. salesperson, doctor, operator)** — daily impact:
  "what changes for me, what gets easier, what gets harder, what
  skills do I need that I didn't before".
- **Engineering team (joining the project)** — architecture and
  surface area: "what's settled, what's in flux, what's the API I'll
  work with, where do I plug in".
- **Designer / UX** — projection map: "which skeleton states surface
  as which UI states, where the system speaks vs where the user
  drives, what failure modes look like".
- **Executive / stakeholder** — bet and evidence: "what we're
  trying, what we've validated, what's still open, what could kill
  it, what decision points are coming up".

Different audiences want different *shapes* of output, not just
different vocabulary. Shape matters as much as words.

### 3. Translate, don't summarize

For each methodology term, find the audience's equivalent:

| Methodology term | Working translations |
|---|---|
| essence | "what the system fundamentally does" |
| paradigm primitives | "the new building blocks we have access to" |
| skeleton | "the underlying flow" / "the architecture" |
| flesh | "what users see and do" |
| stress test passed | "we tried to break it by X and it held" |
| comprehension test | "we showed it to users and they got it" |
| transfer learning | "we borrowed this idea from <domain>" |
| graduated to design/ | "we've locked in this part" |

These are starting points, not rules. Pick what fits the audience's
voice; don't import jargon they wouldn't use themselves.

### 4. Structure follows the audience

A salesperson explanation reads as a day-in-the-life story. An
engineering explanation leads with a system diagram and bullets. An
exec explanation opens with the bet and the evidence, then the
decision points ahead. Don't force every audience into the same
outline.

A useful test: read the first paragraph as if you were the
audience. Does it answer the first question they would ask? If it
opens with methodology context the audience doesn't share, restart.

### 5. Surface gaps deliberately

If the audience would naturally care about X and the concept doc
doesn't address X, say so explicitly. "We haven't decided this
yet" or "this is still in flux — see Open Tensions" is
information, not weakness. An explanation that papers over open
questions creates worse problems later than one that surfaces them
honestly.

### 6. Cite back to the concept doc

Every claim should be traceable to a section in the concept doc.
If you find yourself adding context that isn't there, stop — that
context either belongs in the concept doc itself, or the concept
doc is hiding a decision that should be made explicit. Don't
silently fill gaps in the explanation.

### 7. Length calibration

Default short — 1-2 minutes to read at normal speed. Offer
drill-down on request rather than front-loading detail. If the
audience wants more, they'll ask. If they don't, you've saved them
time.

For specific-focus explains (`about <X>`), the same calibration
applies — a focused explanation is shorter than a whole-concept
one, not the same length restricted to one topic.

## Doubles as a Phase 7 artifact

The narration-fidelity tier of Phase 7 (comprehension test) is
essentially "tell a target user what this is, ask them to predict
what happens at each step". An `/reframe explain for <audience>`
output is exactly the right artifact for that test — produce it,
walk it through with a real target user, capture their reactions
under `## Comprehension Tests` in the concept doc.

When using explain this way, generate the explanation first, then
ask the user during the walkthrough to predict outcomes at decision
points. Their predictions (right or wrong) are the evidence the
comprehension test logs.

## What explain isn't

- **Not a marketing pitch.** Translates faithfully; doesn't sell.
  If the explanation makes the concept sound better than the
  evidence supports, you're selling.
- **Not a tutorial.** "How to use it" is a separate genre that
  belongs in product documentation once the system ships.
- **Not authoritative.** The concept doc is the source of truth.
  An explanation is a view onto it, valid only as long as the doc
  hasn't drifted past it. Always cite the source.
- **Not exhaustive.** Coverage is the wrong goal. Pick what this
  audience needs to act, decide, or buy in; leave the rest in the
  concept doc.
