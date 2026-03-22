import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { AgentInfo, AgentState } from "../api/types.ts";

export const agents = signal<AgentInfo[]>([]);
export const agentsLoading = signal(false);
export const currentAgentName = signal<string | null>(null);
export const agentState = signal<AgentState | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollName: string | null = null;

export async function fetchAgents() {
  const c = client.value;
  if (!c) return;
  agentsLoading.value = true;
  try {
    agents.value = await c.listAgents();
  } catch (err) {
    console.error("Failed to fetch agents:", err);
  } finally {
    agentsLoading.value = false;
  }
}

// Auto-fetch when client connects
client.subscribe((c) => {
  if (c) fetchAgents();
});

export async function fetchAgentState(name: string) {
  const c = client.value;
  if (!c) return;
  try {
    currentAgentName.value = name;
    agentState.value = await c.getAgentState(name);
  } catch (err) {
    console.error(`Failed to fetch agent state for ${name}:`, err);
    agentState.value = null;
  }
}

export function startPolling(name: string) {
  stopPolling();
  pollName = name;
  pollTimer = setInterval(() => {
    if (pollName) fetchAgentState(pollName);
  }, 5000);
}

export function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollName = null;
}

export async function deleteAgent(name: string) {
  const c = client.value;
  if (!c) throw new Error("Not connected");
  await c.deleteAgent(name);
  await fetchAgents();
}
