import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";

export async function send(args: string[]): Promise<void> {
  const raw = args[0];
  if (!raw || args.length < 2) {
    console.error('Usage: aw send <target> "message" [+Ns "message2" ...] [--from <name>]');
    process.exit(1);
  }

  const target = parseTarget(raw);
  const from = getFlag(args, "--from");

  // Parse messages: "msg1" +2s "msg2" +1s "msg3"
  const messages: Array<{ content: string; delayMs?: number }> = [];
  let pendingDelay = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--from") { i++; continue; }
    const delayMatch = args[i]!.match(/^\+(\d+)(ms|s)$/);
    if (delayMatch) {
      const n = parseInt(delayMatch[1]!, 10);
      pendingDelay = delayMatch[2] === "s" ? n * 1000 : n;
      continue;
    }
    messages.push({ content: args[i]!, delayMs: pendingDelay || undefined });
    pendingDelay = 0;
  }

  if (messages.length === 0) {
    console.error("No messages to send");
    process.exit(1);
  }

  try {
    const client = await AwClient.discover();

    if (target.workspace) {
      // Workspace send
      for (const msg of messages) {
        if (msg.delayMs) await new Promise((r) => setTimeout(r, msg.delayMs));
        await client.sendToWorkspace(target.workspace!, {
          content: msg.content,
          from,
          agent: target.agent,
          channel: target.channel,
        });
      }
      console.log(`Sent ${messages.length} message(s) to @${target.workspace}`);
    } else if (target.agent) {
      // Agent send
      const result = await client.sendToAgent(
        target.agent,
        messages.map((m) => ({ content: m.content, from, delayMs: m.delayMs })),
      );
      console.log(`Sent ${result.sent} message(s) to ${target.agent}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
