# Agent-Worker Web UI Design

## Overview

`agent-worker` web UI 是 agent-worker 系统的浏览器前端，跑在 Mac Mini 上，从手机/浏览器远程访问。提供 workspace 管理、agent 监控、channel 通信、文档查看等完整功能。

**后端**: 复用 daemon 作为唯一 server 进程 (`packages/agent-worker/src/daemon.ts`)，需要补齐 stream contract + 静态文件服务。

**数据模型**: Event-first — daemon 已持久化有序事件流 (JSONL)，前端通过流式 fetch 实时接收 + cursor-based API 拉取历史。

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

| Package | 位置 | 职责 |
|---------|------|------|
| `@agent-worker/web` | `packages/web/` | SPA 前端, 只依赖 `semajsx` umbrella |

前端 `jsxImportSource: semajsx/dom`。

semajsx 组件包 (`@semajsx/blocks`, `@semajsx/chat`) **推迟到 Phase 4** — 先在 `packages/web` 内部做最小组件，证明事件/消息/状态三类视图稳定后再提炼。

## Daemon — 已有 API + 需补齐的 Gap

### 已有且可直接用的

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
GET    /workspaces/:key/status              — workspace 状态 (loops, channels, agent details) ★
DELETE /workspaces/:key                     — 停止 workspace
POST   /workspaces/:key/send               — 发送到 workspace
GET    /workspaces/:key/channels/:ch        — channel 消息 (cursor-based)
GET    /workspaces/:key/events              — workspace 事件 (cursor-based)
GET    /workspaces/:key/inbox/:agent        — agent inbox ★
GET    /workspaces/:key/docs                — 文档列表
GET    /workspaces/:key/docs/:name          — 读取文档
PUT    /workspaces/:key/docs/:name          — 写入文档
PATCH  /workspaces/:key/docs/:name          — 追加文档

GET    /events                              — 全局事件日志 (cursor-based)
```

★ = 设计文档前版本遗漏，实际已存在且 UI 应优先使用。

### 需要补齐的 Gap

| Gap | 现状 | 需要做的 |
|-----|------|---------|
| **Stream replay/cursor** | 所有 `.../stream` 都是 live-only，不支持 `?cursor=N` 回放 | 统一所有 stream handler: 先按 cursor 补发 backlog，再切 live push |
| **Channel stream 过滤** | `handleWorkspaceChannelStream()` 推送 workspace 全部 message 事件，不按 channel 过滤 | 只推送 `msg.channel === ch`；若有 `?agent` query，只保留相关消息 |
| **静态文件服务** | 无 | 加 SPA fallback 路由: serve `packages/web/dist/`, 未匹配路径返回 `index.html` |
| **BusEvent 类型** | 弱类型信封 (`type/source/agent/workspace/[payload]`) | 前端需要做事件分类映射 (见下方前端状态设计) |

## Frontend Pages

| 页面 | 路径 | 数据源 |
|------|------|--------|
| Dashboard | `/` | `/health`, `/agents`, `/workspaces` |
| Agent Chat | `/agents/:name` | `/agents/:name/state` + `/agents/:name/responses` + stream |
| Workspace | `/workspaces/:key` | `/workspaces/:key/status` + `/workspaces/:key/events` + docs APIs |
| Channel | `/workspaces/:key/channels/:ch` | `/workspaces/:key/channels/:ch` + stream |
| Settings | `/settings` | 本地 localStorage |

### 前端状态

Signal-based stores，**按语义分桶**（不是只用一个 eventsByTarget）：

```ts
// daemon 连接
const connectionState = signal<"connecting" | "connected" | "disconnected" | "error">("disconnected");

// agents
const agents = signal<AgentInfo[]>([]);
const agentStateByName = signal<Map<string, AgentState>>(new Map());

// workspaces
const workspaces = signal<WorkspaceInfo[]>([]);

// 会话消息 (agent responses / channel messages)
const conversationByTarget = signal<Map<string, Message[]>>(new Map());

// 操作时间线 (run lifecycle, tool calls, errors)
const timelineByTarget = signal<Map<string, TimelineEvent[]>>(new Map());

// 资源状态 (docs, inbox)
const docsByWorkspace = signal<Map<string, Doc[]>>(new Map());

// 游标 (用于 stream reconnect)
const cursorByTarget = signal<Map<string, number>>(new Map());
```

**Stream 策略**: 同时只对当前查看的 target 保持 fetch stream 连接。切换时 abort 旧连接，用 cursor 续接新连接。

## Open Questions

| # | 问题 | 影响 | 验证方式 |
|---|------|------|---------|
| 1 | Stream replay 方案: 支持 `?cursor=N` backlog vs 前端先 GET 再连 stream | 决定 daemon 改动范围 | M0 实现时选择 |
| 2 | BusEvent → 前端事件分类的映射规则 | 决定 stores 的 shape 和 block 渲染 | 对比 daemon 实际推送的事件类型 |
| 3 | 长 event log 的分页/裁剪 | daemon 已有 cursor-based 分页，确认是否够用 | M0 验证 |

## Milestones

### M0: Daemon 补齐 + 验证
- 补 stream cursor/replay 语义 (所有 stream handler)
- 修 channel stream filter (按 channel + agent 过滤)
- 加静态文件服务 + SPA fallback
- 验证 Bun.build 解析 semajsx umbrella 子路径
- 映射 BusEvent 类型 → 前端事件分类

### M1: 最小前端
- `packages/web/` SPA 骨架 + signal stores + fetch streaming client
- Dashboard: 列出 agents + workspaces
- Agent Chat: 发消息 + 实时 responses stream 渲染
- 最小 block 渲染: text, run_start/end, tool_call, error
- 移动端响应式

### M2: Workspace 功能
- M2a: Agent Inspector — state, inbox, todos
- M2b: Channel 视图 — 消息流 + 发送
- M2c: Docs 集成 — 查看/编辑

### M3: 增强
- Workspace 创建 (YAML 编辑器)
- Runtime/model 配置
- 富渲染 (ToolCallCard, ThinkingBlock)

### M4: 组件提炼
- 从 `packages/web` 提炼稳定组件到 `@semajsx/blocks` + `@semajsx/chat`
- Umbrella 导出 `semajsx/blocks`, `semajsx/chat`
- 供未来其他前端复用
