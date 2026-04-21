# Agent Worker 日常生产力替代路线图

日期：2026-04-12

前置文档：

- [2026-04-12-daily-productivity-gap-vs-claude-code-codex.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-gap-vs-claude-code-codex.md)
- [2026-04-12-agent-loop-async-iterator-boundary.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-agent-loop-async-iterator-boundary.md)
- [2026-04-11-agent-loop-harness-review.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-11-agent-loop-harness-review.md)

## 目标

这份路线图只回答一个问题：

- 如何把 `agent-worker` 从“多 agent 编排层”推进成“可以承接日常主力开发工作”的系统

这里的“日常主力开发工作”特指原本更多由 `Claude Code / Codex` 承担的工作流：

- 在一个 repo 中连续数小时推进任务
- 中断后恢复现场
- 让多个 agent 并行处理代码而不互相踩踏
- 对高风险写操作保持足够可控

## 当前判断

当前项目已经具备：

- daemon + web workbench
- workspace-first 协作模型
- 多 runtime loop 复用
- channels / docs / chronicle / event log / sandboxes

但离“日常主力开发工具”还差一段，核心不在文档、UI、美化，而在三个结构问题：

1. `执行隔离`
2. `会话连续性`
3. `控制边界`

此外有一个架构原则必须固定：

- `loop.run()` 继续保持异步迭代器模型
- `agent / orchestrator` 保持状态机与调度器模型
- `lead` / `worker` 优先作为装配角色存在，而不是 runtime 类型

不要把“主力工具化”错误理解成“再重写一套 loop 抽象”。

## 总原则

### 1. 继续坚持 workspace-first

不要把连续性重新压回 transcript/session。

应该继续让长期状态落在：

- workspace
- worktree
- notes
- memory
- handoff / artifacts
- event log

而不是单纯依赖 provider session。

provider session continuity 如果存在价值，应只作为附加优化，而不是主连续性机制。

### 2. 继续复用成熟 runtime

不要试图自己重做一套 `Claude Code / Codex` 级别的底层 coding runtime。

`agent-worker` 的优势在于：

- 编排
- 状态持有
- 恢复
- 协作
- 统一控制面

不是在 `packages/loop` 里重新造一个更强的模型循环。

### 3. 边界清晰比抽象统一更重要

正确边界应保持为：

- `loop`：单次执行流
- `agent`：长期状态机
- `orchestrator`：任务调度
- `workspace`：长期协作状态
- `daemon/web`：控制面与可观测性

### 4. role-first 优先于 runtime-first

不要把 `lead` / `worker` 设计成 runtime 身份。

应优先保持：

- runtime 表达执行能力
- role 表达协作位置
- workspace/orchestration 负责把二者装配起来

这意味着：

- 任何 runtime 理论上都可以成为 lead 或 worker
- `lead` / `worker` 的差异主要体现在 prompt、tool surface、routing、lifecycle 上
- 不应把设计方向带向 `claude=lead / cursor=worker` 一类绑定

### 5. 从 channel-first 逐步转向 workspace-led orchestration

当前系统虽然是 workspace-first，但协作心智仍然偏 `peer agents in channels`。

后续路线应逐步推动到：

- lead 持有长期状态
- worker 承担短周期 session 级 execution
- transcript 退化为二级材料
- channel 更多承担公共可见面与辅助协作面
- `task / attempt / handoff / artifact` 逐步提升为 workspace 一等对象

这条方向不会立即覆盖全部行为，但它应成为后续 Phase 1/2 设计的上位约束。

## Phase 1：执行隔离

### 目标

让多个 coder agent 能并行改代码，而不会在同一工作树上互相污染。

### 需要达成的状态

- 每个 coder agent 默认拥有独立 `git worktree`
- 每个 coder agent 默认拥有独立 branch
- agent 的 `cwd` 指向自己的 worktree
- `sandbox` 继续被视为 workspace 内部概念
- code work 的 `worktree` 被视为 workspace 众多工作对象中的一种
- shared sandbox 默认只用于协作文档与中间产物
- `allowedPaths` 只允许：
  - 当前 agent worktree
  - workspace shared sandbox

### 核心改动

- 扩展 runner/execution 配置，支持 worktree 模式
- workspace 创建时自动 provision：
  - worktree path
  - branch name
  - git metadata
- agent prompt 中显式暴露：
  - current worktree
  - current branch
  - merge policy

### 主要文件

- [packages/agent-worker/src/runner.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/runner.ts)
- [packages/agent-worker/src/workspace-registry.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/workspace-registry.ts)
- [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)
- [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)

