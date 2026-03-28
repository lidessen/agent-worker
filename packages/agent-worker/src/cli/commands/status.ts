import { AwClient } from "../../client.ts";
import { readDaemonInfo } from "../../discovery.ts";
import { formatUptime, wantsHelp } from "../output.ts";

export async function status(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw status");
    return;
  }

  const info = await readDaemonInfo();
  if (!info) {
    console.log("Daemon:      stopped");
    return;
  }
  const client = AwClient.fromInfo(info);

  try {
    const [health, agents, workspaces] = await Promise.all([
      client.health(),
      client.listAgents(),
      client.listWorkspaces(),
    ]);

    // ── Daemon ──
    console.log(
      `Daemon:      ${health.status} (PID ${health.pid}, up ${formatUptime(health.uptime)})`,
    );
    console.log(`  URL:       http://${info.host}:${info.port}`);
    console.log(`  Web UI:    http://${info.host}:${info.port}/`);
    console.log(`  Agents:    ${health.agents}`);
    console.log(`  Workspaces: ${health.workspaces}`);

    // ── Agents ──
    if (agents.length > 0) {
      console.log("\nAgents:");
      for (const a of agents) {
        const runtime = a.runtime ?? a.kind;
        const model = (a as any).model ? ` (${(a as any).model})` : "";
        const state = (a as any).state ?? "unknown";
        const ws = a.workspace ? ` @ ${a.workspace}` : "";
        console.log(`  ${a.name}  ${state}  ${runtime}${model}${ws}`);
      }
    }

    // ── Workspaces ──
    if (workspaces.length > 0) {
      console.log("\nWorkspaces:");
      for (const w of workspaces) {
        const key = w.tag ? `${w.name}:${w.tag}` : w.name;
        const agentList = w.agents?.join(", ") ?? "";
        const mode = (w as any).mode ? `[${(w as any).mode}]` : "";
        const status = (w as any).status ?? "";
        console.log(`  @${key}  ${status} ${mode}  [${agentList}]`);
      }
    }
  } catch (err) {
    // Daemon info exists but can't connect — likely stale
    console.log(`Daemon:      unreachable (http://${info.host}:${info.port})`);
    console.log(`  Last PID:  ${info.pid}`);
    console.log(`  Hint:      Run 'aw daemon stop' to clean up stale state`);
    process.exit(1);
  }
}
