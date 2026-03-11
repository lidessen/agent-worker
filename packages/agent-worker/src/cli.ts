#!/usr/bin/env bun
/**
 * aw — agent-worker CLI entry point.
 *
 * Commands:
 *   aw up [-p PORT]          Start daemon (foreground)
 *   aw down                  Stop daemon
 *   aw status                Daemon status
 *   aw ls                    List agents
 */
import { readDaemonInfo } from "./discovery.ts";
import { startDaemon } from "./daemon.ts";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "up": {
      const portIdx = args.indexOf("-p");
      const port = portIdx >= 0 ? parseInt(args[portIdx + 1]!, 10) : 0;

      console.log("Starting agent-worker daemon...");
      const { daemon, info } = await startDaemon({ port });
      console.log(`Daemon running on http://${info.host}:${info.port}`);
      console.log(`PID: ${info.pid}`);
      console.log(`Token: ${info.token}`);
      console.log("Running in foreground (use Ctrl+C to stop)");

      // Graceful shutdown on SIGINT
      process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        await daemon.shutdown();
        process.exit(0);
      });
      break;
    }

    case "down": {
      const info = await readDaemonInfo();
      if (!info) {
        console.log("No daemon running");
        process.exit(1);
      }
      try {
        const res = await fetch(`http://${info.host}:${info.port}/shutdown`, {
          method: "POST",
          headers: { Authorization: `Bearer ${info.token}` },
        });
        if (res.ok) {
          console.log("Daemon stopped");
        } else {
          console.error("Failed to stop daemon:", await res.text());
        }
      } catch {
        console.error("Could not reach daemon (may already be stopped)");
      }
      break;
    }

    case "status": {
      const info = await readDaemonInfo();
      if (!info) {
        console.log("No daemon running");
        process.exit(1);
      }
      try {
        const res = await fetch(`http://${info.host}:${info.port}/health`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.error("Could not reach daemon");
        process.exit(1);
      }
      break;
    }

    case "ls": {
      const info = await readDaemonInfo();
      if (!info) {
        console.log("No daemon running");
        process.exit(1);
      }
      try {
        const res = await fetch(`http://${info.host}:${info.port}/agents`, {
          headers: { Authorization: `Bearer ${info.token}` },
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.error("Could not reach daemon");
        process.exit(1);
      }
      break;
    }

    default:
      console.log(`Usage: aw <command>

Commands:
  up [-p PORT]        Start daemon (foreground)
  down                Stop daemon
  status              Daemon status
  ls                  List agents
`);
      if (command) {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
