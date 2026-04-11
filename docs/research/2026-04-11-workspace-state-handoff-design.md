# Workspace State / Handoff / Event Taxonomy 设计稿

日期：2026-04-11  
前置文档：

- [workspace-first-design-principles.md](/Users/lidessen/workspaces/agent-worker/docs/workspace-first-design-principles.md)
- [2026-04-11-agent-loop-harness-review.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-11-agent-loop-harness-review.md)

## 目标

这份文档不是再讨论“模型该怎么 prompt”，而是回答三个更关键的问题：

1. `workspace` 里到底应该持久化什么状态。
2. `handoff` 应该长成什么样，才能让短生命周期 agent 顺利接班。
3. `event log` 应该如何分类，才能支持恢复、审计、检索和再规划。

核心目标：

- 把当前系统从“带 workspace 的 agent”继续推进到“以 workspace 为中心的长期工程系统”。
- 把 `Turn[] history` 从主干退为辅助材料。
- 让 agent 替换成为正常路径，而不是失败时的补救路径。

## 一、设计判断

当前项目最缺的不是更多 prompt 组装，而是更强的结构化工作状态。

如果没有显式 `workspace state model`，系统会自然退化成：

- 用消息历史代表任务状态
- 用对话摘要代表交接
- 用 event log 充当万能存储

这三件事短期能跑，长期会出问题：

- 状态不可验证
- 交接不可执行
- 检索粒度混乱

所以建议把 `workspace` 中的持久信息明确拆成四层：

1. `state`
2. `artifact`
3. `event`
4. `handoff`

其中：

- `state` 回答“现在处于什么阶段”
- `artifact` 回答“留下了什么东西”
- `event` 回答“发生过什么”
- `handoff` 回答“下一任该怎么接”

## 二、核心对象模型

### 1. Workspace

`workspace` 是最高层长期容器。

它应该拥有：

- identity
- configuration
- current state
- tasks
- artifacts
- event log
- handoffs
- tool environment metadata

建议最小结构：

```ts
interface WorkspaceRecord {
  id: string;
  name: string;
  tag?: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "paused" | "archived" | "failed";
  currentFocusId?: string;
  leadAgent?: string;
  sandbox?: {
    sharedDir?: string;
    agentDirs?: Record<string, string>;
  };
}
```

这里的重点不是字段多少，而是先明确：

- workspace 自己有状态
- workspace 不是 message bucket
- workspace 可以被暂停、恢复、归档

### 2. Work Item

建议引入一等 `work item`。

它不是简单 todo，而是工程推进的原子对象。

```ts
interface WorkItem {
  id: string;
  workspaceId: string;
  title: string;
  kind: "task" | "bug" | "research" | "review" | "migration" | "ops";
  status: "proposed" | "ready" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  owner?: string;
  parentId?: string;
  dependsOn?: string[];
  createdAt: string;
  updatedAt: string;
  goal?: string;
  doneDefinition?: string[];
  currentAttemptId?: string;
  latestHandoffId?: string;
}
```

`WorkItem` 和当前 `todo` 的差异在于：

- todo 是 agent working memory
- work item 是 workspace execution state

换句话说：

- todo 可以丢
- work item 不能丢

### 3. Attempt

一个工作项会经历多次尝试，每次尝试可能由不同 agent 完成。

```ts
interface WorkAttempt {
  id: string;
  workItemId: string;
  workspaceId: string;
  agentId?: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "succeeded" | "failed" | "aborted" | "handed_off";
  summary?: string;
  failureReason?: string;
  producedArtifactIds?: string[];
  emittedEventRange?: {
    fromEventId?: string;
    toEventId?: string;
  };
}
```

这个对象的作用是把“任务”与“某次执行”分开。

没有 `attempt`，系统就很难回答：

- 这个任务到底尝试过几次
- 哪次是谁做的
- 哪次失败了，为什么
- 最新工作痕迹应该从哪里继续

### 4. Artifact

`artifact` 是工作产物，而不是消息。

```ts
interface ArtifactRecord {
  id: string;
  workspaceId: string;
  workItemId?: string;
  attemptId?: string;
  kind:
    | "file"
    | "document"
    | "patch"
    | "report"
    | "plan"
    | "test_result"
    | "command_output"
    | "note"
    | "external_link";
  title: string;
  uri: string;
  mimeType?: string;
  createdAt: string;
  createdBy?: string;
  summary?: string;
}
```

建议坚持一个原则：

- 能抽成 artifact 的，不要只放在 transcript 里

