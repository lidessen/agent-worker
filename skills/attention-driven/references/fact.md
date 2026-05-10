# Fact Reference

Fact is the falsifiable observation layer.

## Principle

No progress claim survives without an observation that could have shown the
opposite.

Fact is the observation layer. Weak observation makes the whole steering loop
unstable: the agent applies actions without knowing whether the gap shrank.

Three questions catch weak evidence:

- Could this evidence have shown the opposite?
- What realistic input would make this test fail?
- If the implementation were silently wrong tomorrow, would this check catch it?

Not facts:

- "looks right";
- "tested manually" without captured result;
- tests that pass even if the implementation is removed;
- mock assertions that only verify a mock was called.

Facts:

- failing-then-passing tests with command output;
- integration traces;
- manual checklist items with concrete observed output;
- known-good comparisons;
- screenshots or captures when UI behavior is the claim.

## TDD Default

For deterministic code:

1. Write the test.
2. Run it and confirm it fails for the right reason.
3. Implement.
4. Run it and capture the pass.
5. Refactor with the test as safety.

Do not force TDD when it produces fake confidence. Use integration or manual
evidence when that better catches the risk.

The point of TDD is falsifiability plus design pressure, not ritual. If another
form gives the same force, use it.

## Evidence Trail

If a task spans sessions, evidence belongs in a durable State surface:
blueprint State, issue comment, record entry, or another project convention.
Chat alone is not a durable evidence surface.

State entries should say what changed, where, and what check supports it.

Hollow State is worse than no State. "TODO 1 done" tells the next agent nothing.
State should say what changed, where, and what now passes or was observed.

## Anti-Cargo-Cult Check

Before counting a test as evidence, name the failure it would catch:

> This catches the case where `limit=0` returns everything instead of nothing.

If you cannot name the failure, the check is probably decorative.

## When To Skip

Skip fact discipline for throwaway prototypes, exploratory spikes where the
question is viability rather than correctness, documentation-only changes,
highly experimental research where rigidity kills iteration, or solo work where
the tradeoff is explicitly accepted.

## Final Test

Before claiming done, ask whether a future agent can tell from the artifacts
whether the work actually works. If they would have to take your word for it,
add evidence or weaken the claim.

## Handoffs

Fact findings flow upward:

- repeated implementation failure caused by shape -> design decision;
- criterion failure or misleading criterion -> goal STOP;
- comprehension/stress-test result in unsettled territory -> reframe update.

When observations are noisy or contradictory, do not average them into a vague
claim. Improve the observation first: isolate the check, name the failure mode,
and capture the output.
