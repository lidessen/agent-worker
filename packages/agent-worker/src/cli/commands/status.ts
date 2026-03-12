import { AwClient } from "../../client.ts";
import { formatUptime } from "../output.ts";

export async function status(_args: string[]): Promise<void> {
  try {
    const client = await AwClient.discover();
    const info = await client.health();
    console.log(`Status:     ${info.status}`);
    console.log(`PID:        ${info.pid}`);
    console.log(`Uptime:     ${formatUptime(info.uptime)}`);
    console.log(`Agents:     ${info.agents}`);
    console.log(`Workspaces: ${info.workspaces}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
