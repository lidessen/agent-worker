import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";

export async function peek(args: string[]): Promise<void> {
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
    //   alice@review       → GET /agents/alice/responses?cursor=0&workspace=review
    //   @review            → GET /workspaces/review/channels/<default>?cursor=0
    //   @review#design     → GET /workspaces/review/channels/design?cursor=0
    //   alice@review#design → GET /workspaces/review/channels/design?cursor=0&agent=alice

    if (target.agent && !target.channel) {
      // Agent responses (optionally scoped to workspace)
      const result = await client.readResponses(target.agent, {
        cursor: 0,
        workspace: target.workspace,
      });
      for (const entry of result.entries) {
        if ((entry as any).text) {
          console.log((entry as any).text);
        } else if ((entry as any).content) {
          console.log(`[${(entry as any).type}] ${(entry as any).content}`);
        }
      }
    } else if (target.workspace && target.channel) {
      // Named channel (optionally filtered by agent)
      const result = await client.readChannel(target.workspace, target.channel, {
        agent: target.agent,
      });
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    } else if (target.workspace) {
      // Default channel — resolve default_channel from workspace info
      const wsInfo = await client.getWorkspace(target.workspace);
      const ch = wsInfo.default_channel ?? "general";
      const result = await client.readChannel(target.workspace, ch);
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
