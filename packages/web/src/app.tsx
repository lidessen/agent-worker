/** @jsxImportSource semajsx/dom */

import { render } from "semajsx/dom";
import { route } from "./router.ts";
import { AppShell } from "./components/layout/app-shell.tsx";
import { DashboardPage } from "./pages/dashboard.tsx";
import { AgentChatPage } from "./pages/agent-chat.tsx";
import { WorkspacePage } from "./pages/workspace.tsx";
import { ChannelPage } from "./pages/channel.tsx";
import { SettingsPage } from "./pages/settings.tsx";

function createPage(page: string) {
  switch (page) {
    case "dashboard":
      return <DashboardPage />;
    case "agent-chat":
      return <AgentChatPage />;
    case "workspace":
      return <WorkspacePage />;
    case "channel":
      return <ChannelPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}

// Use window-level state to avoid any closure/minification issues
declare global {
  interface Window {
    __appRouter?: {
      mountEl: HTMLDivElement | null;
      renderedPage: string;
      currentUnmount: (() => void) | null;
    };
  }
}

window.__appRouter = {
  mountEl: null,
  renderedPage: "",
  currentUnmount: null,
};

function doRender() {
  const state = window.__appRouter!;
  if (!state.mountEl) {
    console.log("[doRender] no mountEl");
    return;
  }
  const page = route.value.page;
  console.log("[doRender] page=" + page + " renderedPage=" + state.renderedPage);
  if (page === state.renderedPage) {
    console.log("[doRender] skip same page");
    return;
  }
  state.renderedPage = page;

  if (state.currentUnmount) {
    try {
      state.currentUnmount();
    } catch (err) {
      console.warn("[doRender] unmount error:", err);
    }
    state.currentUnmount = null;
  }

  const el = state.mountEl;
  const childCount = el.childNodes.length;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
  console.log("[doRender] cleared " + childCount + " children, now " + el.childNodes.length);

  const vnode = createPage(page);
  console.log("[doRender] vnode type=" + (vnode as any)?.type?.name + " or " + typeof (vnode as any)?.type);
  const result = render(vnode, el);
  state.currentUnmount = result.unmount;
  console.log("[doRender] rendered, el now has " + el.childNodes.length + " children");
}

window.addEventListener("hashchange", () => {
  doRender();
});

export function App() {
  return (
    <AppShell>
      <div
        style="display: contents"
        ref={(el: HTMLDivElement) => {
          window.__appRouter!.mountEl = el;
          doRender();
        }}
      />
    </AppShell>
  );
}
