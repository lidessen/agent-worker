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

If the user names a layer, audit only that layer.

## Process

1. Read `references/routing.md` and `references/artifact-policy.md`.
2. Identify active artifacts in the repo.
3. For each finding, classify it:
   - current-state drift;
   - historical note only;
   - missing evidence;
   - unresolved decision;
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
