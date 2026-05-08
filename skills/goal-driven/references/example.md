# Example walkthrough

A concrete end-to-end run of goal-driven on one initiative, showing
`set`, several record entries, both STOP types, and resolution.

The initiative: **adding semantic search to a chat application's history.**

## Set (interview, not draft)

**Agent:** "In one or two sentences, what should be true when this is
done?"

**Human:** "Users can find old conversations by meaning, not just exact
keyword."

**Agent:** "Got it. I'll write the General Line as: *Users can locate
conversations from the last three months by meaning, without needing exact
keywords.* OK?"

**Human:** "Add 'three months' — the index doesn't need to go further back."

**Agent:** "Updated: *Users can locate conversations from the last three
months by meaning, without needing exact keywords.* Confirmed?"

**Human:** "Yes."

**Agent:** "How would you know this is achieved?"

**Human:** "Recall is decent and it's fast."

**Agent:** "Decent recall — measured how? Manual evaluation, click-through
rate on results, something else?"

**Human:** "Probably manual eval — pick 30 queries, check if the right
result is in the top 5."

**Agent:** "C1 will read: *Recall ≥ 70% on a 30-query manual evaluation
set, top-5 results.* For 'fast' — what number?"

**Human:** "P95 under 500ms in production."

**Agent:** "C2: *P95 latency under 500ms, measured on production traffic
replay.* Anything else? You hadn't mentioned infra cost — does that
matter?"

**Human:** "Right, no new infrastructure. We already have Postgres."

**Agent:** "C3: *No new always-on infrastructure beyond the existing
Postgres instance.* Three criteria total — confirm?"

**Human:** "Confirm."

**Agent:** "Anything that must stay true regardless of path?"

**Human:** "User data shouldn't leave our DB. And don't break the existing
keyword search."

**Agent:** "Two invariants: *user data stays within local Postgres*; *the
existing keyword search API contract is unchanged*. OK?"

**Human:** "Yes."

**Agent:** "What's tempting but explicitly out of scope — work an
outside reviewer might lobby for that you've already decided against?"

**Human:** "Cross-user search would be cool but is out. And multi-language
— Chinese only for now, English nice-to-have but not blocking."

**Agent:** "For each, the reason matters — it's what stops the line
from rotting into a question mark next time someone lobbies. Why
cross-user search out?"

**Human:** "Privacy review would balloon scope; this is single-user
search inside one's own history."

**Agent:** "And multi-language beyond Chinese?"

**Human:** "Embedding model trade-offs differ by language. Pinning to
Chinese keeps the model choice simple."

**Agent:** "Non-goals captured as: *cross-user search — privacy review
would expand scope beyond a single user's own history*; *multi-language
beyond Chinese — keeps embedding model choice simple, avoids
per-language tuning*. English support is desired but not required —
should I write that as a non-goal or note it as a stretch?"

**Human:** "Note as stretch — don't make it a non-goal."

**Agent:** "Got it. I'll add a note under Non-goals: 'English support
is a stretch goal, not required for success'."

(Agent writes `goals/GOAL.md`, shows it in chat, gets final OK, adds
kickoff entry to `record-2026-04.md`.)

## Initial stories proposed at set

After GOAL.md is written, the agent proposes some interpretive stories:

> Three things in the GOAL feel worth interpreting beyond the terse
> text. Want any drafted now?
>
> 1. `stories/why-three-months.md` — why we capped at 3 months of
>    history. Worth anchoring the trade-off in case it gets questioned.
> 2. `stories/what-counts-as-found.md` — what "found" means for the
>    recall criterion (top-5 manual eval is the measure, but the user
>    intent may need clarifying once we have query traffic).
> 3. `stories/why-pgvector-not-sqlite-vec.md` — wait, this is shape,
>    not goal. Skip — that belongs in design-driven decisions if it
>    comes up.
>
> The first feels worth having now; the second can wait until we have
> evidence to interpret. Should I draft (1)?

Human says yes. Agent drafts (paragraph by paragraph, echoed, written):

```markdown
# Why three months of history

GOAL.md C1 says "search returns relevant from last 3 months" — not
"all history". Three months is a deliberate scope choice.

The reasoning: based on usage data, 80% of meaningful searches are for
conversations from the last 6 weeks; the 3-month cap covers ~92% of
real queries. Going further back doubles the indexing cost without
materially improving the experience for most users. We accept that
the long-tail (search for an old conversation) is a non-goal — users
who need this can fall back to existing keyword search.

If we later see real demand for older history, this story is the
reason to revisit. The criterion isn't sacred; the trade-off is.

---
_Last updated: 2026-04-08_
```

This story sits in `goals/stories/` as background. Any future STOP
about expanding the window will load it for context.

## record-2026-04.md (early entries)

