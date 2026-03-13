import { startDaemon } from "../../daemon.ts";
import { AwClient } from "../../client.ts";

export async function daemon(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case "start":
      return daemonStart(rest);
    case "stop":
      return daemonStop(rest);
    default:
      console.log(`Usage: aw daemon <command>

  start [-p PORT]    Start daemon (foreground)
  stop               Stop daemon
`);
      if (sub) {
        console.error(`Unknown daemon command: ${sub}`);
        process.exit(1);
      }
  }
}

async function daemonStart(args: string[]): Promise<void> {
  const portIdx = args.indexOf("-p");
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1]!, 10) : 0;

  console.log("Starting agent-worker daemon...");
  const { daemon, info } = await startDaemon({ port });
  console.log(`Daemon running on http://${info.host}:${info.port}`);
  console.log(`PID: ${info.pid}`);
  console.log(`Token: ${info.token}`);
  console.log("Running in foreground (use Ctrl+C to stop)");

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await daemon.shutdown();
    process.exit(0);
  });
}

async function daemonStop(_args: string[]): Promise<void> {
  try {
    const client = await AwClient.discover();
    await client.shutdown();
    console.log("Daemon stopped");
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
