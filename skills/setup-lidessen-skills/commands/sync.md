# Setup lidessen skills — `sync`

Re-align an already-setup project with the current canonical lidessen content.

## Steps

1. **Detect host tool & target file** per SKILL.md "Tool detection".
2. **Locate existing markers** in the target file (`<!-- lidessen-setup:begin -->` ... `<!-- lidessen-setup:end -->`). If absent, abort and recommend `init` — `sync` requires existing markers and never creates new ones.
3. **Read existing version** from the begin marker (`v=<N>`).
4. **Read current canonical content** from `references/cross-cutting-principles.md` (and any other registered references the SKILL.md has been extended to use).
5. **Diff** the existing section content against the canonical. Classify changes per `audit.md`'s schema (missing / changed / removed-upstream).
6. **If no diff**: report "already in sync at v=N" and exit without writing. This is the common case after a no-op upstream change and should be cheap.
7. **If diff present**:
   - Replace content between markers with current canonical, byte-for-byte.
   - Bump version to `v=<N+1>`.
   - Preserve content outside the markers exactly — every byte. Do not even normalize whitespace.
8. **Report** diff summary to the user: principles added / changed / removed, version transition (v=N → v=N+1).

## Invariant

After `sync`, the section between markers is byte-identical to the canonical references (modulo the version marker). This is the principal contradiction of this command: get this right and everything else is detail; get it wrong (e.g., partial overwrite, stale content, drifted whitespace) and consumers downstream silently diverge.

## Failure modes

- Begin marker present but end marker missing (or vice versa) → abort. Ask the user to repair the file manually before `sync` will operate.
- Multiple begin/end pairs in the same file → abort; ambiguous, this skill writes exactly one section.
- Canonical reference missing or unreadable → abort; surface the error. Do not write a partial section.
- Target file modified concurrently (e.g., during a merge) → standard git-conflict territory; do not auto-resolve.

## What `sync` deliberately doesn't do

- It does not delete the markers, even if the canonical content becomes empty (an empty section between markers is a legitimate state).
- It does not move the markers within the file. Position is owned by `init` and by the user.
- It does not preserve user content placed *inside* the markers. Such content is reported as "removed upstream" by `audit` and will be deleted on `sync`. Users who want persistent custom content must place it outside the markers.
