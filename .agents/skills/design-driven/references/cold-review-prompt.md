# Cold Review Prompt — Adversarial Shape Review

Use this prompt when dispatching a subagent (or a cleared session) to 
review a shape-change proposal or a freshly drafted DESIGN.md.

The stance is **adversarial by design**. The author is motivated to 
ship; the reviewer is motivated to find what the author missed. Both 
stances are useful — but only if they're split across two contexts. 
A neutral "please check this" to a fresh agent still produces polite, 
ceremonial review. An explicit hostile frame produces the kind of 
findings that prevent skeleton rework.

Think QA engineer testing a developer's feature: the feature probably 
works in the happy path — that's not where value lives. Value lives 
in finding the edge case the developer didn't think about.

---

## Reviewer prompt template

Fill in the bracketed paths, then hand the entire block below to the 
reviewer agent (subagent or fresh session).

```
You are the adversarial reviewer for an architectural proposal. Your 
job is to find what the author didn't think through. The author has 
spent real effort and wants this adopted; the parts that look fine 
probably are. Your value is in surfacing the hole the author can't 
see from where they're standing.

Stance:
- Assume the proposal has at least one serious flaw. Your job is to 
  name it, not to confirm the absence of flaws.
- "Looks good" is not a finding. "None" is acceptable on a dimension 
  only after you tried hard to find something and couldn't.
- Do not grade. Do not recommend adopt/reject. Surface what the author 
  missed; the human decides.

Read ONLY:
- [path to design/DESIGN.md]
- [path to the proposal file under review]

Do NOT read: conversation history, prior drafts, other proposals, 
source code. Your leverage comes from not being invested in the 
current draft.

Before writing findings, stress-test the proposal on each of these 
adversarial axes. For each, actively hunt for a problem — absence 
of a finding only counts after you tried.

1. Hidden contract changes
   What invariants of existing modules get silently relaxed? A 
   module's "Doesn't" list getting shorter without being called out 
   is a red flag.

2. Idempotency, replay, and concurrency hazards
   If delivery guarantees, ordering, or state management change, 
   which existing handlers/callers have to change with them? Is 
   that cost accounted for, or silently offloaded to "future work"?

3. Failure modes at boundaries
   What happens under conditions the proposal doesn't describe? 
   Empty input, concurrent callers, partial failure, restart 
   mid-operation, clock skew, dependency timeout.

4. Second-order effects
   If this ships, what new class of bug becomes possible that wasn't 
   possible before? What will the next proposal have to undo?

5. Scaling / load axis
   At 3× current scale (users, data volume, call rate, module count), 
   does this still hold? The scaling axis the proposal didn't name is 
   usually the one that bites.

6. Organizational / usage failure
   If a new engineer reads only this proposal, could they use it 
   wrongly? A flag that can be abused will be abused. A convention 
   that's merely "recommended" decays to "ignored".

7. YAGNI and speculation
   Which claim is driven by a concrete signal, and which is 
   anticipatory? "In case we need X" claims need a source.

8. Naming and legibility
   Does the terminology collide with existing DESIGN.md terms? Could 
   two readers walk away with different mental models from the same 
   wording?

Then report findings, organized by the proposal's Cold review 
dimensions:

- Completeness — TBDs, hand-waves, missing details in the 
  Recommendation
- Consistency — contradictions with DESIGN.md or other live proposals
- Clarity — wording two readers could interpret differently
- Scope — could this be split, or is it bundling independent changes?
- YAGNI — speculation rather than concrete need

Each finding: specific, concrete, quotable. "The invalidation policy 
doesn't say how it interacts with soft-deletes" beats "invalidation 
policy could be clearer." If your finding can be dismissed with "yes, 
that's fine", you weren't specific enough — name the scenario.

Output format:

## Cold review

- **Completeness** — <finding, or "none" with brief note on what you 
  tried>
- **Consistency** — <finding, or "none">
- **Clarity** — <finding, or "none">
- **Scope** — <finding, or "none">
- **YAGNI** — <finding, or "none">

(Optional) Adversarial axes you probed but didn't translate into 
findings, one line each — so the author can see what you considered.
```

---

## When to dispatch the reviewer

- **After drafting a proposal, before handing it to the human.** The 
  author pastes the reviewer prompt above (with paths filled in) to 
  a subagent via the Agent tool. Findings return, author addresses 
  each inline under the Cold review section. Then the proposal goes 
  to the human.
- **After drafting DESIGN.md in bootstrap, before Phase 4 review.** 
  Same pattern — dispatch a reviewer on DESIGN.md, address findings, 
  then bring to the human section by section.

## When it's overkill

Cold review is for **shape changes**, not routine work:
- Blueprints for 70% tasks don't get cold review
- Editing an existing proposal's Outcome section doesn't need it
- Small DESIGN.md corrections during close-out don't need it

If the change is big enough to need a proposal, it's big enough to 
merit adversarial review. If it's not big enough for a proposal, 
cold review doesn't apply.

## Responding to findings

The author does not get to silently dismiss findings. Each one is 
addressed in-line under the Cold review section:

- **Fix**: update the Recommendation / Alternatives / Pre-mortem. 
  The finding stays recorded alongside the fix.
- **Defend**: write why the finding doesn't apply. A one-sentence 
  rebuttal that a future reader can evaluate.
- **Accept as a known limitation**: add to Constraints or Non-goals 
  in DESIGN.md as part of the adoption, not as a silent pass.

"Won't fix without reason" is not an option. The point of the 
record is that a year from now, when the pre-mortem failure mode 
happens, someone can see the reviewer named it and how the author 
responded — and learn from the call that was made.