```markdown
## 2026-04-08 — Kickoff
- What I did: established GOAL.md via interview (ran /goal-driven set).
- Observations: 3 criteria (C1 recall ≥ 70%, C2 P95 < 500ms, C3 no new
  infra), 2 invariants, 2 non-goals.
- Criteria check: all unclear — no work yet.
- Judgment: no change. Next session: spike storage options.
- Next: pick storage backend.

## 2026-04-12 — Storage spike
- What I did: surveyed sqlite-vec, pgvector, and faiss-on-disk.
- Observations: pgvector wins on C3 (project already runs Postgres, no
  new infra). sqlite-vec is closer to "no infra" technically but adds a
  parallel data store.
- Criteria check:
  - C1 unclear (no recall measured yet)
  - C2 unclear (no latency measured yet)
  - C3 ✓ (pgvector adds extension to existing PG, no new daemons)
- Judgment: path forward = pgvector. No change to GOAL.
- Next: build small index, run 30-query eval.

## 2026-04-15 — First eval pass
- What I did: indexed 1k messages, ran 30 manual queries.
- Observations: recall 76%; P95 720ms (cold) / 180ms (warm). Cold start
  driven by embedding model load.
- Criteria check:
  - C1 ✓ (76% recall on 30-query eval set)
  - C2 ✗ (P95 720ms cold; 180ms warm — depends on inclusion of cold)
  - C3 ✓ (pgvector only, no new infra)
- Judgment: path-level — need to handle cold start. C2 depends on
  measurement choice; ambiguity is in GOAL, not path. Worth flagging.
- Next: decide whether C2 measures cold or warm; implement warm-keep if
  needed.
```

## A Type A STOP and resolution

```markdown
## 2026-04-22 — STOP [Type A] C2 cold-start ambiguity
- What I did: tried two warm-keep strategies; both shaved P95 to 320ms
  warm but cold remains 1.2s on first query after deploy.
- Observations: production traffic includes cold-start moments after
  every deploy and after idle periods. If C2 is "P95 including all
  traffic," 1.2s is the real number. If C2 is "P95 excluding cold start
  windows," we're at 320ms.
- Criteria check:
  - C1 ✓ (recall 76%, unchanged)
  - C2 ✗ if cold included, ✓ if not (measured both)
  - C3 ✓
- Judgment: STOP Type A. C2's wording is ambiguous and the answer
  depends on which interpretation we pick.
- Options for human:
  - (a) Tighten C2 to "P95 < 500ms in steady state, excluding 60s after
    deploy" — would be a GOAL revision
  - (b) Hold C2 to current wording and require P95 < 500ms always —
    means we need a warm-keep service (which violates C3)
  - (c) Accept current status — keyword search is the fallback during
    cold starts
- Status: open
```

(Posted to `OPEN-STOPS.md`:)

```
- 2026-04-22 [Type A] C2 cold-start ambiguity → see record-2026-04.md
```

(Human picks option (a). GOAL.md is updated — C2 reworded with
human's line-by-line confirmation. Revisions section gets a new line.
Audit trail follows:)

```markdown
(append to original STOP entry:)
→ resolved 2026-04-23: chose option (a). C2 reworded to exclude 60s
  after deploy. See GOAL Revisions 2026-04-23.
- Status: resolved
```

(`OPEN-STOPS.md` line removed. Work resumes.)

## A Type B STOP

After several more weeks of work, the feature ships to 5% of users:

```markdown
## 2026-05-02 — STOP [Type B] General Line may be wrong
- What I did: interviewed three heavy users about how they're using the
  new search.
- Observations: All three said they rarely use semantic search. What
  they actually wanted was "show me my conversations grouped by topic"
  — they have a topic in mind, want to see all related threads. Search
  is too query-formulation-heavy.
- Criteria check:
  - C1 ✓ (recall still 76% in eval, in-app shows similar numbers)
  - C2 ✓ (P95 300ms in steady state, well under 500ms)
  - C3 ✓ (pgvector still the only infra)
- Judgment: STOP Type B. Criteria all green; users want a different
  shape of help. Continuing to optimize semantic search may be local
  optimization on the wrong problem.
- Options for human:
  - (a) Reframe the General Line toward topic clustering. Existing semantic
    search becomes substrate, not the product.
  - (b) Stay course — three users is a small sample; ship to more
    before redirecting.
- Status: open
```

(Human picks (b) — wants more data before pivoting. Two weeks later,
broader rollout shows the same pattern. STOP is reopened — agent surfaces
again, this time the human picks (a). GOAL is rewritten under the new
General Line, criteria are revised; old criteria are RETIRED but kept for
reference.)

After the reframe, the agent proposes a story update:

> The pivot is the kind of decision future-you will want context on.
> Should I add `stories/why-we-shifted-from-search-to-clustering.md`
> capturing the user-research evidence and the reasoning?

Human approves. The new story documents what the three interviews
showed, what the broader rollout confirmed, what was given up by
moving away from search-as-product, and why search-as-substrate
remains useful. Future agents reading the post-pivot work pick up
this story and immediately understand context that the GOAL.md
revision alone wouldn't carry.

## What the example demonstrates

- **The interview is concrete.** The agent pushes back on soft answers
  ("decent recall — measured how?") until the criteria are falsifiable.
  The human shapes the wording; the agent enforces the form.
- **Criteria check evidence is not optional.** Every ✓ and ✗ cites a
  specific observation from that session. `C1 unclear` is the default
  when nothing was measured.
- **Type A vs Type B is a real distinction.** 2026-04-22 is path failure
  (criterion can't be met as stated). 2026-05-02 is goal failure
  (criteria met, but the goal solves the wrong problem). The
  resolutions look very different — Type A often gets fixed by tightening
  a criterion; Type B requires rethinking the General Line.
- **GOAL.md changes are deliberate events.** Every revision is logged.
  Old IDs aren't reused. The Revisions section gives a quick scan of
  how the goal evolved.
- **STOPs are not silent.** The agent surfaces them in chat, posts to
  OPEN-STOPS, and waits. Resolution updates both the record entry
  (append `→ resolved`) and OPEN-STOPS (remove the line).
