import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { HarnessInfo } from "../api/types.ts";

export const harnesses = signal<HarnessInfo[]>([]);
export const harnessesLoading = signal(false);

export async function fetchHarnesses() {
  const c = client.value;
  if (!c) return;
  harnessesLoading.value = true;
  try {
    harnesses.value = await c.listHarnesses();
  } catch (err) {
    console.error("Failed to fetch harnesses:", err);
  } finally {
    harnessesLoading.value = false;
  }
}

export async function deleteHarness(key: string) {
  const c = client.value;
  if (!c) throw new Error("Not connected");
  await c.deleteHarness(key);
  await fetchHarnesses();
}

// Auto-fetch when client connects
client.subscribe((c) => {
  if (c) fetchHarnesses();
});

// Handle case where client is already connected when this module loads.
if (client.value) fetchHarnesses();
