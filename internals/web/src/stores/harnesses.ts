import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { HarnessInfo } from "../api/types.ts";

export const harnesss = signal<HarnessInfo[]>([]);
export const harnesssLoading = signal(false);

export async function fetchHarnesss() {
  const c = client.value;
  if (!c) return;
  harnesssLoading.value = true;
  try {
    harnesss.value = await c.listHarnesss();
  } catch (err) {
    console.error("Failed to fetch harnesss:", err);
  } finally {
    harnesssLoading.value = false;
  }
}

export async function deleteHarness(key: string) {
  const c = client.value;
  if (!c) throw new Error("Not connected");
  await c.deleteHarness(key);
  await fetchHarnesss();
}

// Auto-fetch when client connects
client.subscribe((c) => {
  if (c) fetchHarnesss();
});

// Handle case where client is already connected when this module loads.
if (client.value) fetchHarnesss();
