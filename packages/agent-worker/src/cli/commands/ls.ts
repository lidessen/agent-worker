import { AwClient } from "../../client.ts";
import { table, wantsHelp } from "../output.ts";

export async function ls(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw ls");
    return;
  }
  try {
    const client = await AwClient.discover();
    const [agents, harnesses] = await Promise.all([client.listAgents(), client.listHarnesses()]);

    if (agents.length > 0) {
      console.log("Agents:");
      console.log(
        table(
          ["Name", "State", "Kind", "Harness"],
          agents.map((a) => [a.name, a.state, a.kind, a.harness ?? "(global)"]),
        ),
      );
    } else {
      console.log("No agents");
    }

    if (harnesses.length > 0) {
      console.log("\nHarnesses:");
      console.log(
        table(
          ["Name", "Tag", "Agents", "Channels"],
          harnesses.map((w) => [w.name, w.tag ?? "—", w.agents.join(", "), w.channels.join(", ")]),
        ),
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
