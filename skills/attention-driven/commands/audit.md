# attention-driven:audit

Audit layer: check drift across attention-driven artifacts without assuming the
problem is in one layer.

## Scope

Run the smallest useful audit:

- goal audit: criteria, records, STOPs, stories, naked verdicts.
- design audit: `design/` versus implementation and active blueprints.
- fact audit: whether done claims have falsifiable observations.
- reframe audit: whether open concepts still have a live question.
- harness audit: whether instruction files and managed blocks are current.
- decision audit: whether agents are blocked on human input for choices they
  could decide, review, and verify themselves.

If the user names a layer, audit only that layer.

In multi-initiative projects, the goal audit walks `features/*/` (excluding
`features/_done/`) in addition to `goals/`. Treat these as drift modes:

- a `features/<name>/` folder with no `GOAL.md` (someone started, did not
  finish setup);
- a closed initiative still outside `_done/` (criteria met, retrospective
  written, folder not archived);
- a feature with naked ✓/✗ verdicts in its record;
- a feature whose record has not been touched while work clearly happened
  (commits reference it, but no record entry).

## Process

1. Read `references/routing.md`, `references/artifact-policy.md`, and
   `references/decision.md`.
2. Identify active artifacts in the repo.
3. For each finding, classify it:
   - current-state drift;
   - historical note only;
   - missing evidence;
   - unresolved decision;
   - over-escalated decision;
   - setup/instruction drift.
4. Report findings before writing.
5. Apply fixes only after user approval unless the user already asked to patch.

## Finding Format

Use concise findings:

```markdown
- [layer] Problem.
  Evidence: file/path.md says X; code or artifact says Y.
  Suggested follow-up: update current artifact / open decision / add fact check
  / leave history alone.
```

Do not bulk rewrite old records to make them look consistent. Add a current
correction when needed.
