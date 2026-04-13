# Autonomous /loop Session — Final Handoff

日期：2026-04-13
分支：`codex/dev-runtime-workspace`

## TL;DR

用户上午交接说持续推进 "replace Codex/Claude Code for daily dev work"，alternating sub-agent 与 codex。我用 sub-agent 做所有设计讨论与代码审查。session 共 26 个 commit，全部落入同一分支，测试、lint、typecheck 全绿（除 `packages/web/src/utils/time.test.ts` 一个 pre-existing `bun:test` 类型错误，与本次改动无关）。

**核心结论**：workspace-led hierarchical agent system 的观测链路从底层 state store 一路走到用户面（CLI + Web UI）全部打通，剩余工作主要在"让 agent 在真实 runtime 下自动用这套体系"。

## 最终状态

```
878 tests | 0 fail | 1896 expect calls
oxlint: 0 warnings / 0 errors
typecheck: clean (web/time.test.ts 的 bun:test 类型错误是 pre-existing)
```

40 commits in this /loop session. 每一个设计 backlog 里的 substantive 项目要么已经落地，要么作为 known-follow-up 明确留在 docs 里。

完整 commit 列表（session 内，按时间顺序倒序）：

```
68df32b agent: implement compact PressureAction
1d02c2c agent-worker: chronicle entries + HTTP chronicle endpoint
46abff8 loop: optional usage estimator for CLI runtimes without native token counts
6a217bf agent: config fallback for contextWindow on usage snapshots
ea8728e web: expandable task rows with attempts / handoffs / artifacts
e147e63 workspace: surface new handoffs in the lead ledger delta
52e1959 agent-worker: end-to-end orchestrator + tools integration test
4fdd967 web,agent-worker: live task ledger refresh via bus events
d3b1ef2 docs: refresh final handoff with iterations 5-8
010eabd fixes from operator complete/abort review
378a876 agent-worker: operator complete/abort commands for the task ledger
2106e38 agent-worker: HTTP POST + CLI mutation surface for the task ledger
a9ea5c1 workspace,orchestrator: lead onCheckpoint auto-injects ledger deltas
6e005fa docs: final handoff + example workspace config
aa63d8f fixes from iteration 4 review
b1a960b agent: implement onCheckpoint hook at run boundaries
ab89906 web: render the task ledger on the workspace page
47376fe cli: add 'aw task ls' and 'aw task get' for the workspace ledger
0bc6830 agent-worker: HTTP endpoints for the workspace task ledger
2b7d5dd workspace: scenario test for the full task lifecycle
a24568b workspace: fixes from file-store + dispatch review
8efc511 workspace: add task_dispatch for lead→worker assignment
8206416 workspace: teach the lead and workers the task ledger workflow
8be6938 workspace,agent-worker: render task ledger in the lead prompt
975e689 workspace: add FileWorkspaceStateStore and use it when storageDir is set
77bfb8d agent: replace fixed sleeps in pressure tests with waitForSettle helper
5fb6039 docs: session progress handoff for the autonomous /loop run
f9af59a workspace: add attempt/handoff/artifact MCP tools
af50f51 workspace: materialise kickoff as a draft Task
131dadc workspace: expose task_* MCP tools backed by the kernel state store
19aced2 workspace: attach kernel state store to Workspace runtime
92b0807 workspace: introduce Task/Attempt/Handoff/Artifact kernel state
8b627cf workspace: resolve agent role from config
ae4044f loop,agent: fixes from PR1-3 review
014affa agent: add lifecycle hooks with onContextPressure
843f450 loop: stream usage events from claude-code and ai-sdk
586b825 docs: workspace-led hierarchical agent system design
cecc287 loop: stream token usage events from codex
```

## 新系统全景

### 1. 运行时 context accounting（runtime 层）

- `LoopEvent.usage`（packages/loop/src/types.ts）携带累积 token 使用量 + 可选 `contextWindow` / `usedRatio` + `source: "runtime" | "estimate"`
- `LoopCapability.usageStream` 标记 runtime 是否支持流式 usage
- claude-code / codex / ai-sdk 都实现并流式 emit；cursor 暂不支持
- codex 优先读 `tokenUsage.cumulative`，fallback 到 `last`

### 2. Agent lifecycle hooks（agent 层）

