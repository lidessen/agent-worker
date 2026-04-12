# Agent Loop / Harness 调研报告

日期：2026-04-11  
范围：当前 `agent-worker` 实现、Claude Code 2.1.88、[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)

## 结论摘要

这三个系统分别代表了三种重心：

- `agent-worker`：已经在往 `workspace-first` 走，`workspace` 是长期状态中心，`loop` 被当成可替换执行内核。
- `Claude Code 2.1.88`：是非常成熟的 `session harness`，强项是单次 session 内的工具、权限、hooks、resume、subagent 组织。
- `hermes-agent`：是“长记忆 + 多入口 + 工具平台 + 子代理”的综合 agent 平台，持久层分层做得很丰富，但核心仍是 `AIAgent` conversation loop。

设计判断：

1. 你的总体方向是对的，不应该和 Claude Code / Codex / AI SDK 竞争“单体 agent loop”。
2. 应该把这些系统视为 `short-life workers + mature loop runtime`，而把连续性放在 `workspace / event log / handoff / artifact` 上。
3. 当前项目已经有这个骨架，但 `packages/agent` 仍保留明显的 `conversation/history-first` 语义，后续应该继续把“工作叙事”下放为二级材料，把“工作状态”上升为一等对象。

## 一、当前项目的状态判断

### 1. 已经做对的部分

当前项目在结构上已经不是“聊天 agent”优先，而是“工作区 + 编排”优先。

- `packages/loop` 是纯执行适配层，封装 `AI SDK / Claude Code / Codex / Cursor`，说明你已经在复用成熟 loop，而不是自己重造单体 agent。见 [packages/loop/src/loops/claude-code.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/claude-code.ts)、[packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)。
- `packages/workspace` 已经持有长期状态：`channels / inbox / documents / resources / status / timeline / chronicle / sandbox`。见 [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)、[packages/workspace/src/context/stores/chronicle.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/stores/chronicle.ts)。
- `workspace` 通过 MCP 对外暴露协作环境，agent 通过 MCP client 进入 workspace，这个分层非常关键。见 [packages/workspace/src/mcp-server.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/mcp-server.ts)、[packages/agent/src/workspace-client.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/workspace-client.ts)。
- `agent-worker` 已经承担 harness/orchestrator 角色，而不是让 workspace 直接驱动 agent。见 [docs/adr/0002-workspace-mcp-decoupling.md](/Users/lidessen/workspaces/agent-worker/docs/adr/0002-workspace-mcp-decoupling.md)、[packages/agent-worker/src/orchestrator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/orchestrator.ts)。

一句话说，当前项目的基础设施层已经比 Claude Code 和 Hermes 更接近你的目标方向。

### 2. 还没完全转过去的部分

问题不在 `workspace`，主要在 `agent semantics`。

- `packages/agent` 仍然以 `Turn[] history + assembled prompt + next run` 组织执行。见 [packages/agent/src/run-coordinator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/run-coordinator.ts)、[packages/agent/src/context-engine.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/context-engine.ts)。
- 当前的 prompt 入口仍是“我现在该回复什么/处理什么”，而不是“我现在正在推进哪个工作状态机节点”。
- 现在还没有显式的 `handoff artifact` 或 `handoff protocol`；交接更多依赖 timeline、event log、history 的组合，而不是结构化交接对象。

所以更准确地说，当前项目是：

- `infra`: workspace-first
- `runtime semantics`: 半 workspace-first，半 conversation-first

## 二、Claude Code 2.1.88 的设计启发

### 1. 需要先澄清的事实

我核对了公开资料后，关于 `2.1.88` 有两个需要写清楚的点：

