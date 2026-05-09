/** @jsxImportSource @semajsx/terminal */

/**
 * Basic Logger Example
 */

import { logger } from "@semajsx/logger";

// Simple logging
logger.info("Application started");
logger.success("Configuration loaded");
logger.warn("Using default database settings");

logger.blank();

// Structured data
logger.info({
  environment: "production",
  version: "1.0.0",
  port: 3000,
});

logger.blank();

// Groups
logger.group("Startup Tasks");
logger.info("Loading plugins...");
logger.success("3 plugins loaded");
logger.info("Connecting to services...");
logger.success("All services connected");
logger.groupEnd();

logger.blank();

// Table
logger.table([
  { service: "Database", status: "Connected", latency: "5ms" },
  { service: "Cache", status: "Connected", latency: "2ms" },
  { service: "Queue", status: "Connected", latency: "8ms" },
]);

logger.blank();

// Progress
logger.progress(100, 100, "Ready", { color: "green" });

logger.blank();

logger.jsx(
  <box border="round" borderColor="green" paddingInline={1}>
    <text bold color="green">
      ✓ Server running at http://localhost:3000
    </text>
  </box>,
);
