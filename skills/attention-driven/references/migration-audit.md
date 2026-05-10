# Migration Audit

Temporary audit notes from merging the old methodology skills into
`attention-driven`. This file exists to prevent useful theory notes from being
lost during compression. Items here can later be promoted into focused
references or deleted after review.

## Source-by-Source Coverage

### goal-driven

- `skills/goal-driven/SKILL.md` -> absorbed into `commands/go.md`,
  `commands/goal.md`, `references/goal.md`, `references/routing.md`.
  Recovered after second pass: compass/path asymmetry, permission gradient,
  interrupted record drafts, trajectory verdicts, stories as topical synthesis,
  and structure-follows-need.
- `skills/goal-driven/commands/set.md` -> absorbed into `commands/goal.md` and
  `references/templates.md`. Detailed interview examples were not carried over
  verbatim. Useful retained ideas: human commitment to wording, criteria IDs are
  stable, soft criteria need proxies, non-goals name tempting wrong work.
- `skills/goal-driven/commands/review.md` -> absorbed into `commands/goal.md`
  and `commands/audit.md`. Detailed review report template is compressed; if
  review usage grows, promote a fuller review template back into
  `references/templates.md`.
- `skills/goal-driven/commands/close.md` -> absorbed into `commands/close.md`.
  Detailed retrospective prompts are compressed.
- `skills/goal-driven/references/stories.md` -> absorbed into
  `references/goal.md`. Full story protocol is compressed; if stories become
  common, restore a dedicated `references/stories.md`.
- `skills/goal-driven/references/templates.md` -> merged into
  `references/templates.md`.
- `skills/goal-driven/references/example.md` -> intentionally not migrated.
  It is an example, not theory. Recreate examples later only if the compressed
  protocol proves ambiguous.

### design-driven

- `skills/design-driven/SKILL.md` -> absorbed into `commands/design.md`,
  `references/design.md`, `references/artifact-policy.md`, and
  `references/routing.md`. Recovered after second pass: design applies across
  the full development cycle, pending-claims scan, past blueprints are records
  not state, State as resumption surface, and close-out keeps design current.
- `skills/design-driven/commands/init.md` -> absorbed into `commands/setup.md`
  and `references/setup.md`. Hook-specific examples are mostly omitted; keep
  hooks as setup detail, not core method.
- `skills/design-driven/commands/bootstrap.md` -> absorbed into
  `commands/design.md`. Full bootstrap walkthrough is compressed; if bootstrap
  becomes frequent, add a focused `commands/design-bootstrap.md`.
- `skills/design-driven/commands/audit.md` -> absorbed into `commands/audit.md`
  and `references/design.md`. Recovered after second pass: audit buckets
  doc-only drift / shape-level drift / code-should-change.
- `skills/design-driven/references/cold-review-prompt.md` -> preserved as
  `references/cold-review-prompt.md`.
- `skills/design-driven/references/templates.md` -> merged into
  `references/templates.md`.
- `skills/design-driven/references/writing-guide.md` -> preserved as
  `references/writing-guide.md`.
- `skills/design-driven/references/example.md` -> intentionally not migrated.
  It is secondary example material.

### evidence-driven

- `skills/evidence-driven/SKILL.md` -> absorbed into `commands/fact.md` and
  `references/fact.md`. Recovered after second pass: falsifiability questions,
  TDD as pressure not ritual, hollow State warning, skip cases, and the future
  agent final test.
- `skills/evidence-driven/commands/init.md` -> absorbed into `commands/setup.md`
  and `references/setup.md`. CI/pre-commit examples are not migrated; add later
  only if setup needs mechanical enforcement.

### reframe

- `skills/reframe/SKILL.md` -> absorbed into `commands/reframe.md`,
  `references/reframe.md`, `references/routing.md`, and `references/traps.md`.
  Recovered after second pass: skeleton/flesh distinction, transfer learning,
  flesh governance, stress-test outcomes, and comprehension diagnosis paths.
- `skills/reframe/commands/init.md` -> absorbed into `commands/reframe.md` and
  `commands/setup.md`.
- `skills/reframe/commands/explain.md` -> absorbed into `commands/reframe.md`.
  Detailed audience-tailoring workflow is compressed; restore later if explain
  becomes a frequent command.
- `skills/reframe/commands/close.md` -> absorbed into `commands/reframe.md` and
  `commands/close.md`. Detailed close prompts are compressed.
- `skills/reframe/references/cross-skill.md` -> absorbed into
  `references/routing.md` and `references/reframe.md`.
- `skills/reframe/references/phase-guide.md` -> partially absorbed into
  `references/reframe.md`. Full phase examples remain intentionally compressed;
  this is the biggest place where detail was reduced. If quality drops, restore
  a dedicated `references/reframe-phase-guide.md`.
- `skills/reframe/references/template.md` -> merged into
  `references/templates.md`.
- `skills/reframe/references/traps.md` -> compressed into `references/traps.md`.

### harness

- `skills/harness/SKILL.md` -> absorbed into `references/harness.md`,
  `references/artifact-policy.md`, and `commands/setup.md`. Recovered after
  second pass: layer violations, succession over persistence, abstraction level
  as lifecycle, and finite human bandwidth.
- `skills/harness/commands/init.md` -> absorbed into `commands/setup.md`.
  Detailed generated instruction examples are compressed.
- `skills/harness/commands/audit.md` -> absorbed into `commands/audit.md`.

### setup-lidessen-skills

- `skills/setup-lidessen-skills/SKILL.md` -> absorbed into `commands/setup.md`
  and `references/setup.md`. Recovered after second pass: setup's principal
  contradiction is injected managed content, not detection mechanics.
- `skills/setup-lidessen-skills/commands/init.md` -> absorbed into
  `commands/setup.md`.
- `skills/setup-lidessen-skills/commands/sync.md` -> absorbed into
  `commands/setup.md`.
- `skills/setup-lidessen-skills/commands/audit.md` -> absorbed into
  `commands/audit.md`.
- `skills/setup-lidessen-skills/references/cross-cutting-principles.md` ->
  absorbed into `references/artifact-policy.md`, `references/harness.md`, and
  `references/setup.md`.

## Candidate Restores

These were not restored as full files yet:

- `references/stories.md`: restore only if goal stories become common enough to
  need more than the compressed paragraph in `references/goal.md`.
- `references/reframe-phase-guide.md`: restore if reframe quality suffers from
  losing worked examples and detailed phase diagnostics.
- `commands/design-bootstrap.md`: restore if design bootstrap is common enough
  that `commands/design.md` becomes too dense.
- `commands/fact-init.md`: restore only if setup needs CI/pre-commit examples.

## Audit Judgment

The important theory notes are now either integrated into focused references or
listed in this temporary audit file. The intentionally omitted material is
mostly worked examples, verbose setup walkthroughs, and command-specific detail
that can be regenerated if the compressed method proves insufficient.
