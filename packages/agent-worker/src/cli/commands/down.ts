import { AwClient } from "../../client.ts";

export async function down(_args: string[]): Promise<void> {
  try {
    const client = await AwClient.discover();
    await client.shutdown();
    console.log("Daemon stopped");
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Could not reach daemon");
    process.exit(1);
  }
}
