# Setup lidessen skills — `audit`

Read-only check: report drift between the project's lidessen section and the current canonical content. **Never writes.** This is also the default subcommand when `/setup-lidessen-skills` is invoked without an argument.

## Steps

1. **Detect host tool & target file** per SKILL.md "Tool detection".
2. **Locate existing markers** (`<!-- lidessen-setup:begin -->` ... `<!-- lidessen-setup:end -->`). If absent, report "not yet set up; run `/setup-lidessen-skills init`" and exit cleanly. Not an error.
3. **Read existing section** content between markers, plus the existing version (`v=<N>`).
4. **Read current canonical content** from `references/cross-cutting-principles.md`. Note the canonical version (`v=<M>`).
5. **Diff and classify each principle**:
   - **Missing**: present in canonical, not in project section. Will be added on next `sync`.
   - **Changed**: present in both, text differs. Will be updated on next `sync`.
   - **Removed upstream**: present in project section, not in canonical. Will be deleted on next `sync`. Flag this prominently — if the user added their own content inside the markers, they will lose it; recommend they relocate it outside the markers before running `sync`.
6. **Report** in the four-section format below.
7. **Exit cleanly** without modifying any file — including timestamps, line endings, anything.

## Output format

```
Lidessen audit — <target file>, project v=N (canonical v=M)

Missing (will be added by sync):
  - <principle title>
  - ...

Changed (will be updated by sync):
  - <principle title> (<line-level summary, e.g. "3 lines changed">)
  - ...

Removed upstream (will be deleted by sync — relocate any user content outside the markers first):
  - <principle title or excerpt>
  - ...

Recommendation: run `/setup-lidessen-skills sync` to apply, or stay at v=N if you have local edits to preserve.
```

If everything is in sync, the four lists are empty and the output collapses to:

```
Lidessen audit — <target file>, v=N (canonical v=N)
In sync. No action needed.
```

## Failure modes

- Markers malformed (orphan begin/end, duplicate pairs) → report the malformation and recommend repair. Do not attempt to interpret a malformed section.
- Canonical reference missing or unreadable → report the error. Audit cannot proceed without ground truth.
- Target file unreadable → report and exit.

## Why audit defaults

`audit` is the default invocation because it is read-only and surfaces enough information for the user to choose between `init` (if no markers exist), `sync` (if drift exists), or no-op (if in sync). Defaulting to a writing operation would risk surprise; defaulting to audit makes the cost of an accidental invocation effectively zero.
