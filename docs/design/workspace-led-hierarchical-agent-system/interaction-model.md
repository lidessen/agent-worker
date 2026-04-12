# 交互模型

日期：2026-04-12

## 目标

说明为什么系统应从：

- `channel-first peer collaboration`

转向：

- `workspace-led hierarchical orchestration`

## 当前模型的问题

当前系统更接近：

- workspace 内多个平级 agent
- 通过 channel 消息、@mention、inbox 互相唤醒
- transcript 和 channel 长期占据较高地位

这种模型适合群聊式协作，但不适合长期工程系统。主要问题是：

- lead 会退化成“读聊天记录的人”
- worker 的任务边界容易模糊
- transcript 容易重新变成主干
- task 完成状态、交接和产出很难沉淀成结构化状态

## 新模型

### Lead

`lead` 是长期存在的 workspace 调度者。

职责：

- 感知 workspace 当前状态
- 维护 task ledger
- 派发/改派 attempts
- 消费 handoff
- 汇总 artifacts
- 做决策与收口

### Worker

`worker` 是 task/session 级执行者。

职责：

- 接收一个明确任务
- 在一个局部 session 中执行
- 产出结构化 handoff 与 artifacts
- 任务完成、阻塞或中止后退出或回交

默认应是 ephemeral session，而不是长期人格。

这里要补一个关键区分：

- `agents:` 里的静态定义，不等于运行时 `worker`
- 静态 `agents:` 更准确地说是预设成员定义、worker-capable templates 或 worker pool members
- 真正的 `worker` 是运行时从某个静态定义派生出来的 `attempt/session instance`

例如：

- `codex`
- `kimi-code`
- `minimax`

这些更像预设定义，不是一次任务的一次执行实例。

### Channel

`channel` 不是任务主干，而是：

- 公共可见消息总线
- 广播通知面
- 辅助协作面
- 人工观察面

它可以引用 `task / attempt / handoff / artifact`，但不承载它们的 canonical state。

## Worker 之间的交互

冻结规则：

- worker 之间不应默认私聊
- worker 可以直接和 lead 沟通
- worker 也可以在 channel 中与其他人形成可见协作记录

默认主路径应是：

- worker -> lead

而不是：

- worker -> worker direct messaging

## Task Intake

task intake 的 canonical owner 建议先保持单一：

- 默认由 `lead` 承担

也就是说：

- 用户消息
- Telegram 输入
- kickoff
- channel 中需要升级成工作项的输入

都应先由 lead 正规化成 canonical `Task`。

不建议第一版就单独引入 intake agent。

更合理的方向是：

- `task intake owner = lead`
- `task intake helper = skill / helper policy / future subroutine`

如果后面真的需要独立 intake 角色，也更适合作为：

- `TaskDraft` 生产者

而不是 canonical `Task` 的最终 owner。

## 为什么这样更接近 workspace-first

### 1. transcript 会自然降级

在 peer/channel 模型下，协作主要通过消息完成，transcript 很容易重新变成主线。

在 hierarchical 模型下：

- lead 主要面向 workspace state 工作
- worker transcript 只是某次 attempt 的执行痕迹

### 2. continuity 会更清晰

系统天然支持：

- `长 lead`
- `短 worker`

连续性的主要锚点会变成：

- workspace state
- task
- handoff
- artifact

### 3. worktree 隔离更容易成立

如果 worker 默认是 task/session 级别，那么：

- worker 接到任务
- 进入对应 code worktree
- 完成后回写 artifact/handoff
- 退出

这比“常驻平级 agent 在共享 repo 中通过消息协作”更适合隔离设计。

## 与当前实现的直接冲突点

当前更强的耦合发生在 workspace 层：

- `lead` 还是单个字符串字段，见 [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)
- workspace prompt 默认假设平级成员在 channels 里协作，见 [packages/workspace/src/context/mcp/prompts.tsx](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/mcp/prompts.tsx)
- workspace tools 默认把 `channel_* / my_inbox* / team_*` 暴露给所有 agent，见 [packages/workspace/src/context/mcp/server.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/mcp/server.ts)
- 消息路由默认是“频道广播 + @mention + lead fallback”，见 [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)

所以后续需要调整的重点不是 runtime，而是：

- role assembly
- prompt assembly
- tool surface profiling
- orchestration routing
- worker lifecycle contract
