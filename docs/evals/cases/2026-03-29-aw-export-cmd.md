# Case Study: `aw export` Command Eval

This run is worth preserving because it exposed a durable team failure mode: the lead correctly identified a real issue during review, but did not complete the fix loop.

## Task

Implement `aw export <target> [--format jsonl|csv] [--output <file>] [--limit N]` as a new CLI command that reads events from a workspace or agent and writes them to stdout or a file.

## What the Task Tested

- CLI command integration and help output
- format handling for JSONL and CSV
- safe event typing and field guards
- test structure discipline
- whether a lead agent can delegate, review, and close a fix loop

## Final Scores

| Dimension       |   Team    |   Solo    |    Delta    | Notes                                                                                                |
| --------------- | :-------: | :-------: | :---------: | ---------------------------------------------------------------------------------------------------- |
| Autonomy        |    2/5    |    5/5    |   Solo +3   | Team needed human intervention after an `aw run` timeout and never posted a clean completion signal. |
| Quality         |    3/5    |    4/5    |   Solo +1   | Team left an unsafe cast in place. Solo missed `printUsage`, which was cosmetic but real.            |
| Speed           |    3/5    |    5/5    |   Solo +2   | Revised for infrastructure bias: the team stalled because of tooling, but solo was still faster.     |
| Maintainability |    3/5    |    4/5    |   Solo +1   | Solo had finer-grained helpers and more tests.                                                       |
| Completeness    |    3/5    |    4/5    |   Solo +1   | Team left the cast unresolved and never fully closed the loop.                                       |
| **TOTAL**       | **14/25** | **22/25** | **Solo +8** |                                                                                                      |

## Key Findings

- Review quality alone was not enough. The lead found the core defect, but did not convert that finding into a fix and re-review cycle.
- Infrastructure noise can distort speed comparisons. A timeout should be separated from pure implementation latency.
- Solo execution remained more reliable on this medium-sized task because it had no routing or delegation overhead.

## Improvement Actions That Carried Forward

- Add an explicit lead requirement to finish the fix loop before declaring completion.
- Separate infrastructure failure analysis from coding-speed analysis in scorecards.
- Keep deliverable checklists in prompts so code, tests, and registration changes arrive together.
