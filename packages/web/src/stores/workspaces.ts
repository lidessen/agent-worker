import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { WorkspaceInfo } from "../api/types.ts";

export const workspaces = signal<WorkspaceInfo[]>([]);
export const workspacesLoading = signal(false);

export async function fetchWorkspaces() {
  const c = client.value;
  if (!c) return;
  workspacesLoading.value = true;
  try {
    workspaces.value = await c.listWorkspaces();
  } catch (err) {
    console.error("Failed to fetch workspaces:", err);
  } finally {
    workspacesLoading.value = false;
  }
}

export async function deleteWorkspace(key: string) {
  const c = client.value;
  if (!c) throw new Error("Not connected");
  await c.deleteWorkspace(key);
  await fetchWorkspaces();
}

// Auto-fetch when client connects
client.subscribe((c) => {
  if (c) fetchWorkspaces();
});
