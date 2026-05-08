# Setup lidessen skills — `init`

Scaffold the lidessen section in a project that doesn't yet have one.

## Steps

1. **Detect host tool** per SKILL.md "Tool detection". If multiple configs are present, ask the user which to target. If none, ask the user to confirm which tool they're configuring before creating the target file.
2. **Identify target file** based on detected tool.
3. **Check for existing markers** (`<!-- lidessen-setup:begin -->`) in the target file. If found, abort and recommend `sync` instead — `init` is for fresh scaffolding only and would clobber existing user state.
4. **Read current canonical content** from `references/cross-cutting-principles.md`. This is the single source of truth for what goes between the markers.
5. **Choose layout** based on the target file's existing structure:
   - **Integrated layout** (preferred when the target file already has a guidance section): if a heading like `## Guiding Principles`, `## Principles`, or similar exists, the markers nest *under* that heading. The heading stays user-owned and outside the markers; only the canonical principle content goes between them. This is what the lidessen/skills repo itself uses.
   - **Standalone layout** (preferred for greenfield consumer projects): the markers wrap a self-contained block including its own heading. Used when no suitable existing section can host the content.
6. **Compose the section** based on chosen layout:
   - **Integrated**:
     - Open marker: `<!-- lidessen-setup:begin v=1 -->`
     - The principle content from `references/cross-cutting-principles.md`, copied verbatim (h3 headings as in the reference).
     - Close marker: `<!-- lidessen-setup:end -->`
     - Outside the markers, immediately after, append a one-line note pointing the user at the canonical reference and instructing them to run `sync` for updates.
   - **Standalone**:
     - Open marker with version: `<!-- lidessen-setup:begin v=1 -->`
     - Heading: `## Lidessen Guiding Principles`
     - One-line preamble: this section is managed by `/setup-lidessen-skills`; do not hand-edit; run `/setup-lidessen-skills sync` to update.
     - The principle content from `references/cross-cutting-principles.md`, copied verbatim. (Heading depth: keep h3 — they nest under the standalone-layout h2 heading.)
     - Close marker: `<!-- lidessen-setup:end -->`
7. **Write the section** at an appropriate position in the target file:
   - **Integrated layout**: insert markers + content under the existing heading.
   - **Standalone layout**: append at the bottom of the file. If the file doesn't exist, create it with a minimal scaffold (top-level title + one sentence stating it provides agent guidance) and append the standalone section.
8. **Report what happened** to the user — which file, where the section was inserted, the version, and any user action required (e.g., "the principles refer to skills X/Y/Z; make sure you've cloned or symlinked them into your `skills/` directory").

## Failure modes

- Target file is binary, malformed, or unreadable → abort, report the underlying error.
- User cannot or will not specify which tool when ambiguous → abort; this skill does not guess.
- Existing markers detected → instruct the user to run `sync` instead; do not overwrite.
- Canonical reference file missing or unreadable → abort; surface the read error to the user. Do not write a partial section.

## Output

A short status: target file path, version written, lines added, and any user follow-up required.
