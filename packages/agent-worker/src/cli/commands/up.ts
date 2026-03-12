import { startDaemon } from "../../daemon.ts";

export async function up(args: string[]): Promise<void> {
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
