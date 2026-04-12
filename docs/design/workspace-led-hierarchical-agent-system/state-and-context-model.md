# 状态与上下文模型

日期：2026-04-12

## 目标

说明两件事：

1. workspace 的一等对象应该是什么
2. `worker` 和 `lead` 的上下文为什么必须分化

## Workspace 一等对象

建议把 workspace 的最小对象图定成：

```text
Workspace
  ├─ AgentSpec(s)
  ├─ Task
  │   ├─ Attempt(s)
  │   ├─ Handoff(s)
  │   └─ Artifact(s)
  └─ Channel(s)
```

这里需要明确区分两层：

- `AgentSpec`
  - 配置中的静态成员定义
  - 例如 `codex`、`kimi-code`、`minimax`
- `Attempt`
  - 从某个 `AgentSpec` 派生出来的一次运行时 task/session 实例

所以：

- 静态 `agents:` 不是“worker 实例列表”
- 更接近“预设定义 / worker-capable pool”

## AgentSpec

`AgentSpec` 是配置中的静态成员定义。

它表达的是：

- runtime
- model
- instructions
- channels
- mounts
- env

以及它作为长期成员的默认能力边界。

对当前系统来说：

- `lead` 是某个特殊的 `AgentSpec`
- 其余成员默认是 worker-capable `AgentSpec`
- `bot` 一类则可能是 observer/automation `AgentSpec`

## Task

`Task` 是执行单位，也是 orchestration 的主事实对象。

建议最小字段：

- `id`
- `workspaceId`
- `title`
- `goal`
- `status`
- `priority`
- `ownerLeadId?`
- `activeAttemptId?`
- `sourceRefs[]`
- `acceptanceCriteria?`
- `artifactRefs[]`
- `createdAt`
- `updatedAt`

## Attempt

`Attempt` 是一次 worker session，也是执行层对象。

建议最小字段：

- `id`
- `taskId`
- `agentName`
- `role`
- `status`
- `startedAt`
- `endedAt?`
- `inputHandoffId?`
- `outputHandoffId?`
- `resultSummary?`

可附加 runtime/session 线索：

- `runtimeType`
- `sessionId/threadId`
- `cwd`
- `worktreePath`
- `pid`
- `promptProfileId`
- `toolProfileId`
- `skillProfileIds`
- `modelRef`
- `lastHeartbeatAt`

一个关键点：

- `Attempt` 才是真正的 task-scoped worker instance
- 它不等于 `agents:` 里的静态配置成员

## Handoff

`Handoff` 是结构化交接，不是自由摘要。

建议最小字段：

- `id`
- `taskId`
- `fromAttemptId`
- `toAttemptId?`
- `createdAt`
- `createdBy`
- `kind`
- `summary`
- `completed[]`
- `pending[]`
- `blockers[]`
- `decisions[]`
- `nextSteps[]`
- `artifactRefs[]`
- `touchedPaths?`
- `runtimeRefs?`

推荐 `kind`：

- `progress`
- `blocked`
- `completed`
- `aborted`

## Artifact

`Artifact` 是执行产出引用，不等于消息内容。

建议最小字段：

- `id`
- `taskId`
- `kind`
- `title`
- `ref`
- `createdByAttemptId`
- `createdAt`
- `checksum?`
- `version?`

## Channel

`channel` 的定义应收敛为：

- 公共可见消息总线
- 广播通知面
- 辅助协作面
- 人工观察面

它可以引用：

- `task`
- `attempt`
- `handoff`
- `artifact`

但不应承载这些对象的 canonical state。

## Worker Context: task-session context

worker 的上下文应接近 `Claude Code / Codex` 的工作模式。

最小组成：

1. `task brief`
2. `lead directive`
3. `workspace snapshot / input handoff`
4. `local execution context`
5. `session transcript`
6. `completion criteria`
7. `shift handoff`

管理原则：

- 保证 task 局部完整性
- 不要求完整 workspace 历史都进 prompt
- session 结束前必须有结构化交接
- 恢复入口优先是 `handoff + task state`

## Lead Context: workspace-rolling context

lead 的上下文不是长 transcript，而是长期滚动状态视图。

最小组成：

1. `current workspace state`
2. `task ledger`
3. `attempt / handoff stream`
4. `artifact index`
5. `agent roster / status`
6. `rolling summaries`
7. `staleness eviction policy`

管理原则：

- 主上下文来自结构化 workspace state
- 原始 event stream 只作补充
- 不依赖“达到瓶颈后 compact”
- 主动进行滚动与淘汰

## 为什么不能共用一套上下文机制

因为两者的连续性来源不同：

- worker 依赖局部 session 的线性完整性
- lead 依赖全局状态的可滚动性与可控性

前者怕过度压缩，后者怕 transcript 膨胀。  
因此，不应再要求一套默认上下文机制同时覆盖两者。

## Lead Rolling Context 的窗口模型

lead 上下文建议分成四层：

### Hot Set

一定进入 prompt：

- 活跃 tasks
- 活跃 attempts
- 当前 blockers
- pending decisions
- 最近高价值 handoff

### Warm Set

短期仍 relevant，但不一定每次都注入：

- 最近完成的 tasks
- 最近失败/中止的 attempts
- 最近更新的 artifacts
- 最近 lead decisions

### Cold Summaries

更早历史的结构化 rollup：

- 阶段性 task summary
- workspace progress summary
- 长期仍 relevant 的 architecture decisions

### Deep References

默认不注入，只在需要时展开：

- 原始 transcript
- 原始 timeline events
- 完整 chronicle
- 详细 artifacts
- channel history

原则：

- 不是删历史
- 而是改变历史的主表示形式