- `AgentConfig.hooks: AgentLifecycleHooks`
- `onContextPressure(ctx)` 在 usage 超过阈值时触发（默认 softRatio=0.70 / hardRatio=0.90，可用 softTokens / hardTokens 覆盖）
  - 返回 `{kind:"continue"}` / `{kind:"end", summary?}`
  - `compact` 已在类型里预留（`never` 穷尽守卫），以后加不 silent fall through
  - hard 触发时会先补发 soft，保证 hook 总是看到有序升级
- `onCheckpoint(ctx)` 在 run_start / run_end 边界触发
  - 返回 `{kind:"noop"}` / `{kind:"inject", content}`
  - `inject` 路径：能 interrupt 就 `loop.interrupt(content)`，否则作为 system 消息 push 到 inbox
  - run_end 只走 inbox 路径
- 两个 hook 都 swallow throw：记 bus event `agent.error`，不 propagate 到 agent state

### 3. Role 解析（config 层）

- `AgentDef.role?: "lead" | "worker" | "observer"`
- 未指定时根据 `workspace.lead === name` 推导
- observer 是 bot / 自动化成员占位，orchestration 不会派生成 task-scoped Attempt（但这层行为目前还没实现，只是角色已留）

### 4. 一等状态对象（workspace 层）

- `packages/workspace/src/state/`：
  - `Task`：lifecycle status 含 `draft`（无 TaskDraft 独立对象）
  - `Attempt`：task-scoped runtime instance，明确与静态 AgentSpec 区分
  - `Handoff`：结构化 shift（progress / blocked / completed / aborted）
  - `Artifact`：ref-style 执行产出引用（file:/git:/url:）
- `WorkspaceStateStore` interface + 两个实现：
  - `InMemoryWorkspaceStateStore`
  - `FileWorkspaceStateStore`：JSONL 追加，启动时 replay，last-write-wins，torn 末行容错，artifact/task 交叉引用 reconcile
- `Workspace` 按 `storageDir` 自动选实现

### 5. MCP 工具面

全部在 `packages/workspace/src/context/mcp/task.ts`：

- `task_create` / `task_list` / `task_get` / `task_update`
- `attempt_create` / `attempt_list` / `attempt_get` / `attempt_update`
- `handoff_create` / `handoff_list`
- `artifact_create` / `artifact_list`
- `task_dispatch` — lead 一键派发给 worker（创建 attempt + 推进 task status + 入 instructionQueue）

所有 active-attempt 读-改-写路径用 per-task in-flight Set 锁防止并发 race。

### 6. Prompt 注入（workspace 层）

- `taskLedgerSection` — 只给 lead 看，按 status 分组显示活跃任务
- `workspacePromptSection` 的 lead 分支说明 "draft → open → dispatch → completed" 流程
- `workspacePromptSection` 的 worker 分支强调：收到 dispatch 就用其中的 attempt id，不要 `attempt_create` 重开

### 7. 用户可见面

**守护进程 HTTP 路由（task ledger）：**

读：
- `GET /workspaces/:key/tasks[?status=…&ownerLeadId=…]`
- `GET /workspaces/:key/tasks/:id`

写：
- `POST /workspaces/:key/tasks` — create
- `POST /workspaces/:key/tasks/:id` — patch
- `POST /workspaces/:key/tasks/:id/dispatch` — dispatch to worker
- `POST /workspaces/:key/tasks/:id/complete` — close with completed status
- `POST /workspaces/:key/tasks/:id/abort` — close with aborted status

所有写路径：status 白名单校验（400）、terminal task 拒绝重复关闭（409）、active attempt 冲突拒绝重复 dispatch（409）。

**Client**：`AwClient.listWorkspaceTasks` / `getWorkspaceTask` / `createWorkspaceTask` / `updateWorkspaceTask` / `dispatchWorkspaceTask` / `completeWorkspaceTask` / `abortWorkspaceTask`

**CLI**：
```
aw task ls [@ws] [--status draft,open] [--owner <name>]
aw task get <id>
aw task new <title> --goal '...' [--status ...] [--owner ...] [--accept ...]
aw task update <id> [--status ...] [--title ...] [--goal ...]
aw task dispatch <id> --to <worker>
aw task complete <id> [--summary '...']
aw task abort <id> [--reason '...']
```

task id 有格式校验（`task_<hex>`），typo 快速失败。所有 subcommand 的位置参数扫描跳过 `@ws` 和 `--flag value` 对，不会被后续 flag 误当成 id。