### 验收标准

- 同一 workspace 中两个 coder agent 可以同时修改同一个 repo 的不同部分
- 任何一个 agent 的默认 shell/file 操作都不会直接落在共享 repo 根目录
- lead/reviewer 能明确知道每个 agent 改的是哪条 branch、哪个 worktree

## Phase 2：会话连续性

### 目标

让长期 agent 真正具备“昨天做到哪里，今天还能接着干”的能力。

### 需要达成的状态

- 长期 agent 默认使用 `FileNotesStorage`
- 长期 agent 默认启用 `FileMemoryStorage`
- provider session continuity 只作为附加优化
- 例如 `CodexLoop.threadId` 可持久化并在恢复时重新注入
- agent 重启后能恢复：
  - notes
  - memory
  - 必要的 session/thread 线索
  - 当前任务摘要

### 核心改动

- ManagedAgent 增加 state metadata 文件
- 区分：
  - ephemeral agent
  - long-lived workspace agent
- long-lived agent 默认启用文件型 notes/memory
- 将 thread/session 恢复纳入 daemon/workspace restore 流程

### 主要文件

- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
- [packages/agent/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/types.ts)
- [packages/agent-worker/src/managed-agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/managed-agent.ts)
- [packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)

### 验收标准

- daemon 重启后，workspace agent 不会退化为“重新开始的陌生人”
- agent 可以继续引用之前的长期笔记和抽取记忆
- codex 作为底层 runtime 时，thread continuation 能被实际复用

## Phase 3：控制边界

### 目标

让 `agent-worker` 更像日常主力工具，而不是默认全自动后端。

### 需要达成的状态

系统内应存在清晰的控制边界。

当前先不冻结 mode 名称，先冻结控制目标：

- 哪些写操作可以自动执行
- 哪些高风险动作需要更强约束
- 哪些策略属于 workspace policy
- 哪些策略属于 skill / workflow 层

### 核心改动

- loop-factory 不再写死激进默认值
- permission policy、approval policy、git policy 统一抽到 agent/workspace 配置
- Web settings 页可见当前模式和关键策略
- `review / merge` 优先放在 skill / workflow 层，不在内核中硬编码完整流程

### 主要文件

- [packages/agent-worker/src/loop-factory.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/loop-factory.ts)
- [packages/loop/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/types.ts)
- [packages/web/src/views/workspace-settings-view.tsx](/Users/lidessen/workspaces/agent-worker/packages/web/src/views/workspace-settings-view.tsx)

### 验收标准

- 同一个 workspace 可以明确切换不同强度的控制策略
- 用户能预期 agent 是否会直接写代码、是否会自动执行高风险动作
- 默认策略适合长期使用，而不是只适合评测

## 架构约束：异步迭代器边界

这个点需要单独固定，避免后续路线跑偏。

### 要保持的部分

- `LoopRun` 继续保持：
  - `AsyncIterable<LoopEvent>`
  - `result: Promise<LoopResult>`

### 不要做的部分

- 不要把整个 `Agent` 主循环改写成 `async generator`
- 不要把 `orchestrator` 调度层也统一成事件流抽象

### 原因

- `loop` 是单次运行流
- `agent` 是长期状态机
- `orchestrator` 是调度器

统一成单一的“全异步流模型”只会让 pause/resume/interrupt/recovery 更难表达。

## 推荐实施顺序

1. Phase 1：执行隔离
2. Phase 2：会话连续性
3. Phase 3：控制边界

顺序不能反过来。

原因：

- 没有执行隔离，多 agent coding 风险太大
- 没有会话连续性，长期主力体验不成立
- 控制边界建立在前两者之上，不能只调默认参数来“伪装成主力工具”

## 里程碑判断

### M1：可放心并行编码

达成条件：

- worktree 隔离上线
- 多 coder agent 并行改 repo 不互相踩踏

### M2：可跨天连续工作

达成条件：

- notes/memory/thread continuation 真正恢复
- daemon 重启不打断长期 agent 主线

### M3：可作为默认主工作台

达成条件：

- assist/delegate/auto 模式跑通
- 高风险动作边界清晰
- 默认配置适合日常使用

## 最终判断

如果这三阶段落完，`agent-worker` 的定位会从：

- “多 agent 编排与工作台”

推进到：

- “可承接日常主力开发工作的 workspace-first harness”

而且这个方向不要求放弃现有的 `Claude Code / Codex / Cursor / AI SDK` 生态；相反，它的核心价值就是把这些成熟 runtime 放进一个更强的长期工作系统里。
