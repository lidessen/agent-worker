/** @jsxImportSource @semajsx/terminal */

/**
 * Logger Showcase - Demonstrates all logger features
 */

import { logger, createLogger } from "@semajsx/logger";

async function main() {
  console.clear();

  logger.jsx(
    <box border="double" borderColor="cyan" padding={2} justifyContent="center">
      <text bold color="cyan" fontSize={20}>
        🎨 SemaJSX Terminal Logger Showcase
      </text>
    </box>,
  );

  logger.blank();

  // ===== Basic Logging =====
  logger.separator("=", "cyan");
  logger.info("Basic Logging Levels");
  logger.separator("=", "cyan");
  logger.blank();

  logger.debug("This is a debug message");
  logger.info("This is an info message");
  logger.success("This is a success message");
  logger.warn("This is a warning message");
  logger.error("This is an error message");

  logger.blank();

  // ===== Structured Data =====
  logger.separator("=", "magenta");
  logger.info("Structured Data Logging");
  logger.separator("=", "magenta");
  logger.blank();

  logger.info({ user: "alice", action: "login", timestamp: Date.now() });
  logger.info({ endpoint: "/api/users", method: "GET", status: 200 }, { requestId: "abc123" });

  logger.blank();

  // ===== JSX Content =====
  logger.separator("=", "green");
  logger.info("Custom JSX Content");
  logger.separator("=", "green");
  logger.blank();

  logger.jsx(
    <box flexDirection="row" alignItems="center">
      <text color="green" bold>
        ✓
      </text>
      <text marginLeft={1}>Deployment</text>
      <text marginLeft={1} color="cyan" bold>
        v2.5.0
      </text>
      <text marginLeft={1}>successful to</text>
      <text marginLeft={1} color="yellow" bold>
        production
      </text>
    </box>,
  );

  logger.blank();

  // ===== Groups =====
  logger.separator("=", "yellow");
  logger.info("Log Groups");
  logger.separator("=", "yellow");
  logger.blank();

  logger.group("Database Migration", { borderColor: "blue" });
  logger.info("Connecting to database...");
  logger.success("Connected");
  logger.info("Running migrations...");
  logger.success("Migration 001_create_users completed");
  logger.success("Migration 002_add_roles completed");
  logger.groupEnd();

  logger.blank();

  logger.group("API Tests", { borderColor: "green" });
  logger.info("Testing authentication...");
  logger.success("POST /auth/login - 200 OK");
  logger.success("POST /auth/logout - 200 OK");
  logger.info("Testing user endpoints...");
  logger.success("GET /users - 200 OK");
  logger.warn("PUT /users/999 - 404 Not Found (expected)");
  logger.groupEnd();

  logger.blank();

  // ===== Tables =====
  logger.separator("=", "blue");
  logger.info("Data Tables");
  logger.separator("=", "blue");
  logger.blank();

  const users = [
    { name: "Alice Johnson", role: "Admin", status: "Active" },
    { name: "Bob Smith", role: "User", status: "Active" },
    { name: "Carol White", role: "Moderator", status: "Inactive" },
  ];

  logger.table(users, {
    border: "round",
    borderColor: "cyan",
  });

  logger.blank();

  // ===== Progress Bars =====
  logger.separator("=", "green");
  logger.info("Progress Bars");
  logger.separator("=", "green");
  logger.blank();

  logger.progress(25, 100, "Downloading", { color: "yellow" });
  logger.progress(50, 100, "Processing", { color: "cyan" });
  logger.progress(75, 100, "Uploading", { color: "blue" });
  logger.progress(100, 100, "Complete", { color: "green" });

  logger.blank();

  // ===== Animated Progress =====
  logger.info("Simulating build process...");
  logger.blank();

  for (let i = 0; i <= 100; i += 10) {
    logger.progress(i, 100, "Building", {
      color: i === 100 ? "green" : "cyan",
      width: 50,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  logger.blank();

  // ===== Timers =====
  logger.separator("=", "magenta");
  logger.info("Performance Timing");
  logger.separator("=", "magenta");
  logger.blank();

  const timer1 = logger.time("Database Query");
  await new Promise((resolve) => setTimeout(resolve, 150));
  timer1.end("Fetched 1,234 records");

  const timer2 = logger.time("Image Processing");
  await new Promise((resolve) => setTimeout(resolve, 300));
  timer2.end("Processed 5 images");

  // Measure function
  const _result = await logger.measure("API Call", async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { data: "response" };
  });

  logger.blank();

  // ===== Tags =====
  logger.separator("=", "blue");
  logger.info("Tagged Logging");
  logger.separator("=", "blue");
  logger.blank();

  const dbLogger = logger.withTags("database", "prod");
  dbLogger.info("Connection pool initialized");
  dbLogger.success("Query cache enabled");

  const apiLogger = logger.withTags("api", "v2");
  apiLogger.info("Endpoint registered: /api/v2/users");
  apiLogger.warn("Rate limiting active");

  logger.blank();

  // ===== Child Loggers =====
  logger.separator("=", "cyan");
  logger.info("Child Loggers (Prefixes)");
  logger.separator("=", "cyan");
  logger.blank();

  const authLogger = logger.child("auth");
  authLogger.info("JWT token generated");
  authLogger.info("Session created");

  const paymentLogger = logger.child("payment");
  paymentLogger.info("Payment gateway connected");
  paymentLogger.success("Transaction processed: $99.99");

  logger.blank();

  // ===== Custom Configuration =====
  logger.separator("=", "yellow");
  logger.info("Custom Logger Configuration");
  logger.separator("=", "yellow");
  logger.blank();

  const customLogger = createLogger({
    prefix: "CUSTOM",
    bordered: true,
    minLevel: "info",
    levelConfig: {
      success: {
        icon: "🎉",
        color: "greenBright",
      },
      error: {
        icon: "💥",
        color: "redBright",
      },
    },
  });

  customLogger.info("Custom styled logger");
  customLogger.success("Custom success icon!");
  customLogger.error("Custom error styling");

  logger.blank();

  // ===== Real-world Example =====
  logger.separator("=", "green");
  logger.success("Real-World Server Startup Example");
  logger.separator("=", "green");
  logger.blank();

  const serverLogger = createLogger({ prefix: "SERVER" });

  serverLogger.group("🚀 Server Initialization", { borderColor: "cyan" });

  const envTimer = serverLogger.time("Environment");
  await new Promise((resolve) => setTimeout(resolve, 50));
  envTimer.end();
  serverLogger.success("Environment variables loaded");

  const dbTimer = serverLogger.time("Database");
  await new Promise((resolve) => setTimeout(resolve, 100));
  dbTimer.end();
  serverLogger.success("Database connected");

  const cacheTimer = serverLogger.time("Cache");
  await new Promise((resolve) => setTimeout(resolve, 75));
  cacheTimer.end();
  serverLogger.success("Redis cache connected");

  serverLogger.groupEnd();

  logger.blank();

  serverLogger.jsx(
    <box border="double" borderColor="green" padding={1} justifyContent="center">
      <text bold color="green">
        ✓ Server ready at http://localhost:3000
      </text>
    </box>,
  );

  logger.blank();

  // ===== Stats =====
  logger.separator("=", "cyan");
  logger.blank();

  const stats = [
    { metric: "Total Requests", value: "1,234", change: "+12%" },
    { metric: "Active Users", value: "567", change: "+8%" },
    { metric: "Error Rate", value: "0.02%", change: "-15%" },
    { metric: "Avg Response", value: "45ms", change: "-5%" },
  ];

  logger.table(stats, {
    border: "double",
    borderColor: "magenta",
  });

  logger.blank();

  logger.jsx(
    <box border="round" borderColor="cyan" padding={1} justifyContent="center">
      <text dim>End of showcase - Press Ctrl+C to exit</text>
    </box>,
  );
}

main().catch(console.error);
