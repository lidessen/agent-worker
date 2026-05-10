import { signal, computed } from "semajsx/signal";
import { client } from "./connection.ts";
import { currentHarness, selectedItem, selectChannel } from "./navigation.ts";
import { agents } from "./agents.ts";
import type { DocInfo, HarnessInfo } from "../api/types.ts";

export const wsInfo = signal<HarnessInfo | null>(null);
export const wsChannels = signal<string[]>([]);
export const wsDocs = signal<DocInfo[]>([]);
export const wsLoading = signal(false);

// Agents filtered by current harness
export const wsAgents = computed([agents, currentHarness], (list, ws) =>
  list.filter((a) => a.harness === ws),
);

// Load harness data (channels, docs, info)
export async function loadHarnessData(key: string) {
  const c = client.value;
  if (!c) return;
  wsLoading.value = true;
  try {
    const [info, channels, docs] = await Promise.all([
      c.getHarness(key),
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
    console.error(`Failed to load harness data for ${key}:`, err);
    wsInfo.value = null;
    wsChannels.value = [];
    wsDocs.value = [];
  } finally {
    wsLoading.value = false;
  }
}

// Auto-load when harness changes
currentHarness.subscribe((key) => {
  const c = client.value;
  if (c) loadHarnessData(key);
});

// Also load when client connects
client.subscribe((c) => {
  if (c) loadHarnessData(currentHarness.value);
});

// Handle case where client is already connected when this module loads
if (client.value) loadHarnessData(currentHarness.value);
