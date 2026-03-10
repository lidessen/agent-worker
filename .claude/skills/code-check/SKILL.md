---
name: code-check
description: "Run code quality checks: formatting (oxfmt), linting (oxlint), and type checking (tsgo). Automatically fix issues when possible, but only apply fixes that are semantically correct — never suppress errors, add meaningless type casts, or degrade code quality just to pass checks. Trigger on phrases like 'code check', 'check code', 'run checks', 'lint and format', 'typecheck'."
---

# Code Check Skill

Run formatting, linting, and type checking across the monorepo. Fix issues intelligently.

## Commands

```bash
# Format
bun run fmt:check    # check only
bun run fmt          # auto-fix (oxfmt --write .)

# Lint
bun run lint         # check only
bun run lint:fix     # auto-fix (oxlint --fix)

# Typecheck
bun run typecheck    # tsgo --build
```

## Execution order

1. **Format** — Run `bun run fmt:check`. If issues found, run `bun run fmt` to auto-fix. Formatting is always safe to auto-apply.
2. **Lint** — Run `bun run lint`. If warnings/errors found, review each one and fix in source code. Use `bun run lint:fix` only for mechanical fixes (unused imports, sort order, etc.). For semantic issues, read the code and fix properly.
3. **Typecheck** — Run `bun run typecheck`. If errors found, read the relevant source files, understand the intent, and fix the root cause.

## Fix principles — CRITICAL

When fixing issues, you MUST follow these rules:

- **Never add `// @ts-ignore`, `// @ts-expect-error`, `as any`, or `as unknown as X`** just to silence type errors. Find the real type mismatch and fix it.
- **Never delete or stub out code** to make checks pass. If a function has a type error, fix the function's types or its callers — don't remove the function.
- **Never add `// eslint-disable` or equivalent suppression comments** unless the rule is genuinely wrong for that line and you explain why.
- **Understand before fixing** — Always read the surrounding code to understand the author's intent before changing anything. A type error might mean the type definition is wrong, not the usage.
- **Prefer minimal fixes** — Change as little as possible. If adding one missing property to an interface fixes 10 errors, that's better than editing 10 call sites.
- **Report unfixable issues** — If a fix would require architectural changes or you're unsure of the correct approach, report the issue to the user instead of guessing.

## Output

After all checks, provide a summary:

```
## Code Check Results
- Format: ✓ passed (or: fixed N files)
- Lint: ✓ passed (or: N warnings, fixed M, N remaining)
- Typecheck: ✓ passed (or: N errors, fixed M, N remaining)
```

List any remaining issues that need manual attention.
