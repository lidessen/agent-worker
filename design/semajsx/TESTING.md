# Testing Guide

This document provides comprehensive testing documentation for SemaJSX.

## Overview

SemaJSX uses **Vitest** with a dual testing strategy:

- **Node Environment**: For pure logic tests (signals, computed, utils)
- **Browser Mode + Playwright**: For DOM rendering tests with real browser APIs

## Testing Philosophy

1. **Logic in Node, behavior in Browser**
   - Pure functions and signal reactivity → Node environment (fast)
   - DOM manipulation, events, rendering → Browser Mode (real browser)

2. **Same framework, multiple strategies**
   - Use Vitest across all packages
   - Each package configures its appropriate environment

## Test File Organization

Tests are **collocated** with source files (placed next to the files they test):

```
packages/dom/src/
  render.ts
  render.test.tsx      # Test file next to source
  hydrate.ts
  hydrate.test.tsx
  operations.ts
  operations.test.ts
```

**Naming convention:**

- `xxx.test.ts` for TypeScript tests
- `xxx.test.tsx` for JSX tests (when using JSX syntax)

## Test Environment by Package

| Package             | Environment | Purpose                            |
| ------------------- | ----------- | ---------------------------------- |
| `@semajsx/signal`   | Node        | Signal primitives, computed values |
| `@semajsx/core`     | Browser     | VNode creation, runtime helpers    |
| `@semajsx/dom`      | Browser     | DOM rendering, events, hydration   |
| `@semajsx/ssr`      | Node        | SSR, island architecture           |
| `@semajsx/terminal` | Node        | Terminal rendering                 |
| `@semajsx/utils`    | Node        | Utility functions                  |

## Dependencies

Each package declares its own test dependencies:

```bash
# Node environment tests (already included with vitest)
bun add -D vitest

# Browser Mode tests
bun add -D vitest @vitest/browser-playwright
```

## Configuration

### Monorepo Workspace Setup

SemaJSX uses Vitest's `test.projects` to manage tests across the monorepo. Each package has its own `vitest.config.ts`.

**Root configuration**:

```ts
// vitest.config.ts (root)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
```

**Running tests**:

```bash
vitest                    # Run all projects
vitest --project=dom      # Run specific package
```

> Note: Vitest 3.2+ deprecated `vitest.workspace.ts` in favor of `test.projects`.

### Per-Package Configuration

#### Node Environment (Signal/Utils)

```ts
// packages/signal/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

#### Browser Mode (DOM/Core)

```ts
// packages/dom/vitest.config.ts
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  esbuild: {
    jsxImportSource: "@semajsx/dom",
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

### Using defineProject for Sub-packages

For better type hints in sub-packages, use `defineProject`:

```ts
// packages/dom/vitest.config.ts
import { defineProject } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineProject({
  esbuild: {
    jsxImportSource: "@semajsx/dom",
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

## Running Tests

```bash
# Run all tests across all packages
bun run test

# Run tests for a specific package
cd packages/signal && bun run test
cd packages/dom && bun run test

# Run with specific browser (for browser tests)
bun run test --browser=chromium
bun run test --browser=firefox

# Run in headed mode for debugging
bun run test --browser.headless=false
```

## Test Examples

### Node Environment Test Example (Signal)

```ts
// packages/signal/src/signal.test.ts
import { describe, it, expect } from "vitest";
import { signal, computed } from "./index";

describe("signal", () => {
  it("should update value reactively", () => {
    const count = signal(0);
    expect(count.value).toBe(0);

    count.value = 5;
    expect(count.value).toBe(5);
  });

  it("should compute derived values", () => {
    const count = signal(5);
    const doubled = computed([count], (c) => c * 2);

    expect(doubled.value).toBe(10);

    count.value = 10;
    expect(doubled.value).toBe(20);
  });
});
```

### Browser Mode Test Example (DOM)

```tsx
// packages/dom/src/render.test.tsx
/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signal } from "@semajsx/signal";
import { render } from "./render";

describe("render", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should render simple element", () => {
    const vnode = <div class="test">Hello</div>;
    render(vnode, container);

    expect(container.innerHTML).toContain('<div class="test">Hello</div>');
  });

  it("should render signal as text", async () => {
    const count = signal(5);
    const vnode = <div>{count}</div>;
    render(vnode, container);

    expect(container.textContent).toContain("5");

    count.value = 10;
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(container.textContent).toContain("10");
  });

  it("should handle event handlers", () => {
    let clicked = false;
    const vnode = (
      <button
        onclick={() => {
          clicked = true;
        }}
      >
        Click me
      </button>
    );
    render(vnode, container);

    const button = container.querySelector("button");
    button?.click();

    expect(clicked).toBe(true);
  });

  it("should render components", () => {
    const Greeting = ({ name }: { name: string }) => {
      return <h1>Hello, {name}!</h1>;
    };

    const vnode = <Greeting name="World" />;
    render(vnode, container);

    expect(container.textContent).toBe("Hello, World!");
  });
});
```

## Test Best Practices

1. **Use JSX Import Source**
   - Always add `/** @jsxImportSource @semajsx/dom */` at the top of DOM test files
   - For terminal tests, use `/** @jsxImportSource @semajsx/terminal */`

2. **Async Signal Updates**
   - Signal updates are batched via microtasks
   - Use `await new Promise((resolve) => queueMicrotask(resolve))` to wait for updates

3. **Container Cleanup**
   - Always clean up DOM containers in `afterEach`
   - Call `unmount()` when testing component lifecycle

4. **Test Isolation**
   - Each test should be independent
   - Don't share mutable state between tests

## CI/CD Integration

For CI environments, ensure Playwright browsers are installed:

```bash
# Install Playwright browsers with dependencies
bun playwright install --with-deps chromium
```

Run tests in headless mode (default):

```bash
# Fast feedback: Run Node tests first
bun run test --filter signal
bun run test --filter core

# Then run browser tests
bun run test --filter dom
```

## Debugging Browser Tests

1. **Run in headed mode**:

   ```bash
   cd packages/dom && bun run test --browser.headless=false
   ```

2. **Use Vitest UI**:

   ```bash
   bun run test --ui
   ```

3. **Browser DevTools**: In headed mode, you can open browser DevTools to inspect elements and debug
