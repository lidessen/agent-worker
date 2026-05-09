# RFC: Visual-Rich Terminal Logger

**Date**: 2025-10 (retroactive)
**Status**: Implemented
**Design Doc**: [design/designs/logger-api-design.md](../designs/logger-api-design.md)

---

## Summary

Build a modern, visually-rich logging utility for terminal applications that leverages SemaJSX's terminal rendering capabilities and JSX syntax.

---

## Motivation

### Problem

Existing terminal loggers are text-focused and limited:

```ts
// Traditional logging - plain text only
console.log("✓ Success");
console.log(chalk.green.bold("✓") + " Success"); // Verbose
logger.info("Processing...", { progress: 75 }); // No visual feedback
```

**Pain points**:

- No structured layouts (tables, progress bars, boxes)
- Verbose syntax for styling
- No JSX support for complex output
- Each tool solves one problem (ora for spinners, cli-table for tables, etc.)

### User Scenario

**As a CLI tool developer**, I want to create beautiful, structured terminal output with JSX, so that my logs are easier to read and more informative.

---

## Goals

- ✅ Visual-rich logging (tables, progress bars, styled output)
- ✅ JSX-first API (leverage SemaJSX terminal rendering)
- ✅ Chainable, intuitive API
- ✅ Built-in components (no external dependencies for common needs)
- ✅ Performance timing utilities

---

## Non-Goals

- ❌ File logging (focus on terminal output)
- ❌ Log rotation/persistence
- ❌ Network logging
- ❌ Replace structured logging for servers (use Winston/Pino for that)

---

## Proposed Solution

### API Overview

```tsx
import { createLogger } from "@semajsx/logger";

const logger = createLogger();

// Standard logging
logger.info("Server started");
logger.success("Build complete");
logger.error("Connection failed");

// JSX content
logger.jsx(
  <box border="round" padding={1}>
    <text color="green" bold>
      ✓ Deployment successful
    </text>
  </box>,
);

// Tables
logger.table(data, { border: "round", headerSeparator: true });

// Progress
logger.progress(75, 100, "Building...");

// Grouping
logger.group("Tests").success("✓ test1").error("✗ test2").groupEnd();
```

### Key Design Choices

1. **JSX-native** - First logger with JSX support for complex layouts
2. **Visual-first** - Structured components (tables, progress, boxes)
3. **Chainable API** - Fluent, readable syntax
4. **One-time rendering** - Uses `print()` not `render()` (no signals)
5. **Built-in utilities** - Timing, tables, progress (no extra deps)

---

## Alternatives Considered

### Alternative A: Use Existing Loggers (Winston/Pino)

**Rejected**: Server-focused, text-only, no terminal UI features

### Alternative B: Use CLI UI Libraries (Ink, Blessed)

**Rejected**: Too heavy, require full TUI, we only need logging

### Alternative C: Use Chalk + Ora + CLI-Table

**Rejected**: Multiple dependencies, inconsistent APIs, no JSX

---

## Success Metrics

- ✅ Logger implemented with all features
- ✅ Zero external dependencies for core features
- ✅ Examples demonstrate visual richness
- ✅ Developer feedback positive

---

## Implementation

See [Design Document](../designs/logger-api-design.md) for detailed API.

**Key features**:

- Standard log levels (debug, info, success, warn, error)
- JSX content support
- Tables with customizable borders
- Progress bars
- Grouping with indentation
- Performance timing (`time`, `measure`)
- Child loggers and tags

---

## Decision

**Accepted**: 2025-10

**Rationale**:

1. Unique value proposition (JSX in logs)
2. Leverages existing SemaJSX terminal rendering
3. Solves real need for CLI tool developers
4. No performance overhead (one-time rendering)

**Next Steps**:

- [x] Design document created
- [x] Implementation complete
- [x] Examples created
- [x] Documentation published
