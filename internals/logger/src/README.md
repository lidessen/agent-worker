# SemaJSX Terminal Logger

A beautiful, feature-rich logging utility built on top of SemaJSX's terminal rendering capabilities.

## Features

- 🎨 **Rich Visual Styling** - Colors, icons, borders, and layouts
- 📊 **Structured Logging** - Tables, progress bars, and groups
- ⏱️ **Performance Timing** - Built-in timers and measurements
- 🏷️ **Tagging System** - Organize logs with tags
- 🎯 **Level Filtering** - Control log verbosity
- 🔧 **Customizable** - Full control over styling and behavior
- 📦 **JSX Support** - Use JSX for custom log content
- 👶 **Child Loggers** - Create contextual sub-loggers

## Installation

```bash
bun add semajsx
```

## Quick Start

```tsx
import { logger } from "@semajsx/logger";

// Basic logging
logger.info("Server started");
logger.success("Build complete!");
logger.warn("Deprecated API");
logger.error("Connection failed");
```

## API Overview

### Basic Logging

```tsx
logger.debug("Debug information");
logger.info("General information");
logger.success("Operation successful");
logger.warn("Warning message");
logger.error("Error occurred");
```

Each level has distinct styling:

- **debug**: 🐛 Gray, subtle
- **info**: ℹ️ Cyan, standard
- **success**: ✓ Green, bold
- **warn**: ⚠️ Yellow, bold
- **error**: ✗ Red, bold with border option

### Structured Data

Log objects and they'll be formatted automatically:

```tsx
logger.info({
  user: "alice",
  action: "login",
  timestamp: Date.now(),
});

// Multiple arguments
logger.info("Request received", { method: "GET", path: "/api/users" });
```

### JSX Content

Use JSX for completely custom styling:

```tsx
logger.jsx(
  <box flexDirection="row">
    <text color="green" bold>
      ✓
    </text>
    <text marginLeft={1}>Deployment</text>
    <text marginLeft={1} color="cyan" bold>
      v2.5.0
    </text>
    <text marginLeft={1}>successful</text>
  </box>,
);
```

### Log Groups

Organize related logs with visual grouping:

```tsx
logger.group("Database Migration");
logger.info("Connecting...");
logger.success("Connected");
logger.info("Running migrations...");
logger.success("Completed");
logger.groupEnd();
```

Options:

```tsx
logger.group("Tasks", {
  bordered: true, // Show border (default: true)
  borderColor: "cyan", // Border color (default: "cyan")
});
```

### Tables

Display structured data in table format:

```tsx
const users = [
  { name: "Alice", role: "Admin", status: "Active" },
  { name: "Bob", role: "User", status: "Active" },
];

logger.table(users, {
  border: "round", // Border style (default: "single")
  borderColor: "cyan", // Border color
  headerSeparator: true, // Show header separator (default: true)
});
```

### Progress Bars

Show task progress visually:

```tsx
logger.progress(75, 100, "Building", {
  width: 40, // Bar width (default: 40)
  char: "█", // Fill character (default: "█")
  emptyChar: "░", // Empty character (default: "░")
  showPercentage: true, // Show percentage (default: true)
  color: "green", // Bar color
});
```

Animated progress:

```tsx
for (let i = 0; i <= 100; i += 10) {
  logger.progress(i, 100, "Processing");
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

### Performance Timing

#### Manual Timers

```tsx
const timer = logger.time("Database Query");
// ... do work ...
timer.end("Completed successfully");

// Or just get elapsed time
const elapsed = timer.elapsed(); // milliseconds
```

#### Automatic Measurement

Measure async function execution:

```tsx
const result = await logger.measure("API Call", async () => {
  const response = await fetch("https://api.example.com");
  return response.json();
});
```

### Tags

Add contextual tags to logs:

```tsx
const dbLogger = logger.withTags("database", "production");
dbLogger.info("Query executed"); // Shows: #database #production

const apiLogger = logger.withTags("api", "v2");
apiLogger.warn("Rate limit reached"); // Shows: #api #v2
```

Tags are immutable - `withTags()` returns a new logger instance.

### Child Loggers

Create loggers with prefixes for different modules:

```tsx
const authLogger = logger.child("auth");
authLogger.info("Token generated"); // [auth] Token generated

const paymentLogger = logger.child("payment");
paymentLogger.info("Processing"); // [payment] Processing

