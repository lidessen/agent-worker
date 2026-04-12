# Autonomous /loop Session Progress

日期：2026-04-13
分支：`codex/dev-runtime-workspace`

## Session 前序

用户早上交接要"持续推进 replace Codex / Claude Code 的任务，alternating sub-agent 与 codex:\* 命令"。随后改口：不需要用 codex:\*，直接用 sub-agent。之后给出一个重要的方向纠正：agent 抽象应该用生命周期 hooks 统一 lead / worker 的 context 管理，而不是分成两套机制；context 的计量必须下沉到 runtime 层，因为不同 runtime 的口径完全不同。

该方向被记录进 `memory/feedback_agent_hooks.md`，并作为本 session 的主要设计主线。

## 本次 session 已完成（12 个 commit）

按顺序：

1. **cecc287** `loop: stream token usage events from codex`
   - 新增 `LoopEvent` 的 `usage` 变体
   - Codex loop 在 `thread/tokenUsage/updated` 时 emit usage event
   - 新增 `"usageStream"` LoopCapability
   - Agent / run-coordinator / managed-agent / workspace-registry 全链路通
   - ManagedAgent 暴露 `lastUsage` 作为可观察字段

2. **586b825** `docs: workspace-led hierarchical agent system design`
   - 把散落的 4 份设计文档 + handoff 收到 `docs/design/workspace-led-hierarchical-agent-system/` 与 `docs/handoffs/`
   - 新增第 5 份文档 `lifecycle-hooks-and-context-accounting.md` 承接用户的 hook 方向纠正

3. **843f450** `loop: stream usage events from claude-code and ai-sdk`
   - ClaudeCodeLoop 在 SDK result message 时 emit usage event
   - AiSdkLoop 在 `onStepFinish` 累积并 emit cumulative usage
   - 两者都声明 `usageStream`
   - Cursor 保持 unsupported（不伪造）

4. **014affa** `agent: add lifecycle hooks with onContextPressure`
   - 新增类型：`UsageSnapshot` / `PressureLevel` / `ContextThresholds` / `PressureContext` / `PressureAction` / `CheckpointContext` / `CheckpointAction` / `AgentLifecycleHooks`
   - `AgentConfig` 新增 `hooks?` 和 `contextThresholds?` 字段，默认 softRatio=0.70 / hardRatio=0.90
   - Agent 追踪 `lastUsage`，对每次 usage event 做阈值判定，首次跨越时调用 `onContextPressure`
   - Soft / hard 升级逻辑：跳到 hard 时会先 fire soft，保持顺序
   - Hook 返回 `{kind:"end"}` 设置 `pendingGracefulStop` — 当前 run 自然结束，下一次 processLoop 迭代 shouldStop 即停止，不做 mid-run cancel
   - 新增 bus 事件 `agent.context_pressure` / `agent.graceful_stop_requested`
   - `RunCoordinator.onEvent` 现在支持 async 回调（executeRun 会 await）

5. **8b627cf** `workspace: resolve agent role from config`
   - `AgentDef` 新增可选 `role` (lead | worker | observer)
   - `ResolvedAgent.role` 必填
   - Loader 规则：显式 role 优先；否则 `agent.name === workspace.lead` → lead；否则 worker

6. **ae4044f** `loop,agent: fixes from PR1-3 review`
   - 修复 sub-agent review 指出的 4 个问题：
     - Codex 优先取 `tokenUsage.cumulative`，fallback 到 `last`（`last` 是 per-call 增量，不是累计）
     - `run-coordinator` 的 catch 分支现在 await onEvent
     - `PressureAction` switch 增加 `never` 耗尽性守卫（未来加 compact 不会 silently fall through）
     - 新增 test：throwing hook 被吞掉，agent 继续运行（记录了有意的"hook throw = continue"策略）
   - AI SDK step-sum-vs-totalUsage 发散留作 low-severity 已知项

7. **92b0807** `workspace: introduce Task/Attempt/Handoff/Artifact kernel state`
   - Phase 1 落地：新增 `packages/workspace/src/state/`
     - `types.ts` — Task / Attempt / Handoff / Artifact 完整字段
     - `store.ts` — `WorkspaceStateStore` interface + `InMemoryWorkspaceStateStore` 实现
     - `index.ts` — exports
   - 13 个 unit test 覆盖 happy path / FK 校验 / patch 不变式 / filter / 跨 task 隔离
   - Task.status 包含 `draft`，无独立 TaskDraft 对象

