# packages/web — Design

> Browser SPA for agent-worker. Runs on Mac Mini; accessed from phone/browser remotely. Reuses daemon as the only server process — no separate backend.

See [../DESIGN.md](../DESIGN.md) for the system-level context.

## Overview

`agent-worker` web UI 是 agent-worker 系统的浏览器前端，跑在 Mac Mini 上，从手机/浏览器远程访问。提供 workspace 管理、agent 监控、channel 通信、文档查看等完整功能。

**后端**: 复用 daemon 作为唯一 server 进程 (`packages/agent-worker/src/daemon.ts`)，提供 REST + streaming API + SPA 静态文件服务。

**数据模型**: Event-first — daemon 持久化有序事件流 (JSONL)，前端通过流式 fetch 实时接收 + cursor-based API 拉取历史。所有 stream handler 支持 `?cursor=N` 回放。

## Non-goals

- 不新建 server package — 复用 daemon
- 不做多用户/权限 — 个人工具
- 不过早抽象 semajsx 组件包 — 先在 `packages/web` 内部做，接口稳定后再提炼

## Architecture

```
┌──────────────┐   fetch streaming   ┌─────────────────────────┐
│  SPA 前端     │   + REST API        │  Daemon (已有)            │
│  (semajsx)   │ ◄──────────────────► │  packages/agent-worker   │
└──────────────┘   Authorization:     ├─────────────────────────┤
                   Bearer header      │  /agents/*              │
                                      │  /workspaces/*          │
                                      │  /events/*              │
                                      └─────────────────────────┘
```

### Transport

Web 前端使用 `fetch + ReadableStream + Authorization header` 消费流式端点，**不使用 EventSource**。

理由：

- `fetch` 流式响应可以带 `Authorization` header，不需要把 token 暴露到 URL query param
- 与已有 CLI client (`packages/agent-worker/src/client.ts`) 的 `sseStream()` 模式一致
- 避免维护 REST header auth 和 SSE query auth 两套逻辑

### Packages

| Package             | 位置            | 职责                                |
| ------------------- | --------------- | ----------------------------------- |
| `@agent-worker/web` | `packages/web/` | SPA 前端, 只依赖 `semajsx` umbrella |

前端 `jsxImportSource: semajsx/dom`。

semajsx 组件包 (`@semajsx/blocks`, `@semajsx/chat`) **推迟到 Phase 4** — 先在 `packages/web` 内部做最小组件，证明事件/消息/状态三类视图稳定后再提炼。

## Daemon API

```
GET    /health                              — daemon 状态
GET    /agents                              — 列出 agents
POST   /agents                              — 创建 agent (RuntimeConfig)
GET    /agents/:name                        — agent 详情
DELETE /agents/:name                        — 删除 agent
POST   /agents/:name/send                   — 发送消息
GET    /agents/:name/responses              — 文本响应 (cursor-based)
GET    /agents/:name/events                 — 事件日志 (cursor-based)
GET    /agents/:name/state                  — agent state, inbox, todos

GET    /workspaces                          — 列出 workspaces
POST   /workspaces                          — 从 YAML 创建 workspace
GET    /workspaces/:key                     — workspace 详情
GET    /workspaces/:key/status              — workspace 状态 (loops, channels, agent details)
DELETE /workspaces/:key                     — 停止 workspace
POST   /workspaces/:key/send               — 发送到 workspace
GET    /workspaces/:key/wait               — 阻塞等待 task workspace 完成
GET    /workspaces/:key/chronicle           — workspace 编年事件
POST   /workspaces/:key/tool-call          — workspace tool call
GET    /workspaces/:key/agent-scopes       — agent scopes
GET    /workspaces/:key/channels/:ch        — channel 消息 (cursor-based, ?agent 过滤)
DELETE /workspaces/:key/channels/:ch        — 清空 channel
GET    /workspaces/:key/events              — workspace 事件 (cursor-based)
GET    /workspaces/:key/inbox/:agent        — agent inbox
GET    /workspaces/:key/docs                — 文档列表
GET    /workspaces/:key/docs/:name          — 读取文档
PUT    /workspaces/:key/docs/:name          — 写入文档
PATCH  /workspaces/:key/docs/:name          — 追加文档
GET    /workspaces/:key/tasks               — 列出 tasks
POST   /workspaces/:key/tasks               — 创建 task
GET    /workspaces/:key/tasks/:id           — task 详情
POST   /workspaces/:key/tasks/:id/dispatch  — 分发 task
POST   /workspaces/:key/tasks/:id/complete  — 完成 task
POST   /workspaces/:key/tasks/:id/abort     — 中止 task

GET    /events                              — 全局事件日志 (cursor-based)
```

所有 stream 端点支持 `?cursor=N` 回放 (先补发 backlog，再切 live push)。Channel stream 按 channel 过滤，支持 `?agent` 参数。静态文件服务从 `packages/web/dist/` 提供 SPA fallback。

## Frontend Pages

