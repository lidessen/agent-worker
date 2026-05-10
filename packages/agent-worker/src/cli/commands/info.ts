import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function info(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw info <target>");
    return;
  }
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw info <target>");
    process.exit(1);
  }

  const target = parseTarget(raw);

  try {
    const client = await AwClient.discover();

    if (target.agent && target.harness) {
      // Compound: show both agent + harness status
      const [agent, ws] = await Promise.all([
        client.getAgent(target.agent),
        client.getHarnessStatus(target.harness),
      ]);
      console.log("Agent:", JSON.stringify(agent, null, 2));
      console.log("Harness:", JSON.stringify(ws, null, 2));
    } else if (target.harness) {
      const ws = await client.getHarnessStatus(target.harness);
      console.log(JSON.stringify(ws, null, 2));
    } else if (target.agent) {
      const agent = await client.getAgent(target.agent);
      console.log(JSON.stringify(agent, null, 2));
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
