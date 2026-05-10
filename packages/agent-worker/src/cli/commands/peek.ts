import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function peek(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw peek <target>");
    return;
  }
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw peek <target>");
    process.exit(1);
  }

  const target = parseTarget(raw);

  try {
    const client = await AwClient.discover();

    // Target routing per DESIGN.md:
    //   alice              → GET /agents/alice/responses?cursor=0
    //   alice@review       → GET /agents/alice/responses?cursor=0&harness=review
    //   @review            → GET /harnesss/review/channels/<default>?cursor=0
    //   @review#design     → GET /harnesss/review/channels/design?cursor=0
    //   alice@review#design → GET /harnesss/review/channels/design?cursor=0&agent=alice

    if (target.agent && !target.channel) {
      // Agent responses (optionally scoped to harness)
      const result = await client.readResponses(target.agent, {
        cursor: 0,
        harness: target.harness,
      });
      for (const entry of result.entries) {
        if ("text" in entry && typeof entry.text === "string") {
          console.log(entry.text);
        } else if ("content" in entry && typeof entry.content === "string") {
          console.log(`[${entry.type}] ${entry.content}`);
        }
      }
    } else if (target.harness && target.channel) {
      // Named channel (optionally filtered by agent)
      const result = await client.readChannel(target.harness, target.channel, {
        agent: target.agent,
      });
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    } else if (target.harness) {
      // Default channel — resolve default_channel from harness info
      const wsInfo = await client.getHarness(target.harness);
      const ch = wsInfo.default_channel ?? "general";
      const result = await client.readChannel(target.harness, ch);
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
