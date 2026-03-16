import { AwClient } from "../../client.ts";
import { parseTarget } from "../target.ts";
import { wantsHelp } from "../output.ts";

export async function log(args: string[]): Promise<void> {
  if (wantsHelp(args)) {
    console.log("Usage: aw log [<target>] [-f|--follow] [--json]");
    return;
  }

  const follow = args.includes("-f") || args.includes("--follow");
  const json = args.includes("--json");
  const targetRaw = args.find((a) => !a.startsWith("-"));

  try {
    const client = await AwClient.discover();

    if (follow) {
      // SSE stream mode
      let stream: AsyncIterable<any>;
      if (targetRaw) {
        const target = parseTarget(targetRaw);
        if (target.workspace) {
          stream = await client.streamWorkspaceEvents(target.workspace);
        } else if (target.agent) {
          stream = await client.streamAgentEvents(target.agent);
        } else {
          stream = await client.streamEvents();
        }
      } else {
        stream = await client.streamEvents();
      }

      for await (const event of stream) {
        printEvent(event, json);
      }
    } else {
      // Cursor-based read
      let result;
      if (targetRaw) {
        const target = parseTarget(targetRaw);
        if (target.workspace) {
          result = await client.readWorkspaceEvents(target.workspace, 0);
        } else if (target.agent) {
          result = await client.readAgentEvents(target.agent, 0);
        } else {
          result = await client.readEvents(0);
        }
      } else {
        result = await client.readEvents(0);
      }

      for (const entry of result.entries) {
        printEvent(entry, json);
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function printEvent(event: any, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(event));
  } else {
    const ts = event.ts ? new Date(event.ts).toISOString().slice(11, 19) : "";
    const type = event.type ?? "unknown";
    const rest = Object.entries(event)
      .filter(([k]) => k !== "ts" && k !== "type" && k !== "source")
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    console.log(`${ts} ${type} ${rest}`.trim());
  }
}
