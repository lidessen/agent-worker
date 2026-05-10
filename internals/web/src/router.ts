import { signal } from "semajsx/signal";
import {
  selectedItem,
  selectAgent,
  selectChannel,
  selectChat,
  selectHarnessSettings,
  selectGlobalSettings,
  selectMonitor,
  type SelectedItem,
} from "./stores/navigation.ts";

export type Route =
  | { page: "dashboard" }
  | { page: "agent-chat"; params: { name: string } }
  | { page: "harness"; params: { key: string } }
  | { page: "channel"; params: { key: string; ch: string } }
  | { page: "chat"; params: { key: string } }
  | { page: "monitor" }
  | { page: "settings" };

export const route = signal<Route>({ page: "dashboard" });

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "/");

  if (path === "/" || path === "") {
    return { page: "dashboard" };
  }

  const agentMatch = path.match(/^\/agents\/([^/]+)$/);
  if (agentMatch) {
    return { page: "agent-chat", params: { name: decodeURIComponent(agentMatch[1]) } };
  }

  const channelMatch = path.match(/^\/harnesses\/([^/]+)\/channels\/([^/]+)$/);
  if (channelMatch) {
    return {
      page: "channel",
      params: {
        key: decodeURIComponent(channelMatch[1]),
        ch: decodeURIComponent(channelMatch[2]),
      },
    };
  }

  const wsMatch = path.match(/^\/harnesses\/([^/]+)$/);
  if (wsMatch) {
    return { page: "harness", params: { key: decodeURIComponent(wsMatch[1]) } };
  }

  const chatMatch = path.match(/^\/chat\/([^/]+)$/);
  if (chatMatch) {
    return { page: "chat", params: { key: decodeURIComponent(chatMatch[1]) } };
  }

  if (path === "/monitor") {
    return { page: "monitor" };
  }

  if (path === "/settings") {
    return { page: "settings" };
  }

  return { page: "dashboard" };
}

window.addEventListener("hashchange", () => {
  route.value = parseHash(location.hash);
});

// Parse initial hash
route.value = parseHash(location.hash);

export function navigate(path: string) {
  location.hash = path;
}

// ── Bidirectional bridge: URL hash ↔ selectedItem ───────────────────────
//
// `selectedItem` is the source of truth for the rendered view (see
// `app.tsx::createView`). The `route` signal mirrors `location.hash`.
// We keep them in sync in both directions so direct-link entry
// (`/#/monitor`, `/#/agents/codex`, …) lands on the right view, and
// in-app navigation updates the URL for shareability.
//
// Loop guard: each side checks whether the incoming value already
// matches its current state before writing, so a single change
// converges in one round-trip.

function selectedItemToHash(item: SelectedItem | null): string {
  if (!item) return "#/";
  switch (item.kind) {
    case "channel":
      return `#/harnesses/${encodeURIComponent(item.wsKey)}/channels/${encodeURIComponent(item.channel)}`;
    case "agent":
      return `#/agents/${encodeURIComponent(item.name)}`;
    case "agent-info":
      // Agent-info is a sub-view of an agent; route to the agent page.
      return `#/agents/${encodeURIComponent(item.name)}`;
    case "doc":
      return `#/harnesses/${encodeURIComponent(item.wsKey)}`;
    case "harness-settings":
      return `#/harnesses/${encodeURIComponent(item.wsKey)}`;
    case "global-settings":
      return "#/settings";
    case "global-events":
      // No dedicated route yet; keep at root.
      return "#/";
    case "monitor":
      return "#/monitor";
    case "chat":
      return `#/chat/${encodeURIComponent(item.wsKey)}`;
  }
}

/**
 * True iff `item` already matches `r`. Used to skip redundant writes
 * that would otherwise feedback through the selectedItem→URL bridge.
 */
function selectedItemMatchesRoute(item: SelectedItem | null, r: Route): boolean {
  if (r.page === "dashboard") return item === null;
  if (!item) return false;
  switch (r.page) {
    case "agent-chat":
      return (item.kind === "agent" || item.kind === "agent-info") && item.name === r.params.name;
    case "channel":
      return (
        item.kind === "channel" &&
        item.wsKey === r.params.key &&
        item.channel === r.params.ch
      );
    case "harness":
      return (
        (item.kind === "harness-settings" || item.kind === "doc") && item.wsKey === r.params.key
      );
    case "settings":
      return item.kind === "global-settings";
    case "monitor":
      return item.kind === "monitor";
    case "chat":
      return item.kind === "chat" && item.wsKey === r.params.key;
  }
}

function applyRouteToSelectedItem(r: Route): void {
  if (selectedItemMatchesRoute(selectedItem.value, r)) return;
  switch (r.page) {
    case "dashboard":
      selectedItem.value = null;
      return;
    case "agent-chat":
      selectAgent(r.params.name);
      return;
    case "channel":
      selectChannel(r.params.key, r.params.ch);
      return;
    case "harness":
      selectHarnessSettings(r.params.key);
      return;
    case "settings":
      selectGlobalSettings();
      return;
    case "monitor":
      selectMonitor();
      return;
    case "chat":
      selectChat(r.params.key);
      return;
  }
}

// route → selectedItem (URL drives the view)
route.subscribe((r) => {
  applyRouteToSelectedItem(r);
});

// selectedItem → URL (in-app nav updates the URL)
selectedItem.subscribe((item) => {
  const want = selectedItemToHash(item);
  if (location.hash !== want) {
    // Use replaceState to avoid polluting browser history with every
    // sidebar click; back/forward still works for hashchange entries.
    history.replaceState(null, "", want);
  }
});

// Run the initial route mapping at module-load time so a deep link
// lands on the right view before the first paint.
applyRouteToSelectedItem(route.value);
