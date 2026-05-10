# attention-driven:goal

Goal layer: direction, success criteria, record continuity, and STOPs.
Goal owns the target: where the work should go, what counts as enough, and when
observations say the target itself should be questioned.

Subcommands:

- `set`: create or refresh goal scaffolding.
- `review`: strategic checkpoint and protocol maintenance.
- no subcommand: inspect current goal state and decide what goal action is
  needed.

Read `references/goal.md` and `references/templates.md` when writing goal
artifacts.

## set

If `goals/GOAL.md` is missing or only a stub, run the interview. Do not draft
the goal alone and ask for approval at the end. Ask, echo, and confirm each
section:

1. General Line: one or two sentences describing the world-state at success.
2. Success criteria: 2-5 falsifiable criteria with stable IDs `C1`, `C2`, ...
   IDs are never reused.
3. Invariants: 0-4 things that must stay true throughout the initiative.
4. Non-goals: tempting wrong work, with the reason each is out of scope.

After confirmation, write `goals/GOAL.md`, ensure `goals/record.md` exists,
write or refresh the managed harness instruction block through
`commands/setup.md`, and add a kickoff record entry.

If `goals/GOAL.md` already exists, `set` is update mode: refresh scaffolding
and managed instruction blocks only. Do not rewrite `GOAL.md` unless the human
explicitly asks and confirms each changed line.

## review

Use for periodic strategic checkpoints, not daily work. Run when at least two
weeks have passed, at least 30 entries accumulated, a major decision depends on
current status, a new agent inherits the initiative, or the human says things
feel off.

Review:

1. Read `GOAL.md`, records, open STOPs, and stories if present.
2. Check each criterion trajectory with evidence.
3. Name the current principal tension.
4. Identify the implicit theory of getting there and whether recent evidence
   still supports it.
5. Surface STOP candidates the daily loop missed.
6. Check protocol drift: open STOP index sync, stale criteria, naked verdicts,
   rotation problems, GOAL inconsistency, and design/fact cross-skill drift.
7. Apply routine record/index hygiene when it is factual and reversible.
8. Ask before changing `GOAL.md`, resolving STOPs, or changing criteria.
9. Append a review record entry after approved goal-level fixes.

Do not invent new criteria during review unless the human explicitly requests a
GOAL change.

## STOP Handling

STOPs halt work until the human chooses.

- Type A: a criterion is failing or predictably off track.
- Type B: criteria may be met, but evidence questions the General Line.

Surface the STOP in chat with options. For Type A: change path, change
criterion, or agent misjudged. For Type B: reframe the General Line or stay
course because evidence is weak.

A STOP is not a failure report. It is target correction under observation: the
observed trajectory no longer supports silent continuation.

Do not turn ordinary path uncertainty into a STOP. If the agent can try a
reversible path correction and observe the result, do that first. STOP only
when the target, criteria, or General Line may be wrong.

## Stories

Stories are optional interpretation files under `goals/stories/`. Propose one
only when terse GOAL wording needs context, a criterion needs interpretation, or
a tempting non-goal needs rationale. Draft paragraph by paragraph and get
approval before writing.
