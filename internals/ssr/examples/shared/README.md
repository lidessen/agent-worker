# Shared Utilities

Shared utilities for SemaJSX examples.

## Server Utilities

### `startServer(app, config)`

A helper function to start a Bun server with beautiful terminal output.

**Usage:**

```typescript
import { startServer } from "../shared/server.tsx";
import app from "./index.html";

startServer(app, {
  title: "✓ Server started successfully!",
  borderColor: "green",
  features: ["✓ Feature 1 enabled", "✓ Feature 2 enabled"],
});
```

**Config Options:**

- `title` (string, required): Title to display in the banner
- `borderColor` (string, optional): Border color for the title banner. Default: `"green"`
- `features` (string[], optional): List of features/info to display

The server will automatically display:

- Server URL
- Hostname
- Port
- Optional features list
- Exit instructions