典型例子：

- 调研报告
- 测试结果摘要
- 实际 patch
- handoff 文档
- 临时诊断报告

## 三、Handoff 协议

### 1. 为什么 handoff 必须单独建模

如果 handoff 只是 event log 的一部分，下一任 agent 需要自己从海量 event 里“猜”：

- 上一任做到了哪里
- 什么是真的结论
- 什么只是推测
- 现在最该继续什么

这会直接把上下文预算浪费在恢复现场，而不是推进工作。

所以 handoff 应该是显式对象，并且是 `attempt` 结束时的标准产物。

### 2. Handoff 最小结构

```ts
interface HandoffRecord {
  id: string;
  workspaceId: string;
  workItemId: string;
  fromAttemptId: string;
  fromAgentId?: string;
  createdAt: string;
  status: "open" | "accepted" | "stale" | "superseded";
  headline: string;
  whatChanged: string[];
  currentState: string;
  nextActions: string[];
  blockers?: string[];
  assumptions?: string[];
  artifactIds?: string[];
  relatedEventIds?: string[];
}
```

其中：

- `headline`：一句话说清当前局面
- `whatChanged`：只写实际变化
- `currentState`：现在处于什么工作状态
- `nextActions`：下一任应该直接做什么
- `blockers`：为什么停下

### 3. 好的 handoff 应该满足的约束

好的 handoff 不是“总结得漂亮”，而是“下一任可以立即开工”。

建议约束：

1. 必须引用具体 artifact 或 event，而不是只写抽象判断。
2. 必须包含可执行 next action，不能只写开放性思考。
3. 必须区分事实和推测。
4. 必须在 attempt 结束时生成，不允许完全依赖人工补写。

建议模板：

```md
Headline:
当前 PR review 已完成代码扫描，发现 3 个高风险点，尚未验证回归测试。

What Changed:
- 阅读了 X/Y/Z 文件
- 生成了风险清单
- 没有修改代码

Current State:
问题已定位到认证流程和 workspace inbox routing 的边界，但还未完成复现验证。

Next Actions:
1. 复现 issue A
2. 跑相关测试
3. 判断是 prompt 层问题还是 routing 层问题

Blockers:
- 缺少复现输入
- 当前测试夹具不完整
```

### 4. Handoff 的生命周期

建议 handoff 有明确生命周期：

- `open`：刚创建，等待后继消费
- `accepted`：后继 agent 已接管
- `stale`：上下文已变化，不再可信
- `superseded`：被更新的 handoff 替代

这样系统才能判断：

- 当前最新有效交接是哪一个
- 是否存在无人接管的工作

## 四、Event Taxonomy

### 1. 为什么要做 taxonomy

当前很多系统的问题不是没有 event log，而是 event log 太杂。

如果不分类，最终会出现：

- tool event 和 work event 混在一起
- “发了一条消息”和“完成了一个任务节点”权重一样
- 审计、恢复、搜索都很难做

建议按语义分六类。

### 2. 建议的事件分类

#### A. Workspace Lifecycle

描述 workspace 本身的状态变化。

```ts
type WorkspaceEvent =
  | "workspace.created"
  | "workspace.started"
  | "workspace.paused"
  | "workspace.resumed"
  | "workspace.archived"
  | "workspace.failed";
```

#### B. Work Item State

描述任务状态变化。

```ts
type WorkItemEvent =
  | "work_item.created"
  | "work_item.ready"
  | "work_item.started"
  | "work_item.blocked"
  | "work_item.unblocked"
  | "work_item.completed"
  | "work_item.cancelled";
```

#### C. Attempt Execution

描述某次 agent 执行。

```ts
type AttemptEvent =
  | "attempt.started"
  | "attempt.progress"
  | "attempt.failed"
  | "attempt.succeeded"
  | "attempt.aborted"
  | "attempt.handed_off";
```

#### D. Artifact Change

描述产物变化。

```ts
type ArtifactEvent =
  | "artifact.created"
  | "artifact.updated"
  | "artifact.attached"
  | "artifact.superseded";
```

#### E. Tool Runtime

描述底层运行时事实。

```ts
type ToolRuntimeEvent =
  | "tool.started"
  | "tool.finished"
  | "tool.failed"
  | "command.started"
  | "command.finished"
  | "command.failed";
```

#### F. Communication

描述协作和消息，不直接代表工作推进。

```ts
type CommunicationEvent =
  | "message.sent"
  | "message.received"
  | "inbox.enqueued"
  | "inbox.acked"
  | "handoff.created"
  | "handoff.accepted";
```

