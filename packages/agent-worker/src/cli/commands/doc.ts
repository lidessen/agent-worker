import { AwClient } from "../../client.ts";
import { wantsHelp } from "../output.ts";

export async function doc(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw doc <ls|read|write|append> [name] [@workspace] [--content '...']");
    return;
  }
  const sub = args[0];

  if (!sub || !["ls", "read", "write", "append"].includes(sub)) {
    console.error("Usage: aw doc <ls|read|write|append> [name] [@workspace] [--content '...']");
    process.exit(1);
  }

  const workspace = extractWorkspace(args) ?? "global";

  try {
    const client = await AwClient.discover();

    switch (sub) {
      case "ls": {
        const docs = await client.listDocs(workspace);
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
          console.error("Usage: aw doc read <name> [@workspace]");
          process.exit(1);
        }
        const content = await client.readDoc(workspace, name);
        console.log(content);
        break;
      }
      case "write": {
        const name = args[1];
        const content = getFlag(args, "--content");
        if (!name || name.startsWith("@") || !content) {
          console.error("Usage: aw doc write <name> [@workspace] --content '...'");
          process.exit(1);
        }
        await client.writeDoc(workspace, name, content);
        console.log(`Written: ${name}`);
        break;
      }
      case "append": {
        const name = args[1];
        const content = getFlag(args, "--content");
        if (!name || name.startsWith("@") || !content) {
          console.error("Usage: aw doc append <name> [@workspace] --content '...'");
          process.exit(1);
        }
        await client.appendDoc(workspace, name, content);
        console.log(`Appended to: ${name}`);
        break;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/** Extract @workspace from args. */
function extractWorkspace(args: string[]): string | undefined {
  for (const arg of args) {
    if (arg.startsWith("@")) return arg.slice(1);
  }
  return undefined;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
