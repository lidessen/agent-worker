import { signal, computed } from "semajsx/signal";
import { client } from "./connection.ts";
import { currentWorkspace, selectedItem, selectChannel } from "./navigation.ts";
import { agents } from "./agents.ts";
import type { DocInfo, WorkspaceInfo } from "../api/types.ts";

export const wsInfo = signal<WorkspaceInfo | null>(null);
export const wsChannels = signal<string[]>([]);
export const wsDocs = signal<DocInfo[]>([]);
export const wsLoading = signal(false);

// Agents filtered by current workspace
export const wsAgents = computed([agents, currentWorkspace], (list, ws) =>
  list.filter((a) => a.workspace === ws),
);

// Load workspace data (channels, docs, info)
export async function loadWorkspaceData(key: string) {
  const c = client.value;
  if (!c) return;
  wsLoading.value = true;
  try {
    const [info, channels, docs] = await Promise.all([
      c.getWorkspace(key),
      c.listChannels(key),
      c.listDocs(key),
    ]);
    wsInfo.value = info;
    wsChannels.value = channels;
    wsDocs.value = docs;
    if (!selectedItem.value && channels.length > 0) {
      selectChannel(key, channels[0]);
    }
  } catch (err) {
    console.error(`Failed to load workspace data for ${key}:`, err);
    wsInfo.value = null;
    wsChannels.value = [];
    wsDocs.value = [];
  } finally {
    wsLoading.value = false;
  }
}

// Auto-load when workspace changes
currentWorkspace.subscribe((key) => {
  const c = client.value;
  if (c) loadWorkspaceData(key);
});

// Also load when client connects
client.subscribe((c) => {
  if (c) loadWorkspaceData(currentWorkspace.value);
});

// Handle case where client is already connected when this module loads
if (client.value) loadWorkspaceData(currentWorkspace.value);
