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
    const [health, agents, harnesses] = await Promise.all([
      client.health(),
      client.listAgents(),
      client.listHarnesses(),
    ]);

    // ── Daemon ──
    console.log(
      `Daemon:      ${health.status} (PID ${health.pid}, up ${formatUptime(health.uptime)})`,
    );
    console.log(`  URL:       http://${info.host}:${info.port}`);
    console.log(`  Web UI:    http://${info.host}:${info.port}/`);
    console.log(`  Agents:    ${health.agents}`);
    console.log(`  Harnesses: ${health.harnesses}`);

    // ── Agents ──
    if (agents.length > 0) {
      console.log("\nAgents:");
      for (const a of agents) {
        const runtime = a.runtime ?? a.kind;
        const model = (a as any).model ? ` (${(a as any).model})` : "";
        const state = (a as any).state ?? "unknown";
        const ws = a.harness ? ` @ ${a.harness}` : "";
        console.log(`  ${a.name}  ${state}  ${runtime}${model}${ws}`);
      }
    }

    // ── Harnesses ──
    if (harnesses.length > 0) {
      console.log("\nHarnesses:");
      for (const w of harnesses) {
        const key = w.tag ? `${w.name}:${w.tag}` : w.name;
        const agentList = w.agents?.join(", ") ?? "";
        const mode = (w as any).mode ? `[${(w as any).mode}]` : "";
        const status = (w as any).status ?? "";
        console.log(`  @${key}  ${status} ${mode}  [${agentList}]`);
      }
    }
  } catch {
    // Daemon info exists but can't connect — likely stale
    console.log(`Daemon:      unreachable (http://${info.host}:${info.port})`);
    console.log(`  Last PID:  ${info.pid}`);
    console.log(`  Hint:      Run 'aw daemon stop' to clean up stale state`);
    process.exit(1);
  }
}
