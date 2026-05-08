# Concept document template

Copy the structure below into `concepts/<slug>.md` when starting a
new reframe. Fill the YAML frontmatter, then build sections as each
phase is reached.

The template is opinionated about *form* — vignettes, text diagrams,
dependency tables, verb-tagged blocks — because concept documents
are abstract methodology applied to abstract content, and unstructured
prose at that altitude reads like noise. Every required form below
exists because a corresponding failure mode happens without it.

The slug is short kebab-case (`ai-native-crm`, `agent-first-ide`).
One slug per concept; never reuse.

The illustration blocks (prefixed `> Example:`) use AI-native CRM as
a worked example — replace them; keep the form.

---

```markdown
---
target: <human-readable name, e.g. AI-native CRM>
paradigm: <new paradigm name, e.g. AI-native>
status: active
opened: YYYY-MM-DD
---

# Concept: <target>

## In plain words

Two or three sentences a non-specialist could read. What is the
target, what's wrong with the obvious traditional answer, and what
does this concept propose differently? This block is the cognitive
on-ramp — if a reader bounces here, they bounce on everything below.

> Example: A CRM where the salesperson never types into a form. The
> agent reads ambient context (emails, meetings, IM) and proposes
> stage transitions, follow-ups, and draft replies. The salesperson
> approves or overrides — they're not a data-entry operator, they're
> a decision-maker.

## Essence

3-5 abstract functions the target performs under any paradigm. Each
uses the **abstract function → concrete vignette** pattern: the top
line states the function in essence-grade language; the arrow line
shows what it looks like in scene. The vignette is what makes the
abstraction stick — without it, essence reads as jargon.

- **<abstract function 1>** — <one-line justification: why is this
  essence rather than artifact?>
  → <1-2 sentence concrete scene where this function is visible>

- **<abstract function 2>** — <justification>
  → <vignette>

> Example:
>
> - **Maintain a per-relationship running synthesis updated by every
>   recorded interaction** — surfaces the function under "customer
>   profile + activity log" without committing to schema or UI.
>   → Before Sally dials a customer, the system has already
>   pre-built a one-paragraph briefing from last week's emails and
>   yesterday's meeting notes — no one typed it.
>
> - **Advance relationship state in response to evidence** —
>   replaces "user clicks next stage" with the underlying intent.
>   → After a contract attachment is sent, the relationship moves
>   from "negotiating" to "awaiting signature" without anyone
>   marking it.

## Paradigm Primitives

Operationally concrete building blocks the new paradigm offers. Each
must be specific enough that a skeleton can be expressed *in* it.
Slogans don't count; primitives are the operational consequences of
the slogan.

- <primitive 1>
- <primitive 2>
- ...

> Example (AI-native):
> - Every action is exposed as a tool with a JSON schema
> - Agents read arbitrary context (email, calendar, IM) without forms
> - State can be inferred from evidence rather than entered by hand
> - Natural language and structured data flow both ways
> - Background agents act between user sessions

## Skeleton (current: vN)

### Diagram

A text-diagram of the core flow. State machine, data flow, dependency
graph — whatever shape the skeleton actually takes. Six lines of
ASCII teach more than six paragraphs of prose. **Required from v2
onward**; v1 may be prose-only while the shape is still forming.

> Example (AI-native CRM, v2):
>
> ```
> Conversation evidence ──┐
> Email / calendar ────────┤
> Past interactions ───────┤
>                          ▼
>              [Relationship synthesis]
>                          │
>                          ▼
>            [Suggested stage + confidence]
>                          │
>                          ▼
>           User confirms / overrides / queries
>                          │
>                          ▼
>              [Synthesis re-anchored]
> ```

### Components → primitives

Small dependency table. Rows are skeleton components; columns are
primitives each rests on. Cells: checkmarks or short notes. This
makes "skeleton expressed in primitives" auditable rather than
hand-waved.

| Component | Tool schema | Ambient context | Inferred state | NL ⇄ struct | Background agent |
|---|---|---|---|---|---|
| <component 1> | | | | | |
| <component 2> | | | | | |

A row with no checkmarks signals old-skeleton sneaking in. A column
that no row uses signals a primitive that isn't actually load-bearing
— consider dropping it from Phase 2.

### Rationale

For each component, one or two lines on what essence function it
serves and why this shape rather than the obvious traditional one.

<details>
<summary>Earlier versions (v1 … v(N-1))</summary>

### v1 → v2 delta

What changed between v1 and v2, and why. Cite the stress test or
comprehension test that triggered the change. Readers shouldn't have
to diff component lists by hand.

> Example: v1 had `User clicks "next stage"` driving state. v2 has
> `Agent proposes stage from evidence; user confirms`. Trigger:
> stress test 2026-05-12 removed manual stage transitions and v1
> collapsed because nothing drove the state machine.

### v1 (full)

<the v1 skeleton, kept as-is for archaeology>

</details>

## Stress Tests

Append-only log. Each entry uses the verb-tagged block format below.
The structure is what makes the section skim-readable months later;
free-form prose entries get rejected on review because they hide
state.

```
Date:        YYYY-MM-DD
Removed:     <traditional crutch removed in this test>
Hypothesis:  <what should still work after the crutch is gone>
Result:      held | bent | collapsed — <observation>
Diagnosis:   <implication; skeleton change, if any>
```

> Example:
> ```
> Date:        2026-05-12
> Removed:     Manual "advance stage" button
> Hypothesis:  Agent infers stage from email/meeting evidence
> Result:      bent — agent suggested correctly 12 of 14 cases;
>              2 false positives where forwarded email was treated
>              as new evidence
> Diagnosis:   Skeleton needs a source-of-evidence filter on the
>              synthesis step. Bumped to v2.
> ```

## Comprehension Tests

Append-only log, same verb-tagged shape as stress tests, different
fields. Each entry tests whether the projected flesh is legible to
actual users.

```
Date:        YYYY-MM-DD
Artifact:    narration | wireframe | mock | thin prototype
Users:       <who, how many>
Observation: <what the user did, said, or predicted; what they missed>
Diagnosis:   flesh problem | skeleton problem | essence problem
Feedback:    revised Phase <1 | 3 | 6>; <what changed>
```

> Example:
> ```
> Date:        2026-06-04
> Artifact:    interactive mock — stage suggestion card
> Users:       2 sales reps, day-one users
> Observation: Both looked for a "next stage" button. Neither
>              noticed the suggestion card waiting for confirmation
>              in the side panel.
> Diagnosis:   flesh problem — projection isn't legible without a
>              prior mental model. Skeleton is right.
> Feedback:    Revised Phase 6: suggestion card now inlines into
>              the activity feed, not a side panel. Re-tested
>              2026-06-08; both users acted correctly unprompted.
> ```

## Transfer Log

Mature domains mined for analogical patterns. Each entry: source
domain, abstract problem it solved, translated form here. Note
deliberate non-transfers — recording why a pattern was rejected
prevents re-litigation.

- **<source domain> → <here>** — abstract problem: <X>; translated
  form: <Y>
- **<source domain> — considered, not taken** — <reason>

> Example:
> - **Medical SOAP notes → relationship synthesis** — abstract
>   problem: lossy compression of long unstructured history into a
>   decision-ready snapshot; translated form: per-relationship
>   running synthesis updated on every interaction.
> - **CRM activity log — considered, not taken** — chronological
>   event lists optimize for audit, not for "what should I do
>   next"; the synthesis pattern serves the actual user need.

## Flesh Plan

User-facing surface as a projection of skeleton state. Each flesh
element must name the **skeleton state it projects** *and* the **user
need it serves**. If you can't name both, it's not flesh — it's old
paradigm leaking through, and the data behind it is in the wrong
shape.

| Flesh element | Projects skeleton state | Serves user need |
|---|---|---|
| <UI element> | <skeleton state> | <user need> |

> Example:
>
> | Flesh element | Projects skeleton state | Serves user need |
> |---|---|---|
> | Activity feed inline card | Stage suggestion + confidence | "What's the next move on this deal?" |
> | Customer briefing panel | Relationship synthesis (latest) | "Catch me up before I dial." |
> | Override button on card | User confirm/override action | Disagreement is first-class, not a workaround. |

## Open Tensions

Unresolved questions worth surfacing rather than papering over.

- <tension 1>
- <tension 2>

## Session Log

Date-stamped chronological log of significant moves. A new agent
should read this and infer current state without archaeology.

- YYYY-MM-DD — <what changed in this session>
- ...
```
