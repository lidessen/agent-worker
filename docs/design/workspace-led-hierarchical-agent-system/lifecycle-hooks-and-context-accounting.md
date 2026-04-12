# Agent Lifecycle Hooks 与 Runtime Context Accounting

日期：2026-04-13
状态：已冻结主方向，开始分阶段实现

## 核心方向

之前的设计把 lead 与 worker 的上下文策略分成两套独立机制（`workspace-rolling` vs `task-session`）。这个方向被纠正为：**统一在 agent 抽象上提供生命周期 hook，lead / worker 差别降级为同一接口的不同实现策略**。

两个核心 hook：

1. `onCheckpoint` — 周期性或事件驱动地向运行中的 session 追加新输入（事件、指令、事实）
2. `onContextPressure` — runtime 报告 context 即将耗尽时触发，由 hook 决定是继续、压缩重启，还是结束并产出 handoff

**Context usage 必须由 runtime 层负责计量**，不由 orchestrator 按 token 阈值瞎猜。claude-code / codex / cursor / ai-sdk 各自口径不同，必须下沉到 loop 实现内部。

## Tension: ContextEngine

`packages/agent/src/context-engine.ts` 已经负责 per-run 启动期的 prompt assembly。Hook 模型不与之冲突，但有重叠：

- `ContextEngine.assemble()` 保持 per-run 启动期装配职责
- Hook 使用（未来的）`ContextEngine.assembleDelta()` 计算"自上次 checkpoint 以来新增了什么"，避免重复注入 dashboard 导致上下文爆炸
- `RunCoordinator` 已经有 `scheduleCheckpoint / queueCheckpoint`（run-coordinator.ts:142–161）— `onCheckpoint` hook 直接挂在这个机制上

## 1. LoopEvent + LoopCapability 形状

### 新事件变体（packages/loop/src/types.ts）

```ts
| {
    type: "usage";
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    /** 模型 context window 上限，如果 runtime 能报告 */
    contextWindow?: number;
    /** totalTokens / contextWindow，contextWindow 已知时填入 */
    usedRatio?: number;
    /** 来源 */
    source: "runtime" | "estimate";
  }
```

### Capability

`LoopCapability` union 增加 `"usageStream"`（packages/agent/src/types.ts:16）。

- 有这个 capability 的 loop 保证会流式 emit `usage` 事件
- 没有的 loop 只在最终 `LoopResult` 中给 usage
- 不强制所有 runtime 支持 — cursor 暂时不实现

### Context window 发现顺序

1. Runtime 报告优先（claude-code SDK `model_info`、codex app-server、ai-sdk provider metadata）
2. 没有时 fallback 到 `AgentConfig.contextWindow` 配置
3. 都没有则事件不带 `contextWindow` / `usedRatio`，agent 只能用绝对 token 数 + 启发式阈值

### 累积 vs 增量

`usage` 事件携带**累积**数据，不是增量。codex 的 `thread/tokenUsage/updated`（codex.ts:257）已经是累积覆盖语义 — 这作为契约。

### Cursor

不伪造。cursor loop 没有原生 usage 信号，也没有 transcript 表面。如果后面需要，加一个 post-hoc estimator（字符数 → token 估算）并 tag `source: "estimate"`，由 agent 层决定是否信任。第一阶段直接标记为 capability-absent。

## 2. Agent 生命周期 Hook API

### 类型（packages/agent/src/types.ts）

```ts
export interface AgentLifecycleHooks {
  onCheckpoint?(ctx: CheckpointContext): Promise<CheckpointAction | void>;
  onContextPressure?(ctx: PressureContext): Promise<PressureAction>;
}

interface CheckpointContext {
  reason: "periodic" | "event" | "usage_update" | "run_end";
  runNumber: number;
  elapsedMs: number;
  history: readonly Turn[];
  lastUsage?: TokenUsageWithRatio;
  loop: AgentLoop; // 支持 interrupt 时可用
}

type CheckpointAction =
  | { kind: "inject"; content: string } // 通过 loop.interrupt 追加
  | { kind: "noop" };

interface PressureContext {
  level: "soft" | "hard";
  usedRatio: number; // 0..1
  usage: TokenUsageWithRatio;
  history: readonly Turn[];
  runNumber: number;
  assembled: AssembledPrompt;
}

type PressureAction =
  | { kind: "continue" } // 忽略，继续运行
  | { kind: "compact"; handoff: HandoffSummary; restartWith: LoopInput } // 写 rollup，重启
  | { kind: "end"; handoff: HandoffSummary }; // 优雅停止并产出 handoff
```

### 阈值

默认 soft=0.70 / hard=0.90，由 `AgentConfig.contextThresholds` 覆盖。Agent 层（不是 hook）负责比较 usedRatio 与阈值，并以对应 level 调用 `onContextPressure`。

### 位置

`AgentConfig.hooks: AgentLifecycleHooks`（新字段）。**不要**和 `runtimeHooks`（Claude Code SDK 层 hook）混在一起 — 两者完全不同。

### 压力处理的代码位置

**pressure 处理必须在 `processLoop` 而不是 `executeRun`**：

- `compact` 需要能中止在飞的 `loop.run()`（`loop.cancel()`）并以压缩后的 system + prompt 重新 `loop.run(restartWith)`
- `executeRun` 是单次 loop.run 的包装，跨不了 run 边界
- 所以 pressure 监听 + 决策要在外层 processLoop / RunCoordinator 主循环

