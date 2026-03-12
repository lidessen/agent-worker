import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";

export async function state(args: string[]): Promise<void> {
  const raw = args[0];
  if (!raw) {
    console.error("Usage: aw state <target>");
    process.exit(1);
  }

  const target = parseTarget(raw);
  if (!target.agent) {
    console.error("state requires an agent target");
    process.exit(1);
  }

  try {
    const client = await AwClient.discover();
    const result = await client.getAgentState(target.agent);
    console.log(`State: ${result.state}`);
    console.log(`History: ${result.history} turns`);

    if (result.inbox.length > 0) {
      console.log(`\nInbox (${result.inbox.length}):`);
      for (const msg of result.inbox) {
        console.log(`  [${msg.status}] ${msg.from ?? "?"}: ${msg.content.slice(0, 80)}`);
      }
    }

    if (result.todos.length > 0) {
      console.log(`\nTodos (${result.todos.length}):`);
      for (const t of result.todos) {
        const mark = t.status === "done" ? "✓" : " ";
        console.log(`  [${mark}] ${t.text}`);
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
