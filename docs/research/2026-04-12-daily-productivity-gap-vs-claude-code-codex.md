# Agent Worker 距离替代 Claude Code / Codex 的生产力差距

日期：2026-04-12  
范围：`agent-worker` 当前实现、实际本机运行状态、`Claude Code / Codex` 作为日常主力工具的关键能力

## 结论摘要

如果目标是：

- 把 `agent-worker` 当成一个多 agent 编排壳，底层继续调用 `claude-code / codex / cursor / ai-sdk`

那么当前已经接近可日用，判断约为 **80-85%**。

如果目标是：

- 直接把 `agent-worker` 替代为“日常主力 coding runtime”，承接原本由 `Claude Code / Codex` 承担的个人开发工作流

那么当前大概只有 **60-65%**。

核心差距不在 Web UI、daemon、workspace messaging，也不在“能不能发起编码任务”。  
真正的差距集中在三件事：

1. `执行隔离` 还不够硬
2. `会话连续性` 还不够稳
3. `控制边界` 还不够适合作为日常主力工具

## 一、当前已经具备的能力

### 1. `7420` 工作台主链已经成立

当前 daemon 已同时承担：

- HTTP API
- Web UI 静态托管
- workspace lifecycle
- agent registry
- 事件流与恢复

见：

- [packages/agent-worker/src/daemon.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/daemon.ts)
- [packages/web/src/api/client.ts](/Users/lidessen/workspaces/agent-worker/packages/web/src/api/client.ts)
- [packages/web/src/app.tsx](/Users/lidessen/workspaces/agent-worker/packages/web/src/app.tsx)

本机实测状态：

- daemon 已在 `http://127.0.0.1:7420/` 正常运行
- `/health` 可返回 `ai-sdk / claude-code / codex / cursor` 运行时状态
- `/` 可正常返回 semajsx 构建后的前端页面
- 当前已有 global workspace 和开发 workspace 在运行

### 2. 编排与协作层已经比单独 CLI agent 更强

当前系统的强项已经不是单次聊天，而是长期协作：

- `workspace` 提供 channels / inbox / docs / chronicle / resources / sandboxes
- `orchestrator` 负责轮询、pause/resume、错误分类与自动暂停
- `workspace registry` 负责恢复、manifest、global workspace、自定义 YAML workspace

见：

- [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)
- [packages/agent-worker/src/orchestrator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/orchestrator.ts)
- [packages/agent-worker/src/workspace-registry.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/workspace-registry.ts)

### 3. 底层 loop 复用路线是对的

当前项目没有重复发明一个新的 coding runtime，而是在复用成熟 runtime：

- `ClaudeCodeLoop`
- `CodexLoop`
- `CursorLoop`
- `AiSdkLoop`

见：

- [packages/loop/src/loops/claude-code.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/claude-code.ts)
- [packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)
- [packages/loop/src/loops/cursor.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/cursor.ts)
- [packages/loop/src/loops/ai-sdk.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/ai-sdk.ts)

这意味着项目真正需要补强的不是模型能力，而是 harness。

## 二、为什么它还不能完全替代日常主力 Claude Code / Codex

### 1. 执行隔离还不够硬

这是目前最大的结构性问题。

当前 `runner` 抽象已经存在，但真正可用的只有 host runner：

- `HostRunner` 直接在宿主机上执行命令
- `SandboxRunner` 仍是未来占位实现

见 [packages/agent-worker/src/runner.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/runner.ts)。

这带来的直接后果：

- 多 agent 同时改同一个 repo 时，隔离主要靠目录约定
- 缺少真正强约束的独立执行边界
- 一旦 agent 指令失控，影响面直接落到宿主 repo

当前系统已经有：

- `workspace sandbox`
- `agent sandbox`
- `allowedPaths`
- `mounts`

见：

- [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)
- [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)
- [packages/loop/src/sandbox/host.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/sandbox/host.ts)

但这仍然不是“独立代码工作区”。

对替代 `Claude Code / Codex` 来说，缺的不是抽象名称，而是：

- 每 agent 独立 worktree
- 每 agent 独立 branch
- 默认在自己的 worktree 内写代码
- shared sandbox 只用于协作文档和中间产物

在这些没做完之前，`agent-worker` 更适合“协调多个现有 runtime”，不适合“放任多个 coder agent 长时间并行改同一个仓库”。

### 2. 会话连续性还不够稳

如果把 `Claude Code / Codex` 当主力工具，最重要的一点不是“这次能不能写出 patch”，而是：

- 昨天做到哪里
- 中断后怎么继续
- daemon 重启后是否还能接上
- 下一次 run 是否还知道先前的意图和现场

当前 `agent-worker` 已经有：

- `history`
- `todos`
- `notes`
- `memory`
- `reminders`

见：

- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
- [packages/agent/src/run-coordinator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/run-coordinator.ts)
- [packages/agent/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/types.ts)

但默认状态仍然偏“短工作循环”而不是“长期主线程”：