- 官方在线 changelog 页面没有单独列出 `2.1.88`，`2.1.87` 是 2026-03-29，`2.1.89` 是 2026-04-01。来源：[Claude Code changelog](https://code.claude.com/docs/en/changelog)。
- 但公开 Git 仓库存在 `v2.1.88` tag，对应提交 `2d5c1bab92971bbdaecdb1767481973215ee7f2d`，提交时间是 `2026-03-30 23:53:01 +0000`。这是我本地直接查询 tag 得到的结果。

另外还要说明：

- 公开仓库 [anthropics/claude-code](https://github.com/anthropics/claude-code) 在 `v2.1.88` tag 下主要是 `CHANGELOG / docs / plugins / examples`，不包含完整核心 runtime 源码。
- 因此，对 `2.1.88` 的“源码调研”只能结合三类材料：
  - 官方 docs / changelog / public repo
  - 公开 source-map 提取与分析文章
  - SDK/工具行为与版本演化信号

### 2. 它真正强在哪里

Claude Code 的核心优势不是“更聪明的模型”，而是“非常成熟的 session harness”。

从官方文档和 changelog 看，它已经把这些都做成了一等能力：

- `resume / continue / fork-session`
- `hooks`
- `permissions`
- `MCP`
- `subagents / agent teams`
- `compaction`
- `memory / CLAUDE.md / nested CLAUDE.md`
- `worktree isolation`
- `transcript persistence`

来源：

- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

尤其值得注意的是 `2.1.83` 到 `2.1.91` 这一段演化，几乎全部围绕 harness：

- subagent visibility / inheritance / worktree isolation
- transcript chain breaks / resume correctness
- compaction correctness and cache hit rate
- hook lifecycle and permission semantics
- MCP connection behavior
- prompt cache stability

这说明 Claude Code 的工程重心很明确：不是只做推理，而是把 session runtime 做稳。

### 3. 它的边界也很明确

Claude Code 虽然已经不只是“聊天”，但本质仍然是 `session-first`。

连续性的主要锚点仍然是：

- `session transcript`
- `~/.claude` 下的 memory / config / project state
- `CLAUDE.md`
- compaction 后保留的 conversation lineage

也就是说，它更像：

- 一个极强的单 session 工作 runtime

而不是：

- 一个以 workspace state 为主对象的长期工程系统

这点对你的项目很重要。Claude Code 最值得借鉴的是：

- permissions
- hooks
- transcript / resume correctness
- subagent runtime
- worktree isolation

最不应该照搬的是：

- 把连续性仍然主要压在 session transcript 上

### 4. 外部分析材料给出的补充

几份公开分析与 source-map 恢复材料，基本强化了同一个判断：Claude Code 的价值在 harness，不在“神秘 prompt”。

- source-map 提取脚本：<https://gist.github.com/sorrycc/d77bcc8c2bfd0ac04d8d6ad98c413905>
- Haseeb Qureshi 的分析：<https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1>
- 第三方 source analysis：<https://claudecn.com/en/docs/source-analysis/>
- Liran Baba 的分析：<https://liranbaba.dev/blog/claude-code-source-leak/>

我的判断是：这些二手分析可用于识别设计重心，但不适合作为稳定接口依据。

## 三、Hermes Agent 的设计启发

### 1. Hermes 的定位

Hermes 不是单一 coding agent，而是一个 agent 平台：

- CLI
- messaging gateway
- ACP editor integration
- session DB
- persistent memory
- skills system
- cron
- terminal environments
- delegation

来源：

- [Hermes README](https://github.com/NousResearch/hermes-agent/blob/main/README.md)
- [Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)

### 2. Hermes 最值得借鉴的地方

Hermes 最强的不是单次 loop，而是“长期信息分层”。

它把长期连续性拆成了几层：

- `MEMORY.md / USER.md`：稳定事实与用户偏好
- `session_search + SQLite FTS5`：历史经历回溯
- `skills`：程序化、可复用的工作方法
- `context files`：项目规则
- `gateway sessions / cron / environments`：多入口长期运行环境

来源：

- [Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
- [Skills System](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md)
- [Context Files](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md)
- [Session Storage](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/session-storage.md)

对你的目标来说，这个分层非常有启发：

- 稳定事实不应混在 transcript 里
- 历史经历不应混在 profile memory 里
- 可复用 procedure 不应混在 notes 里
- 项目规则不应混在 user conversation 里

### 3. Hermes 的局限

Hermes 的核心 loop 仍然是 `AIAgent` conversation loop。

它的长期层虽然很多，但仍然是围绕 loop 外挂出来的：

- memory 是外挂
- session_search 是外挂
- skills 是外挂
- cron / gateway / ACP 是多入口外挂

主干仍然是：

- `AIAgent` 接收消息
- 组装 prompt
- 走 tool loop
- 把结果写回持久层

所以它比一般聊天 agent 更接近长期系统，但仍然不是纯正的 `workspace-first`。

## 四、三者对比

| 维度           | 当前项目                                 | Claude Code 2.1.88               | Hermes Agent                                 |
| -------------- | ---------------------------------------- | -------------------------------- | -------------------------------------------- |
| 核心重心       | workspace + orchestrator                 | session harness                  | conversation loop + persistent layers        |
| loop 策略      | 复用外部成熟 loop                        | 自有成熟 runtime                 | 自有 AIAgent loop                            |
| 长期状态中心   | workspace stores + event log + chronicle | session transcript + `~/.claude` | session DB + memory + skills + context files |
| 外部接入方式   | MCP-first                                | MCP + hooks + plugins            | MCP + gateway + ACP                          |
| 交接模型       | 还不够显式                               | session resume / subagents       | session lineage + delegate summaries         |
| 与你的目标距离 | 最近                                     | 中等                             | 中等偏近                                     |

## 五、对本项目的直接建议

### 1. 保持现在的大战略，不要回退到“聊天 agent”

这点不需要修正。当前项目最正确的决定就是：

- `loop` 复用外部系统
- `workspace` 自己掌握
- `harness` 自己掌握

### 2. 下一步不是“再做更强 prompt”，而是把 handoff 做成一等协议

当前最大的缺口不是模型能力，而是交接协议。

建议引入显式对象：

- `work item`
- `handoff record`
- `attempt record`
- `artifact reference`
- `next action`
- `blocked reason`

这会比继续加 conversation history 更接近你的目标。

### 3. 从 Claude Code 吸收 harness 机制，而不是 session worldview

建议重点借鉴：

- hook lifecycle
- permission model
- worktree / sandbox isolation
- resume correctness
- subagent runtime semantics

不建议照搬：

- transcript-first continuity

### 4. 从 Hermes 吸收 memory layering，而不是 AIAgent 中心论

建议重点借鉴：

- memory / history / skill / context-file 分层
- session search 与稳定 memory 分离
- long-lived environment 的多入口设计

不建议照搬：

- 让所有长期能力都围绕一个 central `AIAgent` loop 组织

### 5. 对当前项目的具体落点

优先级最高的演进方向，我建议是：

1. 明确 `workspace state model`
2. 定义 `handoff schema`
3. 定义 `workspace event taxonomy`
4. 让 `RunCoordinator` 从“回复驱动”转向“状态推进驱动”
5. 把 `Turn[] history` 进一步降级为二级材料

## 六、最终判断

如果只看“如何把一个 agent session 做强”，Claude Code 目前最成熟。  
如果只看“如何把长期信息分层并持久化”，Hermes 给的启发更多。  
如果看“如何做一个 workspace-first 的长期工程系统”，当前项目反而已经站在更接近目标的位置上。

所以最合理的路线不是模仿任何一个现成系统，而是：

- 吸收 Claude Code 的 harness 工程经验
- 吸收 Hermes 的长期记忆分层经验
- 继续把当前项目往 `workspace state > session transcript` 的方向推到底

## 参考资料

### 当前项目

- [workspace-first-design-principles.md](/Users/lidessen/workspaces/agent-worker/docs/workspace-first-design-principles.md)
- [ADR-0002: Workspace MCP Decoupling](/Users/lidessen/workspaces/agent-worker/docs/adr/0002-workspace-mcp-decoupling.md)
- [packages/workspace/src/workspace.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/workspace.ts)
- [packages/workspace/src/mcp-server.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/mcp-server.ts)
- [packages/workspace/src/context/stores/chronicle.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/stores/chronicle.ts)
- [packages/agent/src/context-engine.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/context-engine.ts)
- [packages/agent/src/run-coordinator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/run-coordinator.ts)
- [packages/agent/src/workspace-client.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/workspace-client.ts)
- [packages/loop/src/loops/claude-code.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/claude-code.ts)
- [packages/loop/src/loops/codex.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/loops/codex.ts)

### Claude Code

- [Claude Code changelog](https://code.claude.com/docs/en/changelog)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [Public repo: anthropics/claude-code](https://github.com/anthropics/claude-code)
- [Public changelog on GitHub](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

### Claude Code supplemental analysis

- [source-map extraction gist](https://gist.github.com/sorrycc/d77bcc8c2bfd0ac04d8d6ad98c413905)
- [Inside the Claude Code source](https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1)
- [Source Analysis](https://claudecn.com/en/docs/source-analysis/)
- [Claude Code source leak analysis](https://liranbaba.dev/blog/claude-code-source-leak/)

### Hermes Agent

- [Hermes README](https://github.com/NousResearch/hermes-agent/blob/main/README.md)
- [Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)
- [Agent Loop Internals](https://hermes-agent.nousresearch.com/docs/developer-guide/agent-loop)
- [Session Storage](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/session-storage.md)
- [Persistent Memory](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md)
- [Skills System](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md)
- [Context Files](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md)
