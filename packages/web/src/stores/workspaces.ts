import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { WorkspaceInfo } from "../api/types.ts";

export const workspaces = signal<WorkspaceInfo[]>([]);

export async function fetchWorkspaces() {
  const c = client.value;
  if (!c) return;
  try {
    workspaces.value = await c.listWorkspaces();
  } catch (err) {
    console.error("Failed to fetch workspaces:", err);
  }
}

// Auto-fetch when client connects
client.subscribe((c) => {
  if (c) fetchWorkspaces();
});
