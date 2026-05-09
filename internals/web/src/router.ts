import { signal } from "semajsx/signal";

export type Route =
  | { page: "dashboard" }
  | { page: "agent-chat"; params: { name: string } }
  | { page: "workspace"; params: { key: string } }
  | { page: "channel"; params: { key: string; ch: string } }
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

  const channelMatch = path.match(/^\/workspaces\/([^/]+)\/channels\/([^/]+)$/);
  if (channelMatch) {
    return {
      page: "channel",
      params: {
        key: decodeURIComponent(channelMatch[1]),
        ch: decodeURIComponent(channelMatch[2]),
      },
    };
  }

  const wsMatch = path.match(/^\/workspaces\/([^/]+)$/);
  if (wsMatch) {
    return { page: "workspace", params: { key: decodeURIComponent(wsMatch[1]) } };
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