// Nested prefixes
const stripeLogger = paymentLogger.child("stripe");
stripeLogger.info("Connected"); // [payment:stripe] Connected
```

### Utility Methods

```tsx
// Separator line
logger.separator("─", "gray");

// Blank line
logger.blank();

// Raw JSX (same as .jsx())
logger.jsx(<text>Custom content</text>);
```

## Configuration

Create a custom logger with options:

```tsx
import { createLogger } from "@semajsx/logger";

const customLogger = createLogger({
  // Show timestamps (default: true)
  timestamp: true,

  // Custom timestamp format
  timestampFormat: () => new Date().toISOString(),

  // Show log level (default: true)
  showLevel: true,

  // Minimum level to display (default: "debug")
  minLevel: "info", // Only show info and above

  // Global prefix
  prefix: "APP",

  // Output stream (default: process.stdout)
  stream: process.stderr,

  // Use borders for all logs (default: false)
  bordered: true,

  // Custom level configurations
  levelConfig: {
    success: {
      icon: "🎉",
      color: "greenBright",
      bold: true,
    },
    error: {
      icon: "💥",
      color: "redBright",
      borderColor: "red",
    },
  },
});
```

## Chainable API

All logging methods return `this` for chaining:

```tsx
logger
  .info("Starting")
  .blank()
  .group("Tasks")
  .success("Task 1 done")
  .success("Task 2 done")
  .groupEnd()
  .blank()
  .separator();
```

## Advanced Examples

### Server Startup Logs

```tsx
const serverLogger = createLogger({ prefix: "SERVER" });

serverLogger.group("🚀 Initialization");

const timer1 = serverLogger.time("Environment");
await loadEnv();
timer1.end();

const timer2 = serverLogger.time("Database");
await connectDB();
timer2.end();

serverLogger.groupEnd();

serverLogger.jsx(
  <box border="double" borderColor="green" padding={1}>
    <text bold color="green">
      ✓ Server ready at http://localhost:3000
    </text>
  </box>,
);
```

### Build Progress

```tsx
logger.group("Building Project", { borderColor: "cyan" });

for (const file of files) {
  logger.progress(++completed, total, file.name);
}

logger.groupEnd();
logger.success(`Built ${total} files in ${duration}ms`);
```

### Request Logging

```tsx
const reqLogger = logger.withTags("api", "prod").child("request");

reqLogger.info({
  method: "GET",
  path: "/api/users",
  ip: "192.168.1.1",
  duration: "45ms",
  status: 200,
});
```

### Error Handling with Context

```tsx
const errorLogger = logger.child("error");

try {
  await riskyOperation();
} catch (error) {
  errorLogger.error({
    message: error.message,
    stack: error.stack,
    context: { userId: 123, action: "update" },
  });
}
```

## Comparison with Console

| Feature   | console.log | SemaJSX Logger    |
| --------- | ----------- | ----------------- |
| Colors    | ❌ Manual   | ✅ Automatic      |
| Structure | ❌ None     | ✅ Flexbox layout |
| Tables    | ⚠️ Basic    | ✅ Styled tables  |
| Progress  | ❌ None     | ✅ Built-in bars  |
| Timing    | ⚠️ Manual   | ✅ Automatic      |
| Groups    | ⚠️ Basic    | ✅ Styled groups  |
| Tags      | ❌ None     | ✅ Built-in       |
| Filtering | ❌ None     | ✅ Level-based    |
| JSX       | ❌ None     | ✅ Full support   |

## TypeScript Support

Full TypeScript support with type definitions:

```tsx
import type { LoggerOptions, LogLevel } from "@semajsx/logger";

const options: LoggerOptions = {
  minLevel: "info",
  timestamp: true,
};

const level: LogLevel = "debug";
```

## Performance

- **Zero Virtual DOM** - Direct terminal rendering
- **Efficient Updates** - Only renders when called
- **Minimal Overhead** - Lightweight abstraction over terminal operations
- **No Signal Subscriptions** - One-time rendering (unlike `render()`)

## Tips

1. **Use appropriate levels** - Reserve `error` for actual errors
2. **Leverage groups** - Organize related operations
3. **Time everything** - Use `measure()` for async operations
4. **Tag for filtering** - Add tags for easier log searching
5. **Child loggers for modules** - Create module-specific loggers
6. **JSX for complex layouts** - Use JSX when console methods aren't enough
7. **Tables for data** - Display arrays of objects clearly
8. **Progress for long tasks** - Show users what's happening

## License

MIT
