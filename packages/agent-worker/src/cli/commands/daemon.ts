import { startDaemon } from "../../daemon.ts";
import { AwClient } from "../../client.ts";
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
  start [-p PORT]    Start daemon (foreground)
  stop               Stop daemon
`);
      if (sub && sub !== "--help" && sub !== "-h") {
        console.error(`Unknown daemon command: ${sub}`);
        process.exit(1);
      }
  }
}

async function daemonStart(args: string[]): Promise<void> {
  const portIdx = args.indexOf("-p");
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1]!, 10) : 0;

  // Stop any existing daemon before starting
  await stopExistingDaemon();

  // Load saved secrets into process.env so runtimes can resolve API keys
  const { loadSecrets } = await import("@agent-worker/workspace");
  const secrets = await loadSecrets();
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  console.log("Starting agent-worker daemon...");
  const { daemon, info } = await startDaemon({ port });
  console.log(`Daemon running on http://${info.host}:${info.port}`);
  console.log(`PID: ${info.pid}`);
  console.log(`Token: ${info.token}`);
  console.log("Running in foreground (use Ctrl+C to stop)");

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
