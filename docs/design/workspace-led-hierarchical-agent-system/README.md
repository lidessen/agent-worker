# Workspace-Led Hierarchical Agent 系统设计

日期：2026-04-12

状态：主设计入口

## 目标

这套设计回答一个问题：

- 如何把 `agent-worker` 从“多 agent 编排层”推进成一个可承接日常开发工作的、workspace-first 的长期工作系统

目标不是重做新的 coding runtime，而是建立一个更强的：

- workspace 状态层
- 角色装配层
- 长期连续性层
- 多 agent 协作与恢复层

## 文档结构

这组设计文档按“总分”组织：

- [README.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/README.md)
  总设计。说明目标、冻结原则、系统分层、主对象和整体边界。
- [interaction-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/interaction-model.md)
  交互模型。说明为什么从 `channel-first peer collaboration` 转向 `workspace-led hierarchical orchestration`，以及 `lead / worker / channel` 各自的角色。
- [state-and-context-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/state-and-context-model.md)
  状态与上下文模型。说明 `task / attempt / handoff / artifact`，以及 `worker task-session context` 和 `lead workspace-rolling context`。
- [profiles-and-policies.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/profiles-and-policies.md)
  装配与策略模型。说明 `runtime / role / assignment` 分层，内部 `policy handle` 边界，以及 `profile resolver` 的职责。

## 核心结论

### 1. 总体方向成立

`agent-worker` 继续向“日常主力工作台”推进是合理的。项目的未来优势不在于重造更强的 `loop`，而在于：

- workspace-first orchestration
- 长期状态持有
- 多 agent 协作
- 恢复与交接
- 统一控制面

### 2. 关键架构转向

当前系统默认更接近：

- `channel-first peer collaboration`

后续应逐步转向：

- `workspace-led hierarchical orchestration`

也就是：

- `lead` 持有长期调度视角
- 静态 `agents:` 定义的是预设成员/worker-capable pool
- 真正的 `worker` 主要承担 task/session 级执行
- `channel` 降级为公共可见面与辅助协作面
- `task / attempt / handoff / artifact` 升级为 workspace 一等对象

### 3. 三个核心结构问题

距离“可日用主力工具”还差的主要不是 UI 或模型能力，而是：

1. `执行隔离`
2. `会话连续性`
3. `控制边界`

## 冻结原则

### 1. workspace-first，不退回 session-first

- 长期连续性主要落在 workspace 层
- provider session continuity 只作为附加优化
- 不把系统重新压回 transcript/session-first

### 2. 继续复用成熟 runtime

- `claude-code / codex / cursor / ai-sdk` 继续作为底层执行 runtime
- `agent-worker` 不重做自己的主 coding runtime

### 3. runtime 与 role 严格解耦

- runtime 只表达执行能力
- `lead / worker` 不是 runtime 类型
- 任何 runtime 理论上都可以成为 lead 或 worker

### 4. 异步迭代器边界保持不变

- `loop.run()` 继续是 `AsyncIterable + result Promise`
- `agent / run coordinator` 继续是长期状态机
- `orchestrator` 继续是调度器

### 5. `channel` 不是任务真相

- `channel` 记录“说了什么”
- `task / attempt / handoff / artifact` 记录“系统真正发生了什么”

## 系统分层

### Runtime Layer

负责单次执行：

- `ai-sdk`
- `claude-code`
- `codex`
- `cursor`
- `mock`

以及：

- `cwd`
- `allowedPaths`
- `env`
- `runner`

### Agent Core Layer

负责通用 agent 生命周期与执行壳：

- inbox
- todo
- notes
- memory
- reminders
- loop wiring
- run coordinator
- structured event emission

### Workspace State Layer

负责长期事实状态：

- task
- attempt
- handoff
- artifact
- agent status
- documents
- chronicle
- resources

### Profile / Policy Layer

负责角色行为与上下文策略：

- role-driven prompt assembly
- role-driven tool surface
- role-driven skill loading
- context/session/history policies

注意：

- 这一层是内部装配层
- 不意味着这些细粒度能力要原样暴露到用户配置层
- 对外配置面仍应保持粗粒度
- 更接近当前配置心智：
  - 默认 agent 都按 worker 处理
  - 只额外标记哪一个 agent 是 lead

### Orchestration Layer

负责：

- task intake
- lead 调度
- worker attempt 生命周期
- task state 推进
- handoff 消费
- artifact 汇总

注意：

- 默认由 `lead` 承担 canonical task intake ownership
- 后续即使有 intake helper，也应先产出 `TaskDraft`，再由 lead 接收/落盘为 canonical `Task`

## 当前代码映射

后续最值得映射和调整的代码点：

- [packages/agent/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/types.ts)
- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
- [packages/agent/src/context-engine.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/context-engine.ts)
- [packages/agent/src/run-coordinator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/run-coordinator.ts)
- [packages/agent-worker/src/managed-agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/managed-agent.ts)
- [packages/agent-worker/src/loop-factory.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/loop-factory.ts)
- [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)
- [packages/workspace/src/context/mcp/prompts.tsx](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/mcp/prompts.tsx)
- [packages/workspace/src/context/mcp/server.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/mcp/server.ts)

## 非目标

- 不重做新的 coding runtime
- 不把 `lead / worker` 写死成 runtime 类型
- 不把 `channel` 继续当作任务真相层
- 不把 lead 的长期连续性继续压回 transcript compact
- 不把控制边界简化成几个静态字符串模式就算完成
