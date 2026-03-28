import { signal } from "semajsx/signal";
import { WebClient } from "../api/client.ts";

export const connectionState = signal<
  "disconnected" | "connecting" | "connected" | "error"
>("disconnected");

export const client = signal<WebClient | null>(null);

export async function connect(baseUrl: string, token = "") {
  connectionState.value = "connecting";
  const c = new WebClient(baseUrl, token);
  try {
    await c.health();
    client.value = c;
    connectionState.value = "connected";
  } catch (err) {
    console.error("Connection failed:", err);
    connectionState.value = "error";
  }
}

export function disconnect() {
  client.value = null;
  connectionState.value = "disconnected";
}

// Auto-connect: try saved config first, then default local
const saved = localStorage.getItem("aw:config");
if (saved) {
  try {
    const { baseUrl, token } = JSON.parse(saved);
    if (baseUrl) connect(baseUrl, token ?? "");
  } catch {
    console.error("Invalid saved config in aw:config");
  }
} else {
  // Default: connect to same origin (daemon serves the SPA)
  connect(window.location.origin);
}
