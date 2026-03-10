---
name: gen-test
description: "Generate unit tests for a given module using bun:test conventions and existing test patterns. Use when the user asks to generate tests, add test coverage, or create a test file. Trigger on phrases like 'gen test', 'generate tests', 'add tests for', 'write tests', 'test coverage'."
---

# Generate Tests Skill

Generate unit tests for a specified module, following the project's existing test conventions.

## Conventions

- **Test framework**: `bun:test` (`import { test, expect, describe, beforeEach, mock } from "bun:test"`)
- **File location**: Tests live in `packages/<pkg>/test/` mirroring the src structure
- **Naming**: `<module-name>.test.ts`
- **Style**: Flat `test()` calls or shallow `describe()` blocks. No deep nesting.

## Workflow

1. **Read the target module** — Understand exports, types, and dependencies
2. **Find existing tests** in the same package for pattern reference
3. **Generate tests** covering:
   - Happy path for each exported function/class
   - Edge cases (empty input, null, boundary values)
   - Error paths (invalid input, thrown errors)
4. **Use mocks sparingly** — Only mock external dependencies (network, filesystem, other packages). Never mock the module under test.
5. **Run the tests** — Execute `bun test <test-file>` to verify they pass

## Test structure template

```ts
import { test, expect, describe } from "bun:test";
import { functionUnderTest } from "../src/module";

describe("functionUnderTest", () => {
  test("returns expected result for normal input", () => {
    expect(functionUnderTest("input")).toBe("expected");
  });

  test("handles edge case", () => {
    expect(functionUnderTest("")).toBe(null);
  });

  test("throws on invalid input", () => {
    expect(() => functionUnderTest(null as any)).toThrow();
  });
});
```

## Rules

- **No snapshot tests** unless the user explicitly asks for them
- **No test IDs or UUIDs** — Use deterministic values
- **Keep tests focused** — One assertion concept per test
- **Descriptive test names** — Name should describe the behavior, not the implementation