8. **19aced2** `workspace: attach kernel state store to Workspace runtime`
   - `Workspace.stateStore` field（`InMemoryWorkspaceStateStore`）
   - `WorkspaceRuntime` interface 同步

9. **131dadc** `workspace: expose task_* MCP tools backed by the kernel state store`
   - Phase 2b：`task_create` / `task_list` / `task_get` / `task_update`
   - 当 `stateStore` 可用时才 wire 进 `createWorkspaceTools`
   - 12 个 unit test
   - 还没有 role-gated 访问

10. **af50f51** `workspace: materialise kickoff as a draft Task`
    - Phase 2c：`ManagedWorkspace.kickoff()` 在发 channel message 的同时创建一个 draft Task
    - owner 设为解析出来的 lead agent，sourceRef 记录 `kind:kickoff` + channel + excerpt
    - 容错：state store 失败不影响 kickoff 主流程，emit `workspace.kickoff_task_failed`

11. **f9af59a** `workspace: add attempt/handoff/artifact MCP tools`
    - Phase 3a：工人端的 MCP 工具集
    - `attempt_create` 自动把自己 wire 成 task 的 `activeAttemptId` 并推进 status 到 in_progress
    - `attempt_update` 在终结状态（completed/failed/cancelled）stamp `endedAt` 并清空 `activeAttemptId`
    - `handoff_create` / `handoff_list` 结构化 shift
    - `artifact_create` / `artifact_list` 执行产物
    - 7 个新 test

## 测试与质量

最新状态：

```
824 pass | 0 fail | 1686 expect calls
oxlint: 0 warnings / 0 errors
typecheck: clean (packages/web/src/utils/time.test.ts 的 pre-existing `bun:test` 错误除外)
```

## 设计决策记录

- **Lead vs Worker 不分两套上下文机制**。统一用 Agent lifecycle hooks，lead / worker 差别只在 hook 实现、instructions、tool surface。hooks + thresholds 配置化，可 per-instance 绑定。
- **Context usage 归 runtime 管**。每个 loop 内部跟踪 token 使用，以新的 `usage` LoopEvent 向上透传。claude-code / codex / ai-sdk 已接入，cursor 不伪造。
- **`PressureAction` 首版只有 `continue / end`**。`compact` 预留，需要加时 switch 里的 `never` 守卫会强制处理。
- **`Attempt` 是 workspace state 对象而非第二个 runtime kernel 类**。运行时仍只有一个 Agent，构造时绑定 `(task, attempt)` 上下文。多个并发 Attempt 允许；lead 按约定是 workspace 级单例。
- **`TaskDraft` 不是独立对象**。`Task.status` 自带 `draft`，由 lead 通过 `task_update` 显式确认。
- **Role inference 极简**：explicit `agent.role` → `workspace.lead === name ? "lead" : "worker"`。observer 必须显式写。

## 仍然未做（优先级从高到低）

1. **Lead 自动决策 → 派生 Attempt 的 orchestration glue**。当前只给了 MCP 工具，由 agent 自己调。下一阶段应该让 lead 看到 draft → 判断 → 直接由 framework 开 worker Attempt 并启动对应的 worker agent run。这是 `managed-workspace` / `workspace-registry` 的改动。
2. **Lead rolling context**。把 task ledger / attempt stream / handoff stream 注入到 lead 的 prompt 里，用 hook 的 `onCheckpoint` 或 context engine 的 delta assembler 做。
3. **Profile resolver**。根据 role 装配 hooks / instructions / tool surface。当前实际没有 resolver — role 已经 resolve 出来了，但 downstream 没有消费。
4. **File-backed state store**。现在是 `InMemoryWorkspaceStateStore`。daemon 重启即丢失。需要 JSONL backing 或 sqlite。
5. **Integration test 跑通 "user → kickoff → draft task → lead open → worker attempt → handoff → task completed" 全流程**。
6. **Cursor usage estimator**（低优先级，先看 cursor 是否还需要保留）。
7. **Context window 自动发现**（runtime 报告 vs config 声明的 fallback 顺序）。

## 恢复建议

下次恢复时：

1. `git log --oneline -20` 看本 session 提交链
2. `bun run test` 确认当前绿
3. 从"Lead 自动决策 → 派生 Attempt"开始，这是把现有 MCP 表面推成真正 orchestration 的关键
4. 这个改动会动 `packages/agent-worker/src/managed-workspace.ts` 的 task polling + `packages/workspace/src/workspace.ts` 的 lead wiring。建议在开始前先用一个 sub-agent 跑一次 feature-dev:code-explorer 把现有的 agent 启动 / channel routing / kickoff 链路摸清楚。
