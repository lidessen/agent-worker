import { ensureDaemon } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function rm(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw rm <target>");
    return;
  }
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw rm <target>");
    process.exit(1);
  }

  const target = parseTarget(raw);

  try {
    const client = await ensureDaemon();

    if (target.harness) {
      await client.stopHarness(target.harness);
      console.log(`Removed harness @${target.harness}`);
    } else if (target.agent) {
      await client.removeAgent(target.agent);
      console.log(`Removed agent ${target.agent}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
