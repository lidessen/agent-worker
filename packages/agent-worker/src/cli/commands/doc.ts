import { ensureDaemon } from "../../client.ts";
import { wantsHelp } from "../output.ts";

export async function doc(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw doc <ls|read|write|append> [name] [@harness] [--content '...']");
    return;
  }
  const sub = args[0];

  if (!sub || !["ls", "read", "write", "append"].includes(sub)) {
    console.error("Usage: aw doc <ls|read|write|append> [name] [@harness] [--content '...']");
    process.exit(1);
  }

  const harness = extractHarness(args) ?? "global";

  try {
    const client = await ensureDaemon();

    switch (sub) {
      case "ls": {
        const docs = await client.listDocs(harness);
        if (docs.length === 0) {
          console.log("No documents");
        } else {
          for (const doc of docs) {
            console.log(doc.name);
          }
        }
        break;
      }
      case "read": {
        const name = args[1];
        if (!name || name.startsWith("@")) {
          console.error("Usage: aw doc read <name> [@harness]");
          process.exit(1);
        }
        const content = await client.readDoc(harness, name);
        console.log(content);
        break;
      }
      case "write": {
        const name = args[1];
        const content = getFlag(args, "--content");
        if (!name || name.startsWith("@") || !content) {
          console.error("Usage: aw doc write <name> [@harness] --content '...'");
          process.exit(1);
        }
        await client.writeDoc(harness, name, content);
        console.log(`Written: ${name}`);
        break;
      }
      case "append": {
        const name = args[1];
        const content = getFlag(args, "--content");
        if (!name || name.startsWith("@") || !content) {
          console.error("Usage: aw doc append <name> [@harness] --content '...'");
          process.exit(1);
        }
        await client.appendDoc(harness, name, content);
        console.log(`Appended to: ${name}`);
        break;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/** Extract @harness from args. */
function extractHarness(args: string[]): string | undefined {
  for (const arg of args) {
    if (arg.startsWith("@")) return arg.slice(1);
  }
  return undefined;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
