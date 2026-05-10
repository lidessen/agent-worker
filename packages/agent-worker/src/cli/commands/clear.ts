import { ensureDaemon } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function clear(args: string[]): Promise<void> {
  if (wantsHelp(args) || args.length === 0) {
    console.log(
      "Usage: aw clear <target>\n\nClear channel history.\n\nExamples:\n  aw clear @global          Clear default channel\n  aw clear @global#design   Clear #design channel",
    );
    return;
  }

  const target = parseTarget(args[0]!);
  if (!target.harness) {
    console.error("Target must include a harness (e.g., @global, @global#general)");
    process.exit(1);
  }

  const client = await ensureDaemon();
  const channel = target.channel ?? "general";

  await client.clearChannel(target.harness, channel);
  console.log(`Cleared #${channel} in @${target.harness}`);
}