**Web UI**：workspace 详情页的 Tasks section 按 status 分组（draft → open → in_progress → blocked → completed → aborted → failed），显示 owner / active attempt / artifact 数量。跨 workspace 导航时会重置 tasks 信号，避免 stale 渲染。

**Kickoff**：自动在 state store 里创建一个 `draft` Task，source kind = "kickoff"；如果有 resolved lead agent，把它设为 `ownerLeadId`。

**人机协作完整路径**：一个人类操作员现在可以完全不依赖"聪明的 lead agent" 驱动整个系统：
```
aw create workspace.yml
aw task new "Ship it" --goal "Merge PR 123"
aw task update task_abc --status open
aw task dispatch task_abc --to alice
# ...worker does stuff via MCP tools...
aw task complete task_abc --summary "Shipped"
```

Lead agent 不是必须品。它是增强（自动分类 draft、读取 ledger delta、派发决策），不是替代。

### 8. 自动化侧（当 lead 是真实 agent）

如果配置了一个 lead（真实 runtime），`buildLeadHooks(stateStore)` 会挂到 orchestrator，每次 lead run_start 都会自动注入上次 run_start 以来的 task ledger delta — 新任务、状态变化、active attempt 变化、被移除的任务。Lead 不需要每次都调 task_list 就能看到 "发生了什么"。

## 完整 observability 链路

```
user request
  └─ kickoff / channel / user message
       └─ lead agent receives via inbox
            └─ task_create (lead decides → draft)
                 └─ task_update status=open (lead confirms)
                      └─ task_dispatch worker=@codex
                           └─ Attempt record created
                           └─ Task status=in_progress + activeAttemptId set
                           └─ instruction enqueued on worker queue
                                └─ worker picks up via orchestrator.tick
                                     └─ worker reads attempt id from dispatch content
                                     └─ worker does work
                                     └─ artifact_create (outputs)
                                     └─ handoff_create kind=completed
                                     └─ attempt_update status=completed
                                          └─ endedAt stamped, activeAttemptId cleared
                                └─ lead sees handoff in its prompt ledger
                                     └─ task_update status=completed

可视化：
- MCP：agent 运行时能看到所有状态
- HTTP：aw client / 外部工具
- CLI：aw task ls / aw task get
- Web UI：workspace 详情页 Tasks section
- prompt：lead 每 run 都看到 task ledger 头部
```

## 已完成的关键后续项目（相对于第一版 handoff）

- ✅ **Lead 自动决策 → orchestration**：`buildLeadHooks` 每次 lead `run_start` 注入 task ledger delta + 新 handoff（`a9ea5c1`、`e147e63`）
- ✅ **File-backed state store**：`FileWorkspaceStateStore` 带 JSONL replay、torn-line 容错、artifact/task 交叉引用 reconcile（`975e689` + `a24568b`）
- ✅ **HTTP + CLI mutation surface**：`aw task new/update/dispatch/complete/abort`（`2106e38`、`378a876`、`010eabd`）
- ✅ **Cursor usage estimator**：`cli-loop.ts` 的 opt-in post-hoc text estimator（`46abff8`）
- ✅ **Context window auto-discovery**：`AgentConfig.contextWindow` 作为 runtime 未报告时的 fallback，Agent 自动填充 `usedRatio`（`6a217bf`）
- ✅ **compact PressureAction**：`RunCoordinator.resetHistory` + Agent post-run cleanup 路径（`68df32b`）
- ✅ **Web UI live refresh + task detail expansion**：workspace event stream 订阅，task row 可展开看 attempts/handoffs/artifacts（`4fdd967`、`ea8728e`）
- ✅ **Chronicle task audit trail**：每个 task mutation 自动 append chronicle entry，新 `GET /workspaces/:key/chronicle` endpoint（`1d02c2c`）
- ✅ **End-to-end orchestrator + tools integration test**：全链路（dispatch → 指令派发 → worker 工具调用 → 终结）的 unit 级复合测试，不依赖真实 runtime（`52e1959`）

## 仍然没做的关键部分（更新后）

上一版 handoff 里的 7 项里程碑大部分已落地，下面是剩余的、都是真正 **前端** 或 **future work** 的项：

按优先级：

### 1. 真实 runtime 下的端到端验证

