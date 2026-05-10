/** @jsxImportSource @semajsx/dom */

import { createApp, type DocumentTemplate } from "@semajsx/ssr";
import { logger, createLogger } from "@semajsx/logger";
import { App } from "./App";

// Create a startup logger without timestamps and level indicators
const startupLogger = createLogger({
  timestamp: false,
  showLevel: false,
});

/**
 * SSR Islands Server with Vite
 * Uses the createApp API for simplified setup
 */

// Custom HTML document template (JSX!)
const Document: DocumentTemplate = ({ children, scripts, title }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {title && <title>{title}</title>}
      <style>{`
        body {
          font-family: system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f9fafb;
        }
      `}</style>
    </head>
    <body>
      {children}
      {scripts}
    </body>
  </html>
);

// Create app with the new API
const app = createApp({
  routes: {
    "/": () => <App />,
  },
  // Full Vite config exposure
  vite: {
    // Add any Vite plugins or config here
    // plugins: [],
    // resolve: { alias: {} },
  },
  document: Document,
  title: "SemaJSX SSR Islands (Vite)",
  root: import.meta.dir,
});

// Initialize the app
await app.prepare();

// Create HTTP server using handleRequest
const server = Bun.serve({
  port: 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);
    logger.info(`${req.method} ${url.pathname}`);

    // Use the unified handleRequest for all requests
    const response = await app.handleRequest(req);

    // Log island info for page requests
    if (response.headers.get("Content-Type")?.includes("text/html") && response.status === 200) {
      // Re-render to get island info (handleRequest already rendered)
      try {
        const result = await app.render(url.pathname);
        logger.success(`Rendered page with ${result.islands.length} islands`);
        for (const island of result.islands) {
          logger.debug(`  - ${island.id}: ${island.componentName || "anonymous"} (${island.path})`);
        }
      } catch {
        // Ignore - already handled
      }
    }

    return response;
  },
});

// Display startup info (without timestamps)
startupLogger.blank();
startupLogger.success("🏝️  SemaJSX SSR Islands Server (createApp API)");
startupLogger.blank();
startupLogger.info(`Server running at: http://localhost:${server.port}`);
startupLogger.blank();
startupLogger
  .group("Features", { borderColor: "green" })
  .info("✓ createApp API for simplified setup")
  .info("✓ Full Vite config exposure")
  .info("✓ Unified handleRequest for all routes")
  .info("✓ Built-in build() for production")
  .info("✓ Optional dev() for quick start")
  .groupEnd();
startupLogger.blank();
startupLogger
  .group("API Example", { borderColor: "cyan" })
  .info("const app = createApp({ routes, vite, document })")
  .info("await app.prepare()  // Initialize")
  .info("await app.render('/')  // SSR render")
  .info("await app.build({ outDir: 'dist' })  // Production build")
  .groupEnd();
startupLogger.blank();

// Cleanup on exit
let isShuttingDown = false;
process.on("SIGINT", async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.blank();
  logger.warn("Shutting down...");
  await app.close();
  server.stop();
  process.exit(0);
});
