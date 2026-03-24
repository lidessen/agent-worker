import { startDaemon } from "../../daemon.ts";
import { AwClient, ensureDaemon } from "../../client.ts";
import { readDaemonInfo, removeDaemonInfo } from "../../discovery.ts";

export async function daemon(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case "start":
      return daemonStart(rest);
    case "stop":
      return daemonStop(rest);
    case "--help":
    case "-h":
    default:
      console.log(`Usage: aw daemon <command>

Commands:
  start [-p PORT] [--host HOST] [--data-dir DIR] [--mcp-port PORT]    Start daemon
  start -d [options]                                                  Start in background
  stop                                                                Stop daemon
`);
      if (sub && sub !== "--help" && sub !== "-h") {
        console.error(`Unknown daemon command: ${sub}`);
        process.exit(1);
      }
  }
}

async function daemonStart(args: string[]): Promise<void> {
  // Background mode: spawn detached and exit
  if (args.includes("-d") || args.includes("--daemon")) {
    // Parse args before spawning so we can pass them through
    const portIdx = args.indexOf("-p");
    const port = portIdx >= 0 ? args[portIdx + 1] : undefined;
    const hostIdx = args.indexOf("--host");
    const host = hostIdx >= 0 ? args[hostIdx + 1] : undefined;
    const dataDirIdx = args.indexOf("--data-dir");
    const dataDir = dataDirIdx >= 0 ? args[dataDirIdx + 1] : undefined;
    const mcpPortIdx = args.indexOf("--mcp-port");
    const mcpPort = mcpPortIdx >= 0 ? args[mcpPortIdx + 1] : undefined;

    if (!dataDir) {
      await stopExistingDaemon();
    }
    const client = await ensureDaemon(dataDir, {
      extraArgs: [
        ...(port ? ["-p", port] : []),
        ...(host ? ["--host", host] : []),
        ...(mcpPort ? ["--mcp-port", mcpPort] : []),
        ...(args.includes("--trust-tailscale") ? ["--trust-tailscale"] : []),
      ],
    });
    const health = await client.health();
    const info = await readDaemonInfo(dataDir);
    console.log(`Daemon running in background`);
    console.log(`  PID:     ${health.pid}`);
    console.log(`  URL:     http://${info?.host ?? "127.0.0.1"}:${info?.port ?? "?"}`);
    console.log(`  Token:   ${info?.token ?? "?"}`);
    console.log(`  Web UI:  http://${info?.host ?? "127.0.0.1"}:${info?.port ?? "?"}/`);
    return;
  }

  const portIdx = args.indexOf("-p");
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1]!, 10) : undefined;
  const hostIdx = args.indexOf("--host");
  const host = hostIdx >= 0 ? args[hostIdx + 1] : undefined;
  const dataDirIdx = args.indexOf("--data-dir");
  const dataDir = dataDirIdx >= 0 ? args[dataDirIdx + 1] : undefined;
  const mcpPortIdx = args.indexOf("--mcp-port");
  const mcpPort = mcpPortIdx >= 0 ? parseInt(args[mcpPortIdx + 1]!, 10) : undefined;
  const trustTailscale = args.includes("--trust-tailscale");

  // Stop any existing daemon before starting (only for default data-dir)
  if (!dataDir) {
    await stopExistingDaemon();
  }

  // Load saved secrets into process.env so runtimes can resolve API keys
  const { loadSecrets } = await import("@agent-worker/workspace");
  const secrets = await loadSecrets();
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  console.log("Starting agent-worker daemon...");
  const { daemon, info } = await startDaemon({ port, host, dataDir, mcpPort, trustTailscale });
  console.log();
  console.log(`  PID:     ${info.pid}`);
  console.log(`  URL:     http://${info.host}:${info.port}`);
  if (info.listenHost && info.listenHost !== info.host) {
    console.log(`  Listen:  http://${info.listenHost}:${info.port}`);
  }
  console.log(`  Token:   ${info.token}`);
  console.log(`  Web UI:  http://${info.host}:${info.port}/`);
  console.log();
  console.log("Running in foreground (Ctrl+C to stop)");

  let shuttingDown = false;
  const gracefulShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down...");
    await daemon.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
}

async function daemonStop(_args: string[]): Promise<void> {
  // Try graceful HTTP shutdown first, then fall back to PID kill
  const info = await readDaemonInfo();
  if (!info) {
    console.log("No daemon running");
    return;
  }

  try {
    const client = AwClient.fromInfo(info);
    await client.shutdown();
    console.log("Daemon stopped");
  } catch {
    // HTTP shutdown failed — try killing by PID
    if (info.pid) {
      try {
        process.kill(info.pid, "SIGTERM");
        console.log(`Daemon stopped (killed PID ${info.pid})`);
      } catch {
        // Process doesn't exist — stale daemon.json
        console.log("Daemon not running (stale state cleaned up)");
      }
    }
    await removeDaemonInfo();
  }
}

/**
 * Stop any existing daemon before starting a new one.
 * Handles stale daemon.json from crashed processes.
 */
async function stopExistingDaemon(): Promise<void> {
  const info = await readDaemonInfo();
  if (!info) return;

  // Check if the old daemon is still alive
  try {
    const res = await fetch(`http://${info.host}:${info.port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      // Old daemon is running — shut it down
      try {
        const client = AwClient.fromInfo(info);
        await client.shutdown();
      } catch {
        // HTTP shutdown failed — kill by PID
        try {
          process.kill(info.pid, "SIGTERM");
        } catch {
          /* already dead */
        }
      }
      // Wait briefly for cleanup
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {
    // Not responding — might be stale. Try killing by PID just in case.
    try {
      process.kill(info.pid, "SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      /* already dead */
    }
  }

  await removeDaemonInfo();
}
