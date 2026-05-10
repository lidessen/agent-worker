# attention-driven:fact

Fact layer: falsifiable observations for progress claims.
Fact owns observation: how the agent knows the current state, whether the gap
shrank, and whether a check is too noisy to steer from.

Read `references/fact.md` for the discipline. Use this command when code paths
are production-facing, regression-prone, or when the user asks for rigorous
verification, TDD, "no progress without evidence", or proof that work is done.

## Plan

Before claiming progress, name:

1. Risks: concrete ways this could fail.
2. Checks: tests, traces, manual captures, or comparisons that catch each risk.
3. Sequence: what check comes before what implementation step.
4. Done evidence: the observations required before the claim is accepted.
5. Observation quality: what would make the observation stale, noisy, fake, or
   too indirect to steer from.

If the task has a blueprint, add these details under its Verification section
instead of creating a separate plan surface.

## Build

Prefer TDD when deterministic behavior can be unit-tested:

1. Write the test.
2. Run it and confirm it fails for the right reason.
3. Implement the smallest change.
4. Run it again and capture the pass.
5. Update the durable State surface if the task spans sessions.

Use integration traces or manual captures when TDD would be fake or more costly
than the risk it catches.

## Verify

Each done claim needs an observation that could have shown the opposite.

Good: `bun test packages/foo/test/bar.test.ts passed: 8 pass, 0 fail`.
Bad: `looks right`, `tested manually`, `should work`, or a mock assertion that
does not check the effect.

If a check fails, the work is not done. Fix it, change the claim, or surface the
blocker.

If checks conflict, do not average them into confidence. Isolate the
observation: rerun, narrow the scenario, inspect the trace, or choose the check
closest to the claimed effect.

## Handoffs

If fact evidence shows the system shape is wrong, route to `design`. If evidence
shows the goal criterion is wrong or off-track, route to `goal` as a STOP
candidate.
