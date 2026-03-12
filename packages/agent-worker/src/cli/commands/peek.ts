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

    if (target.workspace && target.channel) {
      // Read channel from start
      const result = await client.readChannel(target.workspace, target.channel, {
        agent: target.agent,
      });
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    } else if (target.workspace) {
      // Read default channel
      const result = await client.readChannel(target.workspace, "general");
      for (const msg of result.messages) {
        console.log(`[${msg.from}] ${msg.content}`);
      }
    } else if (target.agent) {
      // Read agent responses from start (optionally scoped to workspace)
      const result = await client.readResponses(target.agent, { cursor: 0, workspace: target.workspace });
      for (const entry of result.entries) {
        if ((entry as any).text) {
          console.log((entry as any).text);
        } else if ((entry as any).content) {
          console.log(`[${(entry as any).type}] ${(entry as any).content}`);
        }
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
