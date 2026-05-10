import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function state(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw state <target>");
    return;
  }
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw state <target>");
    process.exit(1);
  }

  const target = parseTarget(raw);

  if (!target.agent && !target.harness) {
    console.error("state requires an agent or harness+agent target");
    process.exit(1);
  }

  try {
    const client = await AwClient.discover();

    // Harness inbox peek: aw state alice@review
    if (target.agent && target.harness) {
      const wsKey = target.harness;
      const entries = await client.peekInbox(wsKey, target.agent);
      console.log(`Inbox for ${target.agent} in @${wsKey} (${entries.length}):`);
      for (const e of entries) {
        console.log(`  [${e.channel ?? "?"}] ${e.content?.slice(0, 80) ?? JSON.stringify(e)}`);
      }
      return;
    }

    // Agent state
    if (target.agent) {
      const result = await client.getAgentState(target.agent);
      console.log(`State: ${result.state}`);
      if (result.currentTask) console.log(`Task: ${result.currentTask}`);
      if (result.history != null) console.log(`History: ${result.history} turns`);

      if (result.inbox?.length > 0) {
        console.log(`\nInbox (${result.inbox.length}):`);
        for (const msg of result.inbox) {
          const label = msg.status ?? msg.priority ?? "?";
          const from = msg.from ?? "?";
          const content = msg.content?.slice(0, 80) ?? "";
          console.log(`  [${label}] ${from}: ${content}`);
        }
      }

      if (result.todos?.length > 0) {
        console.log(`\nTodos (${result.todos.length}):`);
        for (const t of result.todos) {
          const mark = t.status === "done" ? "✓" : " ";
          console.log(`  [${mark}] ${t.text}`);
        }
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