| 页面              | 路径                            | 数据源                                                            |
| ----------------- | ------------------------------- | ----------------------------------------------------------------- |
| Dashboard         | `/`                             | `/health`, `/agents`, `/workspaces`                               |
| Agent Chat        | `/agents/:name`                 | `/agents/:name/state` + `/agents/:name/responses` + stream        |
| Agent Inspector   | `/agents/:name` (侧边栏)       | `/agents/:name/state` — 可折叠 state/inbox/todos 面板             |
| Workspace         | `/workspaces/:key`              | `/workspaces/:key/status` + `/workspaces/:key/events` + docs APIs |
| Workspace Settings| `/workspaces/:key` (侧边栏)     | workspace 详情、agents 列表、channels 概览                        |
| Channel           | `/workspaces/:key/channels/:ch` | `/workspaces/:key/channels/:ch` + stream                          |
| Global Events     | `/events`                       | `/events` + stream — 全局 daemon 事件日志                         |
| Settings          | `/settings`                     | 本地 localStorage                                                 |

移动端有专用 `MobileHome` 布局，使用 resource tabs 切换视图。

### 前端状态

Signal-based stores，**按上下文独立存储**（不是统一 Map）：

```ts
// daemon 连接
connectionState: "connecting" | "connected" | "disconnected" | "error"
client: WebClient | null

// agents
agents: AgentInfo[]
agentState: AgentState | null        // 当前查看的 agent
currentAgentName: string | null

// workspaces
workspaces: WorkspaceInfo[]
wsInfo: WorkspaceInfo | null         // 当前 workspace 详情
wsChannels: string[]
wsDocs: DocInfo[]

// agent responses (当前 agent)
events: DaemonEvent[]
cursor: number

// channel messages (当前 channel)
channelMessages: ChannelMessage[]
channelCursor: number

// daemon events (全局)
daemonEvents: DaemonEvent[]
daemonEventsCursor: number
```

导航状态独立在 `navigation.ts` — routes、sidebar state、selected items。

**Stream 策略**: 同时只对当前查看的 target 保持 fetch stream 连接。切换时 abort 旧连接，用 cursor 续接新连接。Stream 更新使用 `requestAnimationFrame` 批量合并以保证性能。

## Milestones

### M0: Daemon 补齐 + 验证 ✓

- ✓ stream cursor/replay (所有 stream handler 支持 `?cursor=N`)
- ✓ channel stream filter (按 channel + `?agent` 过滤)
- ✓ 静态文件服务 + SPA fallback
- ✓ Bun.build 解析 semajsx umbrella 子路径

### M1: 最小前端 ✓

- ✓ SPA 骨架 + signal stores + fetch streaming client
- ✓ Dashboard: agents + workspaces 列表
- ✓ Agent Chat: 发消息 + 实时 responses stream 渲染
- ✓ Block 渲染: text, run_start/end, tool_call, error, thinking
- ✓ 移动端响应式 (MobileHome + mobileQuery 检测)

### M2: Workspace 功能 ✓

- ✓ Agent Inspector — 可折叠 state/inbox/todos 面板
- ✓ Channel 视图 — 消息流 + 发送
- ✓ Docs 集成 — 查看/编辑
- ✓ Workspace Settings 面板 (超出原设计)
- ✓ Global Events 全局事件日志视图 (超出原设计)

### M3: 增强 (进行中)

- ✓ Workspace 创建 (YAML 编辑器)
- ✓ Agent 创建对话框
- ☐ Runtime/model 配置 UI
- ☐ 富渲染增强 (ToolCallCard 等)
- ☐ Task 管理 UI (API 已有，前端待建)

### M4: 组件提炼 (未开始)

- 从 `packages/web` 提炼稳定组件到 `@semajsx/blocks` + `@semajsx/chat`
- Umbrella 导出 `semajsx/blocks`, `semajsx/chat`
- 供未来其他前端复用

## Framework conventions (semajsx)

semajsx is signal-based, not React. Patterns that look right in React will either crash or silently break here. All `.tsx` files under `packages/web/` need `/** @jsxImportSource semajsx/dom */` at the top.

### Components return JSXNode, not functions

```tsx
// WRONG — crashes with "Invalid component return type: function"
return () => <div>...</div>;

// RIGHT
return <div>...</div>;
```

### Reactive content — pass signals directly, not wrapper functions

```tsx
// WRONG — function children are ignored with a warning
<span>{() => count.value}</span>

// RIGHT — signal auto-subscribes
<span>{count}</span>

// RIGHT — derived value via computed
<span>{computed(count, v => v + 1)}</span>
```

### Conditional rendering

```tsx
// WRONG
{condition.value ? <A /> : null}

// RIGHT
{when(conditionSignal, () => <A />)}
```

Event handlers ARE functions (this is correct):

```tsx
<button onclick={() => doThing()}>Click</button>
```

### Cleanup via component `ctx.onCleanup`

Not `useEffect` or `MutationObserver`:

```tsx
import type { ComponentAPI } from "semajsx";

function MyComponent(_props: Record<string, never>, ctx?: ComponentAPI) {
  const controller = new AbortController();
  ctx?.onCleanup(() => controller.abort());
  // ...
}
```

### Tokens need injection

```tsx
import { defineAndInjectTokens } from "semajsx/style";
const tokens = defineAndInjectTokens({ colors: { bg: "#000" } });
// defineTokens() alone does NOT inject CSS variables
```

### Don't return raw DOM nodes from components

```tsx
// WRONG — crashes
const el = document.createElement("div");
el.innerHTML = html;
return el;

// RIGHT — use ref callback
return (
  <div
    ref={(el: HTMLDivElement) => {
      el.innerHTML = html;
    }}
  />
);
```
