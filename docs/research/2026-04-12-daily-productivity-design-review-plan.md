# Agent Worker 日常生产力设计评审计划

日期：2026-04-12

关联文档：

- [2026-04-12-daily-productivity-gap-vs-claude-code-codex.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-gap-vs-claude-code-codex.md)
- [2026-04-12-agent-loop-async-iterator-boundary.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-agent-loop-async-iterator-boundary.md)
- [2026-04-12-daily-productivity-roadmap.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-roadmap.md)
- [2026-04-11-agent-loop-harness-review.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-11-agent-loop-harness-review.md)
- [2026-04-11-workspace-state-handoff-design.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-11-workspace-state-handoff-design.md)

## 目标

这次评审不是为了立刻开工，而是先确认这条路线值不值得做、边界是否正确、有没有明显的设计误判。

这轮评审只回答三个问题：

1. 这条“把 `agent-worker` 推向日常主力工作台”的方向是否成立。
2. 当前提出的三阶段路线是否抓住了真正的瓶颈。
3. 哪些设计判断可以先冻结，哪些还需要继续调研。

## 评审范围

这次只评审以下主题：

- `Phase 1` 执行隔离
- `Phase 2` 会话连续性
- `Phase 3` 控制边界
- `loop / agent / orchestrator` 的边界

不在这轮评审范围内的内容：

- Web UI 细节
- 文档体验
- 命名润色
- 具体实现排期
- 细粒度 API 形态

## 当前主张

当前路线图的核心主张是：

1. `agent-worker` 的未来价值不在于重做一个更强的 loop，而在于成为一个更强的 workspace-first harness。
2. 当前距离“可替代 Claude Code / Codex 的日常主力工作”还差的主要不是模型能力，而是：
   - 执行隔离
   - 会话连续性
   - 控制边界
3. `loop.run()` 应继续保持异步迭代器模型，但 `agent` 和 `orchestrator` 不应整体改成 async generator 风格。

评审的重点就是检验这三个主张是否站得住。

## 评审顺序

建议严格按顺序评，不要跳着看。

### 一、先评战略定位

要先确认：

- 我们是否真的要把 `agent-worker` 推向“日常主力工作台”
- 还是它更应该停留在“多 agent 编排层”

如果这个问题没有共识，后面所有 Phase 都会摇摆。

需要重点问：

- 用户真正要替代的是什么
- 是 `Claude Code / Codex` 的底层执行能力
- 还是它们的长期工作流位置

### 二、再评三阶段路线是否抓住主要矛盾

逐项验证：

- 为什么是“执行隔离”排第一，不是“memory/session”排第一
- 为什么“会话连续性”必须是默认能力，不是可选增强
- 为什么“控制边界”不是简单调默认参数，而是必须做成正式模式

如果任何一项优先级站不住，就需要改 roadmap。

### 三、最后评边界纪律

这一步只看架构，不看功能：

- `loop` 应该负责什么
- `agent` 应该负责什么
- `workspace` 应该负责什么
- `daemon/web` 应该负责什么

重点确认：

- 是否继续坚持 `workspace-first`
- 是否继续复用外部成熟 runtime
- 是否明确禁止把整个 agent lifecycle 流式化

## 关键评审问题

### A. 战略问题

1. 我们要构建的是“更强的多 agent 工作台”，还是“新的单兵 coding runtime”？
2. 如果两者不能同时优先，哪一个应该优先？
3. 当前路线是否在不必要地逼近 `Claude Code / Codex` 的内核，而不是发挥自己的优势？

### B. 执行隔离问题

1. `git worktree + branch` 是否足够，还是必须直接上容器/隔离 runner？
2. worktree 应该是：
   - 每 workspace 一个
   - 还是每 coder agent 一个
3. shared sandbox 和 code worktree 的职责边界是否清晰？
4. review/merge 是否必须和 coder 执行面彻底分离？

### C. 会话连续性问题

1. 长期 agent 默认持久化哪些状态才算足够？
2. `notes + memory + threadId + current task summary` 是否是最小闭包？
3. 哪些状态不应该恢复，以避免“恢复了错误的现场”？
4. continuity 是依赖 workspace state，还是仍需要部分依赖 provider session？

### D. 控制边界问题

1. `assist / delegate / auto` 三档是否足够？
2. 这些模式到底控制哪些东西：
   - permission policy
   - git policy
   - approval policy
   - write scope
3. 默认模式应该服务谁：
   - 个人开发者
   - 团队 coder agent
   - 批处理/评测

### E. 架构边界问题

1. `LoopRun` 的 `AsyncIterable + result` 契约是否应冻结？
2. `RunCoordinator` 是否已经站在正确边界上？
3. 是否存在任何强理由把 `agent` 主循环整体改造成 async generator？
4. 哪些 provider 差异必须继续封装在 `packages/loop` 内部？

## 评审产出

这轮评审不要求产出代码，只要求产出结论。

建议最终只形成三类结果：

### 1. Frozen decisions

明确冻结的设计判断，例如：

- 保持 workspace-first
- 先做 worktree 隔离
- `LoopRun` 保持异步迭代器契约

### 2. Open questions

仍需继续调研的问题，例如：

- worktree 与 sandbox 的最终职责分工
- continuity 恢复时最小必要状态
- assist/delegate/auto 的具体策略矩阵

### 3. Rejected directions

明确不走的路，例如：

- 不重做底层 coding runtime
- 不把长期连续性主要压在 transcript 上
- 不把整个 agent lifecycle 改成统一的 async generator 风格

## 退出条件

只有满足以下条件，才算这轮设计评审结束：

1. 对总体定位有共识
2. 对三阶段优先级有共识
3. 对异步迭代器边界有共识
4. 至少列出一份 frozen decisions 清单
5. 至少列出一份 open questions 清单

如果这五项做不到，就不应该进入实现。

## 建议的评审方法

为了避免讨论发散，建议按下面方式进行：

1. 先读路线图，不讨论细节实现。
2. 对每个 Phase 只问一件事：
   - 这是不是当前最先该解决的问题？
3. 对边界问题只问一件事：
   - 这个职责是否落在了正确层？
4. 一旦讨论开始滑向“具体怎么实现”，先记到 open questions，不当场展开。

## 初始建议结论

如果现在就给一个初始立场，我建议：

- 先默认接受当前路线图的大方向
- 把这轮评审重点放在 `Phase 1` 和 `Phase 2`
- `Phase 3` 先只冻结原则，不急着定细节

原因很简单：

- 没有执行隔离，多 agent coding 风险过高
- 没有会话连续性，主力工作台体验不成立
- 控制边界虽然重要，但可以建立在前两者之上再细化

所以，这轮评审最值得先争清楚的其实只有两件事：

1. worktree/branch 是否作为一等隔离方案
2. 长期 agent 的默认持久化闭包到底是什么
