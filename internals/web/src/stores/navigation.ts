import { signal } from "semajsx/signal";

export type SelectedItem =
  | { kind: "channel"; wsKey: string; channel: string }
  | { kind: "agent"; name: string }
  | { kind: "agent-info"; name: string }
  | { kind: "doc"; wsKey: string; docName: string }
  | { kind: "harness-settings"; wsKey: string }
  | { kind: "global-settings" }
  | { kind: "global-events" }
  | { kind: "monitor" };

export type SidebarTab = "channels" | "agents" | "docs";

export const currentHarness = signal<string>("global");
export const sidebarTab = signal<SidebarTab>("channels");
export const selectedItem = signal<SelectedItem | null>(null);

export function selectChannel(wsKey: string, channel: string) {
  selectedItem.value = { kind: "channel", wsKey, channel };
}

export function selectAgent(name: string) {
  selectedItem.value = { kind: "agent", name };
}

export function showAgentInfo(name: string) {
  selectedItem.value = { kind: "agent-info", name };
}

export function selectDoc(wsKey: string, docName: string) {
  selectedItem.value = { kind: "doc", wsKey, docName };
}

export function selectHarnessSettings(wsKey: string) {
  selectedItem.value = { kind: "harness-settings", wsKey };
}

export function selectGlobalSettings() {
  selectedItem.value = { kind: "global-settings" };
}

export function selectGlobalEvents() {
  selectedItem.value = { kind: "global-events" };
}

export function selectMonitor() {
  selectedItem.value = { kind: "monitor" };
}
