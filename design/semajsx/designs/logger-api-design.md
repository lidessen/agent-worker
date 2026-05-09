# 🎨 SemaJSX Terminal Logger - API Design Document

## Overview

A modern, visually-rich logging utility built on SemaJSX's terminal rendering capabilities. Unlike traditional console-based loggers, this logger leverages JSX, flexbox layouts, and rich terminal features to create beautiful, structured logs.

## Design Philosophy

### 1. **Visual-First Approach**

Traditional loggers focus on text output. SemaJSX Logger treats logs as visual components with:

- Structured layouts using Flexbox
- Rich styling (colors, bold, borders)
- Icons and visual indicators
- Tables and progress bars

### 2. **Developer Experience**

- **Chainable API** - All methods return `this` for fluent chaining
- **Type-Safe** - Full TypeScript support
- **Intuitive** - Natural API that reads like English
- **Flexible** - Support for strings, objects, and JSX

### 3. **Performance-Conscious**

- One-time rendering (no signal subscriptions)
- Minimal overhead
- Efficient terminal operations
- Direct output without virtual DOM

## Core API Design

### Basic Logging

```tsx
logger.debug("Debug information");
logger.info("General information");
logger.success("Operation successful");
logger.warn("Warning message");
logger.error("Error occurred");
```

**Design Decision**: Five log levels with distinct visual identities:

- `debug` - 🐛 Gray (subtle, for development)
- `info` - ℹ️ Cyan (neutral, informational)
- `success` - ✓ Green Bold (positive outcome)
- `warn` - ⚠️ Yellow Bold (caution)
- `error` - ✗ Red Bold (critical issues)

**Why these levels?**

- Covers 95% of use cases
- Clear visual hierarchy
- `success` is unique - celebrates positive outcomes (not in most loggers)
- Each has distinct emotional weight

### Structured Data

```tsx
logger.info({ user: "alice", action: "login" });
logger.info("Event", { data: "..." }, { meta: "..." });
```

**Design Decision**: Auto-format objects as JSON

- **Why?** Developers shouldn't manually stringify
- **Benefit**: Consistent formatting across the codebase
- **Multiple args**: Support additional context

### JSX Content

```tsx
logger.jsx(
  <box>
    <text color="green" bold>
      ✓
    </text>
    <text> Deployment successful</text>
  </box>,
);

logger.info(
  <text bold color="cyan">
    Custom styled content
  </text>,
);
```

**Design Decision**: First-class JSX support

- **Innovation**: No other logger lets you use JSX for log content
- **Benefit**: Ultimate flexibility for complex layouts
- **Use Case**: Status displays, dashboards, formatted output

### Groups

```tsx
logger.group("Database Migration");
logger.info("Step 1");
logger.success("Step 2");
logger.groupEnd();
```

**Design Decision**: Visual grouping with indentation

- **Why?** Related logs should be visually connected
- **Implementation**: Indentation + optional borders
- **Inspired by**: Browser console groups, but more visual

### Tables

```tsx
logger.table(data, {
  border: "round",
  borderColor: "cyan",
  headerSeparator: true,
});
```

**Design Decision**: Built-in table formatting

- **Why?** Tabular data is common in CLI tools
- **Benefit**: No need for external table libraries
- **Features**: Borders, colors, header separation

### Progress Bars

```tsx
logger.progress(75, 100, "Building", {
  width: 40,
  char: "█",
  emptyChar: "░",
  color: "green",
});
```

**Design Decision**: Visual progress indicators

- **Why?** Long-running tasks need visual feedback
- **Customizable**: Width, characters, colors
- **Use Cases**: Build processes, downloads, migrations

### Performance Timing

```tsx
// Manual timer
const timer = logger.time("Query");
// ... work ...
timer.end("Completed");

// Automatic measurement
await logger.measure("API Call", async () => {
  return await fetch(url);
});
```

**Design Decision**: Built-in performance tracking

- **Why?** Every dev needs to time operations
- **Two modes**: Manual (more control) vs Automatic (convenience)
- **Visual**: Shows ⏱ icon and formatted duration

### Tags

```tsx
const dbLogger = logger.withTags("database", "prod");
dbLogger.info("Query executed"); // Shows: #database #prod
```

**Design Decision**: Immutable tag addition

- **Why?** Tags help filter/search logs
- **Immutable**: `withTags()` returns new instance (safe)
- **Visual**: Uses `#` prefix (familiar from social media)

### Child Loggers

```tsx
const authLogger = logger.child("auth");
authLogger.info("Login"); // [auth] Login

const apiLogger = authLogger.child("v2");
apiLogger.info("Request"); // [auth:v2] Request
```

**Design Decision**: Hierarchical logger creation

- **Why?** Different modules need distinct contexts
- **Prefix chaining**: Supports nested modules
- **Benefit**: Easy to identify log source

## Advanced Features

### Custom Configuration

```tsx
const logger = createLogger({
  timestamp: true,
  timestampFormat: () => new Date().toISOString(),
  showLevel: true,
  minLevel: "info",
  prefix: "APP",
  stream: process.stderr,
  bordered: false,
  levelConfig: {
    success: { icon: "🎉", color: "greenBright" },
  },
});
```

**Design Decision**: Extensive customization

- **Philosophy**: Sensible defaults, full customization
- **Level config**: Per-level icon/color customization
- **Stream control**: stdout vs stderr routing

### Chainable API

```tsx
logger
  .info("Starting")
  .blank()
  .group("Tasks")
  .success("Task 1")
  .success("Task 2")
  .groupEnd()
  .separator();
```