当前所有 MCP 工具的 unit / scenario 测试都用 `InMemoryWorkspaceStateStore` 和手动调用。没有一个测试是让一个真实 runtime（claude-code / codex）根据 prompt 指引自动走 task_dispatch。

**为什么重要**：这是 "replace Codex/Claude Code" 最终 validation。设计和代码都到位了，但没有证据证明真实模型会按 prompt 里的指导走。

**建议做法**：
- 写一个 mock loop 实现，它能根据指令简单解析并调用 tools（类似 function-calling 的最小代理）。
- 或者用真实 codex/claude-code runtime 跑一个 canary 配置（需要 API key），记录 trace。

### 2. Lead 的 onCheckpoint 自动使用

`onCheckpoint` hook 已经落地，但没有 lead-specific 的实现。Lead 目前还是每次 run 都通过 `taskLedgerSection` 看静态 ledger，再手动调 task_list。如果用 onCheckpoint inject 每次 checkpoint 之间的 delta（新建任务、状态变化、新 handoff），lead 能更快响应。

**建议做法**：在 `packages/workspace/src/` 里加一个 `buildLeadHooks(workspace)` factory，close over stateStore，记录每次 run_start 时看到的 task state，下一次 run_end 时对比 diff 并 inject 变更。这是 lead 的 "workspace-rolling context" 的具象实现。

### 3. Profile resolver

Role 已经 resolve 出来，但下游没有用它来自动装 hooks / instructions / tool surface bundle。当前 prompt 里的 role 分支是临时方案。正式的 profile resolver 应该在 `packages/workspace/src/config/` 或一个新 `profile/` 目录里，接 `ResolveProfileInput` → `ResolvedAgentAssembly`。

**为什么重要**：没 resolver 的话 lead/worker 差别只能写死在 prompt 里，lead 换成 codex 而 worker 用 claude-code 这种简单情况都要手动拼。

### 4. Web UI 实时更新

Task section 现在是页面加载时的一次性 fetch。workspace event stream 已经有 SSE 端点（`/workspaces/:key/events/stream`），但 task 相关的变化目前不会进 bus event。

**建议做法**：让 FileWorkspaceStateStore（或一个 wrapper）在 create/update 时 emit 一个 `workspace.task_changed` bus event，web UI 订阅后 invalidate cache 并重新 fetch。

### 5. 文件存储并发锁

`FileWorkspaceStateStore` 文档说不安全 for multi-process。daemon 当前每个 workspace 一个进程，但如果将来允许 worker 子进程自己写 state（避免 RPC 回路），需要 flock 或类似的机制。

### 6. Cursor usage estimator

Cursor runtime 没有原生 usage 信号，当前只是 capability-absent。如果 daily driver 场景里 cursor 被允许作为 worker，就需要一个基于 transcript 长度的估算器（标 `source: "estimate"`）。

### 7. 其他小项

- context window 的三层 fallback（runtime 报告 / config 声明 / 没有）目前只留了字段，没实际发现逻辑
- `compact` PressureAction 预留未实现（需要 cancel+restart 的 coordination）
- `handed_off` 状态清 activeAttemptId 的逻辑需要更明确的文档：这意味着 "attempt 放弃了对 task 的控制，但 task 本身还 active"
- 并发 `task_dispatch` 锁用的是进程内 Set，跨 daemon 重启不持久；重启期间的 race 不会被防护（但现在 daemon 每个 workspace 单进程，重启后所有 in-flight 都断了）

## 给下次恢复的建议

1. 先 `git status --short` 确认现场。
2. `bun run test` 再次验证（847+ tests）。
3. 读这份 handoff 的"仍然没做的关键部分"，按优先级挑 1-2 项推进。
4. 真实 runtime validation（条目 1）是最高价值的 unblock — 一旦有证据真实 agent 会按 prompt 走 task_dispatch，后面可以大胆依赖这套机制做 orchestration。
5. 如果时间很少，先做条目 2（lead onCheckpoint auto-inject），它把现有零件粘合成实际能感受到的改进。

## 一句话结论

"Workspace-led hierarchical agent system" 的骨架和观测链路全部打通，kernel objects / hooks / MCP / HTTP / CLI / Web UI 从底到顶都齐了。还差的是"真实 runtime 按设计走"的证据和少量 auto-orchestration glue，这些都是下一阶段的工作，不是这一阶段的欠账。