### 3. 统一事件结构

建议所有事件共享同一外壳：

```ts
interface WorkspaceLogEvent {
  id: string;
  workspaceId: string;
  ts: string;
  type: string;
  actor?: {
    kind: "agent" | "user" | "system" | "tool";
    id?: string;
  };
  refs?: {
    workItemId?: string;
    attemptId?: string;
    artifactId?: string;
    handoffId?: string;
  };
  data?: Record<string, unknown>;
}
```

这个壳子的关键是：

- 事件类型统一
- 引用关系统一
- 可以按 `workItem / attempt / artifact` 回溯

### 4. Chronicle 与 Event Log 的边界

建议做清晰分工：

- `event log`：结构化、机器可读、适合驱动恢复和状态机
- `chronicle`：人类可读、适合浏览和叙事总结

也就是说：

- 所有重要状态变化必须先写 event
- chronicle 可以由 event 派生，也可以补充叙事摘要

不要反过来依赖 chronicle 作为主事实源。

## 五、Agent / Harness / Workspace 职责重分配

### 1. Workspace

负责长期连续性：

- work item state
- artifact registry
- event log
- handoff registry
- persistent memory layers

### 2. Harness

负责一次上岗和离岗：

- 选择 work item
- 选择要装载的 context slice
- 启动 attempt
- 记录 event
- 生成 handoff
- 更新 work item status

### 3. Agent

负责局部执行：

- 理解当前目标
- 调用工具
- 产出 artifact
- 回报 progress / result / blockers

这里的关键转变是：

- agent 不再拥有工作真相
- workspace 才拥有工作真相

## 六、对当前代码的具体迁移建议

### 1. 先加对象，不先重写 loop

不建议一上来重写 `RunCoordinator`。

建议先引入三个新的持久对象：

1. `WorkItem`
2. `WorkAttempt`
3. `HandoffRecord`

在不破坏现有 loop 的情况下，先让 orchestrator 和 workspace 能记录这三类对象。

### 2. 让 orchestrator 显式创建 attempt

当前 [packages/agent-worker/src/orchestrator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/orchestrator.ts) 已经有明确的“开始一次处理”的时机。

建议改成：

- dequeue instruction
- resolve target work item
- create attempt
- assemble prompt from work state + handoff + recent events
- run agent
- close attempt
- emit handoff if unfinished

### 3. 让 ContextEngine 优先读 state，不优先读 history

当前 [packages/agent/src/context-engine.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/context-engine.ts) 的主要输入还是：

- inbox
- todos
- notes
- reminders
- history

建议逐步改成：

- active work item
- latest handoff
- recent work events
- relevant artifacts
- agent-local working memory

`history` 保留，但降为补充材料。

### 4. 保留 todo，但把 todo 明确降级

`todo` 仍然有价值，但它应当被定义为：

- agent-local scratchpad

而不是：

- workspace execution state

建议原则：

- `todo` 可丢失
- `work item state` 不可丢失

### 5. 先用最小事件集落地

不用一开始把 taxonomy 做满。

第一阶段只要先保证这几类事件存在：

- `work_item.started`
- `attempt.started`
- `attempt.succeeded`
- `attempt.failed`
- `artifact.created`
- `handoff.created`

只要这六类落下去，系统就已经比现在更像长期工程系统。

## 七、建议的分阶段路线

### Phase 1

引入基础对象和最小事件。

- 新增 `WorkItem`
- 新增 `WorkAttempt`
- 新增 `HandoffRecord`
- orchestrator 创建/结束 attempt

### Phase 2

让 prompt 装载逻辑从 history-first 转向 state-first。

- context engine 先读 work item / handoff / artifacts
- history 退居辅助

### Phase 3

把 chronicle 变成 event 的人类视图，而不是主事实层。

- chronicle 自动摘要化
- event 用于恢复、过滤、检索、审计

### Phase 4

引入更强的 workspace-level planning。

- dependency edges
- blocked/unblocked transitions
- multi-agent work claiming
- handoff acceptance

## 八、最终判断

下一步最值得做的事情，不是再优化“agent 怎么想”，而是把“工作是怎么连续下去的”正式建模。

只要 `workspace state + handoff + event taxonomy` 立起来：

- 短生命周期 agent 才真正成立
- 外部 loop 才能真正可替换
- 工作区才会从“聊天外壳”变成“长期工程主系统”

这也是当前项目相对于 Claude Code 和 Hermes 最有机会做出本质差异的地方。