**Design Decision**: All methods return `this`

- **Why?** Fluent, readable code
- **Benefit**: Less verbose, more expressive
- **Inspiration**: jQuery, Lodash chain patterns

### Utility Methods

```tsx
logger.separator("─", "gray"); // Visual separator
logger.blank(); // Blank line
```

**Design Decision**: Small helpers for common needs

- **Why?** Every logger needs these
- **Simple**: One-liners that improve readability

## Innovation Points

### 1. **JSX Integration**

**Unique**: First logger with native JSX support

- Traditional: `console.log(chalk.green.bold("✓") + " Success")`
- SemaJSX: `logger.jsx(<text bold color="green">✓ Success</text>)`

**Impact**: Clean syntax, powerful layouts

### 2. **Visual-Rich Output**

**Beyond text**: Uses flexbox, borders, colors, icons

- Traditional: Plain text lines
- SemaJSX: Structured visual components

**Impact**: Logs are easier to scan and understand

### 3. **Built-in Components**

**Integrated**: Tables, progress bars, groups

- Traditional: Requires separate libraries
- SemaJSX: Everything included, consistent styling

**Impact**: Single import for all logging needs

### 4. **Performance Timing**

**Built-in**: Timers and measurement utilities

- Traditional: Manual `console.time()` or external libraries
- SemaJSX: `logger.measure()` with automatic formatting

**Impact**: Encourages performance awareness

### 5. **Immutable Tags**

**Safe**: `withTags()` creates new instances

- Traditional: Mutable context objects
- SemaJSX: Functional, safe, predictable

**Impact**: No accidental tag pollution

## Comparison with Existing Solutions

### vs. Console

| Feature   | console        | SemaJSX Logger |
| --------- | -------------- | -------------- |
| Colors    | Manual (chalk) | Automatic      |
| Structure | None           | Flexbox        |
| Tables    | Basic          | Styled         |
| Progress  | None           | Built-in       |
| Timing    | Basic          | Rich           |
| JSX       | No             | Yes            |

### vs. Winston/Pino

| Feature     | Winston/Pino | SemaJSX Logger  |
| ----------- | ------------ | --------------- |
| Purpose     | Server logs  | CLI/Terminal    |
| Visual      | Text         | Rich UI         |
| Transports  | Yes          | No (not needed) |
| Performance | Fast         | Fast            |
| Format      | JSON         | Visual          |

### vs. Ora/Chalk

| Feature   | Ora/Chalk | SemaJSX Logger    |
| --------- | --------- | ----------------- |
| Spinners  | Yes       | No (use render()) |
| Colors    | Yes       | Yes               |
| Structure | No        | Yes (Flexbox)     |
| JSX       | No        | Yes               |
| Unified   | No        | Yes               |

## Use Cases

### 1. Build Tools

```tsx
logger.group("Building");
for (const file of files) {
  logger.progress(++i, total, file);
}
logger.groupEnd();
```

### 2. Server Startup

```tsx
logger.group("🚀 Server Init");
await logger.measure("DB", connectDB);
await logger.measure("Cache", connectCache);
logger.groupEnd();
```

### 3. CLI Tools

```tsx
logger.table(results);
logger.progress(done, total, "Processing");
logger.success("Complete!");
```

### 4. Test Runners

```tsx
logger.group("Tests");
logger.success("✓ test1");
logger.error("✗ test2");
logger.groupEnd();
```

### 5. DevOps Scripts

```tsx
const deploy = logger.withTags("deploy", "prod");
deploy.info("Starting deployment");
deploy.table(services);
deploy.success("Deployed");
```

## Technical Implementation

### Architecture

```
Logger
  ├── Configuration (options)
  ├── State (groupDepth, tags)
  ├── Core Methods (debug, info, warn, error)
  ├── Utility Methods (group, table, progress)
  ├── Advanced Features (time, measure, tags, child)
  └── Output (uses terminal.print)
```

### Key Decisions

**1. One-time rendering**

- Uses `print()` not `render()`
- No signal subscriptions
- Immediate output

**2. Immutable patterns**

- `withTags()` returns new instance
- `child()` returns new instance
- Safe, predictable behavior

**3. Type safety**

- Full TypeScript definitions
- Generic support for `measure<T>()`
- Union types for options

**4. Extensibility**

- Custom level configs
- Custom timestamp formats
- Stream control

## Future Enhancements (Potential)

### 1. Log Streaming

```tsx
const stream = logger.stream();
stream.info("Message 1");
stream.info("Message 2");
```

### 2. Filtering

```tsx
logger.filter({ level: "error", tag: "database" });
```

### 3. Buffering

```tsx
logger.buffer();
// ... logs buffered ...
logger.flush();
```

### 4. File Output

```tsx
logger.toFile("./logs/app.log");
```

### 5. Spinners

```tsx
const spinner = logger.spinner("Loading...");
spinner.stop();
```

## Conclusion

The SemaJSX Terminal Logger represents a new approach to logging:

- **Visual-first** rather than text-first
- **Component-based** using JSX
- **Developer-friendly** with chainable API
- **Feature-rich** with tables, progress, timing
- **Type-safe** with full TypeScript support

It's not just a logger - it's a terminal UI toolkit for creating beautiful CLI output.

## Examples

Run the examples:

```bash
bun run example:logger              # Basic usage
bun run example:logger:showcase     # Full showcase
```

## Documentation

See `src/terminal/logger/README.md` for complete API documentation.
