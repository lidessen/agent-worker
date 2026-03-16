import { AwClient } from "../../client.ts";
import { table, wantsHelp } from "../output.ts";

export async function ls(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw ls");
    return;
  }
  try {
    const client = await AwClient.discover();
    const [agents, workspaces] = await Promise.all([client.listAgents(), client.listWorkspaces()]);

    if (agents.length > 0) {
      console.log("Agents:");
      console.log(
        table(
          ["Name", "State", "Kind", "Workspace"],
          agents.map((a) => [a.name, a.state, a.kind, a.workspace ?? "(global)"]),
        ),
      );
    } else {
      console.log("No agents");
    }

    if (workspaces.length > 0) {
      console.log("\nWorkspaces:");
      console.log(
        table(
          ["Name", "Tag", "Agents", "Channels"],
          workspaces.map((w) => [w.name, w.tag ?? "—", w.agents.join(", "), w.channels.join(", ")]),
        ),
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