- `notesStorage` 默认是 `InMemoryNotesStorage`
- `memory` 是可选项，不默认启用
- `history` 是运行时累积，不是跨 daemon 的一等恢复对象
- `CodexLoop` 虽然有 `threadId` / `setThreadId()` 能力，但没有形成 daemon 级默认持久化链路

见：

- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
- [packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)
- [packages/agent-worker/src/managed-agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/managed-agent.ts)

结果就是：

- 它能恢复 workspace 和事件流
- 但还不能稳定恢复成“我昨天和这个 agent 持续做了一整天代码”的那种主线程体验

这正是 `Claude Code / Codex` 在日常使用中给人安全感的来源之一。

### 3. 控制边界还偏自动化，不像日常主力工具

当前默认策略更偏“全自动批量执行”：

- `ClaudeCodeLoop` 在 loop-factory 中默认 `permissionMode: "bypassPermissions"`
- `CodexLoop` 在 loop-factory 中默认 `fullAuto: true`

见 [packages/agent-worker/src/loop-factory.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/loop-factory.ts)。

这种策略适合：

- 评测
- 后台批处理
- 委派式多 agent 执行

但不适合：

- 日常个人开发
- 高风险改动
- 需要“我先看一眼再让你动”的工作流

`Claude Code / Codex` 之所以更像主力工具，不只是因为模型或 CLI，而是因为用户对这些边界更有把握：

- 什么时候自动写
- 什么时候先计划
- 什么时候先确认
- 哪些动作默认高风险

`agent-worker` 现在在这方面还没有做成一等模式切换。

## 三、从“编排层”到“主力工具”的最小改造路线

只建议做三件事，不要同时扩更多功能。

### 1. 把 worktree/branch 隔离做成默认能力

目标：

- 每个 coder agent 默认拥有自己的 git worktree
- 每个 coder agent 默认拥有自己的 branch
- `cwd` 指向 worktree，而不是共享 repo 根目录
- `allowedPaths` 只开放当前 worktree 与 shared sandbox

这样做的收益：

- 多 agent 并行改代码时冲突面显著降低
- 每个 agent 的变更边界更清晰
- review / merge 可以成为单独的工作流阶段

建议改动入口：

- [packages/agent-worker/src/runner.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/runner.ts)
- [packages/agent-worker/src/workspace-registry.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/workspace-registry.ts)
- [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)

### 2. 把长期 agent 状态默认持久化

目标：

- 长期 workspace agent 默认用 `FileNotesStorage`
- 长期 workspace agent 默认启用 `FileMemoryStorage`
- 支持持久化 `CodexLoop.threadId`
- 恢复时自动重建：
  - notes
  - memory
  - thread/session 线索
  - 当前任务摘要

这样做的收益：

- daemon 重启不再等于“主线程重置”
- agent 可以真正承担长期 repo 维护角色
- 更接近 `Claude Code / Codex` 那种持续 session 体验

建议改动入口：

- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
- [packages/agent/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/types.ts)
- [packages/agent-worker/src/managed-agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/managed-agent.ts)
- [packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)

### 3. 引入面向日用的控制模式

建议至少定义三档：

- `assist`
- `delegate`
- `auto`

语义建议：

- `assist`
  - 默认给日常个人开发
  - 先计划，写入前收紧审批
  - 高风险命令和大范围改动不默认自动执行

- `delegate`
  - 默认给多 agent coder
  - 可以自动修改代码
  - 但不自动 merge，不接管全仓库

- `auto`
  - 只用于评测、批处理、低风险重复任务

这样做的收益：

- agent-worker 会更像“主力工具”，而不是“自动化后端”
- 用户对下一步行为更可预测
- 运行时之间的默认策略更统一

建议改动入口：

- [packages/agent-worker/src/loop-factory.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/loop-factory.ts)
- [packages/loop/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/types.ts)
- [packages/web/src/views/workspace-settings-view.tsx](/Users/lidessen/workspaces/agent-worker/packages/web/src/views/workspace-settings-view.tsx)

## 四、判断标准

如果上述三件事都没有做，`agent-worker` 更适合：

- 团队式 agent orchestration
- 多 runtime 协作
- 后台持续运行
- 调研 / 拆任务 / 分派 / review 流程

而不适合：

- 完全取代 `Claude Code / Codex` 作为单兵主力 coding 工具

如果三件事都做完，判断会变成：

- 对“多 agent 协作式开发”，它将明显优于单纯的 `Claude Code / Codex`
- 对“个人主线程开发”，它会开始接近可完全替代

## 五、最终判断

当前项目已经证明了：

- `workspace-first` 路线可行
- `7420` Web 工作台可行
- 用 daemon + workspace + loop 组合成熟 runtime 可行

但要把这种“可行”推进成“我愿意每天都靠它写代码”，还需要把以下三件事从约定升级为产品默认：

1. `worktree/branch` 级隔离
2. `notes/memory/thread` 级连续性
3. `assist/delegate/auto` 级控制边界

在这之前，最合理的定位仍然是：

- `agent-worker` 是一个很强的编排层和多 agent 工作台
- `Claude Code / Codex` 仍然是更成熟的单兵主力 runtime
