import { AwClient } from "../../client.ts";
import { formatUptime } from "../output.ts";

export async function status(_args: string[]): Promise<void> {
  try {
    const client = await AwClient.discover();
    const [health, agents, workspaces] = await Promise.all([
      client.health(),
      client.listAgents(),
      client.listWorkspaces(),
    ]);

    console.log(
      `Daemon:      ${health.status} (PID ${health.pid}, up ${formatUptime(health.uptime)})`,
    );
    console.log(`Agents:      ${health.agents}`);
    console.log(`Workspaces:  ${health.workspaces}`);

    if (agents.length > 0) {
      console.log("\nAgents:");
      for (const a of agents) {
        console.log(`  ${a.name}  (${a.runtime ?? a.kind})`);
      }
    }

    if (workspaces.length > 0) {
      console.log("\nWorkspaces:");
      for (const w of workspaces) {
        const key = w.tag ? `${w.name}:${w.tag}` : w.name;
        const agents = w.agents?.join(", ") ?? "";
        console.log(`  @${key}  [${agents}]`);
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