## 3. Lead vs Worker = Hook Bundles

**同一个 Agent 类、同一个 AgentConfig 形状、同一个 RunCoordinator 路径**。差异只在：

- 绑定的 hook 实现
- `instructions`
- `toolkit`（tool surface）

### Lead hooks (workspace-rolling strategy)

- `onCheckpoint`: 从 workspace state 拉 task-ledger deltas / 新 chronicle / 新 handoff，注入
- `onContextPressure`: 生成 Hot/Warm/Cold rollup（见 state-and-context-model.md 的窗口模型），restart
- session lifetime：长 — pressure 永远选 `compact`，不 `end`

### Worker hooks (task-session strategy)

- `onCheckpoint`: 极少注入，通常只接 lead 指令
- `onContextPressure`: 产出结构化 `Handoff`（kind=`progress` / `blocked`），返回 `end`
- session lifetime：task-scoped — pressure 选 `end`

### ResolvedAgent 增长

```ts
// ResolvedAgent 新增字段
lifecycleHooks: AgentLifecycleHooks;
role: "lead" | "worker";
contextThresholds: {
  soft: number;
  hard: number;
}
```

### Profile resolver

当前阶段极简：

- `agent.name === workspace.lead` → 走 `buildLeadHooks(workspaceState)`
- 其余 → 走 `buildWorkerHooks(task, attempt)`

两个 factory 在 assignment 时构造，close over 各自需要的上下文。

## 4. AgentSpec → Attempt 生命周期

**结论：`Attempt` 作为 workspace state 对象保留，但不作为第二套 runtime kernel 对象。Runtime 侧坍缩为"一个 Agent 实例绑定到一个 task"。**

### 分工

- `AgentSpec`：workspace config 中的静态定义，模板，不是实例
- `Attempt`：workspace state 中的持久化行（id, taskId, agentName, status, handoffRefs, 时间戳, runtime refs）— 让恢复、审计、回放、汇总成为可能
- Runtime side：一次 attempt 构造一个新的 `Agent` 实例，`AgentConfig.hooks` / `instructions` 由 profile resolver 针对 `(AgentSpec, Task, Attempt)` 元组解析后装入

### Hook state

Per-Attempt。两个来自同一 AgentSpec 的并发 attempts 得到两个独立 Agent 实例，两套独立 hook closures，无共享可变状态。

### 并发度

- AgentSpec 是模板，可以有多个并发 Attempt
- Lead 按约定 workspace 级单例（一个 workspace 一个 lead）

### Lead 不绑定 Task

Lead 是 "Agent bound to workspace"，没有 attempt。它的 hooks close over `workspaceState` 而不是 `(task, attempt)`。两条路径共用同一个 Agent 类。

## 5. 第一个 PR（最小增量）

**目标**：LoopEvent 扩展 + codex emit + 最小 consumer（仅暴露 lastUsage）。**暂不包含 hook API**。

### Rationale

- `usage` 事件本身是机械改动
- Hook API 还需要就 `PressureAction` 细节、processLoop 接入、ContextEngine 边界做更多协调
- 落地 `usage` 事件后，下游 hook 建设可以并行
- 以 codex 先行是因为它已经有原生的 `thread/tokenUsage/updated` mid-stream 事件，工作量最小

### 改动文件顺序

1. **`packages/loop/src/types.ts`**
   - 增加 `usage` 变体到 `LoopEvent` union
   - 可能增加 `TokenUsageWithRatio` helper type（或直接复用 TokenUsage）

2. **`packages/loop/src/loops/codex.ts`**
   - 在现有 `thread/tokenUsage/updated` 分支（codex.ts:257）里，setting `turn.usage` 后同时 emit `{ type: "usage", ...turn.usage, source: "runtime" }`
   - 确保 `supports` 声明 `"usageStream"`

3. **`packages/agent/src/types.ts`**
   - 将 `"usageStream"` 加入 `LoopCapability` union

4. **`packages/agent/src/run-coordinator.ts`**
   - 在事件 switch 中加 `case "usage":` 分支
   - 第一 PR 只做：记录 `lastUsage` 并通过 `onEvent` 向上透传
   - 不做任何 pressure 判断 / hook 调用

5. **`packages/agent-worker/src/managed-agent.ts`**
   - 暴露 `lastUsage` 作为可观察字段，让 CLI / dashboard 能实时显示

### 明确不在第一 PR 内

- claude-code / ai-sdk 的 usage 事件（后续 PR 跟进）
- Hook API 实现
- Context threshold 接线
- Profile resolver
- Cursor estimator
- `contextWindow` 自动发现

### Edge case 要在 doc comment 里记下

- codex 的 `turn.usage` 是 per-turn 覆盖（codex.ts:266），不是 per-run 累加
- 多轮 run 的消费者应取 last / max，不要 sum
- 这个语义需要在 `LoopEvent.usage` 的 doc comment 中明确

## 仍然未决

- `TaskDraft` 是否为一等对象、draft 状态机（`docs/handoffs` 中的未决点 3）
- Observer / automation role（例如 dogfood bot）的定位 — 当前最小角色集只覆盖 `lead / worker`，observer 是下一阶段要补的（未决点 2）
- Cursor usage estimation 的细节留到后续
- context window 自动发现与配置覆盖的具体实现顺序
