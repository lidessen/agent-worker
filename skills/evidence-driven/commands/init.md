# evidence-driven:init — One-time scaffolding

Wire up agent configs and optional tooling so evidence-driven's
discipline applies during build sessions. Evidence-driven has no
artifacts of its own (no `evidence/` directory, no log files); init's
job is purely to make the discipline visible to AI agents working on
the project.

If the project doesn't have design-driven installed, evidence-driven
still works as a standalone overlay on whatever task structure exists.
But it's most natural alongside design-driven blueprints — consider
running `/design-driven init` first if architectural docs would help
the project.

## Steps

### 1. AI agent config

Add evidence-driven instructions to every AI agent config the project
uses. Common locations:

- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `AGENTS.md` or `codex.md` — Codex / OpenAI agents
- `.github/copilot-instructions.md` — GitHub Copilot
- `.windsurfrules` — Windsurf
- Any other agent instruction file the project uses

Minimal paste-ready snippet — append to each config, adjust to the
project's tone:

```markdown
## Evidence-driven build discipline

When working on production code paths, follow the evidence-driven
protocol:

- Every Verify check-off cites a falsifiable observation. "Looks right"
  is rejected; "test X failed before this change, passed after" or
  equivalent specific evidence is required.
- Default to TDD when the work is code with deterministic inputs:
  write the failing test first, see it fail for the right reason,
  then write the minimal code to pass.
- State updates after every TODO check-off must be specific enough
  to audit later — what changed, where, what now works that didn't.
  "Done" is not a State entry; "added `limit` parameter to query()
  at store.ts:42, 14/14 tests pass" is.
- Before claiming a test as evidence, articulate what specific failure
  it catches. A test that passes regardless of the code under test
  isn't evidence.
- Skip the discipline explicitly for prototypes, throwaways, or
  documentation-only changes — don't pretend to apply it.
```

Trim or expand to fit the project's tone. The goal is the rules land
in the config, not a specific wording.

### 2. Pre-commit hook (optional)

A pre-commit hook can enforce evidence-driven discipline mechanically
— rejecting commits that change source code without a corresponding
test change, reminding to update State if a blueprint is modified,
flagging "looks right" or naked verdicts in commit messages.

This is **opt-in and project-specific**. Pre-commit gates make sense
for projects with established testing infrastructure and consistent
build output; they're noise for projects where the work doesn't fit
the gate's assumptions (e.g., refactors with no behavior change, glue
code with no clean test surface).

If the human wants pre-commit hooks:
- The harness skill covers hook configuration methodology
- Recommended starting hooks (in rough order of value):
  1. **Source/test parity reminder** — if any file under `src/` is
     staged but no file under `test/` (or equivalent) is staged, emit
     a reminder. Don't block — remind. The agent decides if the
     change genuinely doesn't need a test.
  2. **State update reminder on blueprint edits** — if a blueprint is
     staged with TODO check-offs but the State section hasn't been
     touched, emit a reminder.
  3. **Commit message gate on "looks right" / "should work"** — if
     the commit message contains weasel phrases, reject and ask for
     specific evidence in the message.

Reminders > blocks for most projects. Blocks frustrate when the gate
is wrong; reminders inform without breaking flow.

### 3. CI integration (optional)

For projects with CI, evidence-driven aligns with two CI patterns:

- **Test-must-fail-then-pass for new tests** — for tests added in a
  PR, run them once against the parent commit (expect fail) and once
  against the PR commit (expect pass). Catches non-falsifiable tests
  that pass either way.
- **Coverage delta as a signal not a gate** — tests added without
  meaningfully exercising new code suggest cargo-culting. Surface as
  a comment, don't block.

These are advanced; most projects benefit more from the agent-level
discipline than from CI gates. Only set up CI integration if the
project already has CI infrastructure.

### 4. Commit

Commit the agent config updates and any hook configs together as the
initial evidence-driven setup. One commit, clear message:
`evidence-driven: init agent configs`.

### 5. Tell the human what's next

- The discipline applies from the next session onward — no separate
  "start" command needed. Open a blueprint, run `/design-driven` (if
  installed), and the agent will apply evidence-driven principles to
  Build/Verify naturally.
- If recurring evidence-quality problems show up after some real use,
  ask the agent to "review my recent evidence quality" — no dedicated
  command, but the SKILL.md principles tell it what to look for. When
  design-driven is also installed, its `/design-driven audit` will
  naturally surface evidence-quality issues during its blueprint pass.
- If the discipline feels heavy for a particular project, that's a
  signal — either the project doesn't fit (use a lighter approach),
  or the discipline needs tuning.
