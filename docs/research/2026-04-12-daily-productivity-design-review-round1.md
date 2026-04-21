# Agent Worker 日常生产力设计评审 Round 1

日期：2026-04-12

关联文档：

- [2026-04-12-daily-productivity-design-review-plan.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-design-review-plan.md)
- [2026-04-12-daily-productivity-roadmap.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-roadmap.md)
- [2026-04-12-daily-productivity-gap-vs-claude-code-codex.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-daily-productivity-gap-vs-claude-code-codex.md)
- [2026-04-12-agent-loop-async-iterator-boundary.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-agent-loop-async-iterator-boundary.md)
- [2026-04-12-hierarchical-lead-worker-interaction-model.md](/Users/lidessen/workspaces/agent-worker/docs/research/2026-04-12-hierarchical-lead-worker-interaction-model.md)

## 结论摘要

这轮评审先不给实现方案，只冻结方向。

当前可以先形成以下判断：

- 大方向成立：`agent-worker` 值得继续向“日常主力工作台”推进。
- 当前路线图的三阶段排序基本正确：
  1. 执行隔离
  2. 会话连续性
  3. 控制边界
- `loop.run()` 保持异步迭代器契约是对的，不应再把整体设计带回 callback 或 transcript-first 路线。
- `sandbox` 应继续被视为 workspace 内部概念；code 工作的 `worktree` 是 workspace 众多工作对象中的一种，而不是与 workspace 平级的概念。
- 上下文连续性应主要通过 workspace 达成，provider session continuity 只作为优化，不应成为主依赖。
- `lead` / `worker` 应被视为装配角色，而不是 runtime 类型；任何 runtime 都可以被装配成 lead 或 worker。
- 当前真正需要 review 的，不是 runtime 抽象能否支持 lead/worker，而是 workspace 是否要从 `channel-first peer collaboration` 转向 `workspace-led hierarchical orchestration`。
- 如果走 hierarchical 模型，`channel` 应降级为公共可见面/辅助协作面，而 `task / attempt / handoff / artifact` 应提升为 workspace 一等对象。

当前最值得继续深入的问题只有两个：

1. `worktree / sandbox / shared workspace` 的职责边界
2. 长期 agent 的最小持久化闭包到底是什么

## Frozen Decisions

### 1. 保持 workspace-first，不退回 session-first

冻结判断：

- 长期连续性应继续主要落在 workspace 层，而不是重新压回 provider transcript。
- `agent-worker` 的核心价值是长期工作系统，而不是重造单次 coding runtime。

原因：

- 当前项目已经在 `workspace / chronicle / docs / channels / sandbox / event log` 上形成基础。
- 如果为了追求“像 Claude Code 一样”而把连续性重新压回 session，会削弱现有优势。

### 2. 继续复用成熟 runtime，不重做底层 loop

冻结判断：

- `claude-code / codex / cursor / ai-sdk` 继续作为底层执行 runtime。
- 项目的主要创新层仍应是 harness、workspace、orchestration、recovery。

原因：

- 这些 runtime 已经承担了单次运行的复杂性。
- 当前缺的不是更聪明的 loop，而是更强的长期工作系统。

### 3. 三阶段优先级先不调整

冻结判断：

- `Phase 1` 执行隔离优先于 `Phase 2` 会话连续性
- `Phase 2` 会话连续性优先于 `Phase 3` 控制边界

原因：

- 没有执行隔离，多 agent coding 的默认风险过高
- 没有连续性，主力工作台体验不成立
- 控制边界要建立在前两者之上，否则只是调默认参数

### 4. 异步迭代器边界先冻结

冻结判断：

- `LoopRun` 继续保持 `AsyncIterable<LoopEvent> + result: Promise<LoopResult>`
- `Agent` 和 `Orchestrator` 不整体改成 async generator 风格

原因：

- `loop` 是单次运行流
- `agent` 是长期状态机
- `orchestrator` 是调度器

### 5. 不把“文档/UI完善”当成当前核心工作

冻结判断：

- 当前主矛盾不是 UI，也不是文档，而是结构能力。
- review 与后续设计讨论继续只围绕隔离、连续性、控制边界展开。

### 6. sandbox 与 worktree 的包含关系先冻结

冻结判断：

- `sandbox` 是 workspace 下的概念。
- code work 的 `worktree` 应被视为 workspace 众多工作对象中的一种。
- 后续讨论不要再把 `workspace`、`sandbox`、`worktree` 当成三种平级容器。

原因：

- 先把包含关系讲清楚，后面的隔离设计才不会反复摇摆。
- 这样也更符合当前 workspace-first 的总体方向。

### 7. continuity 以 workspace 为主，session 为辅

冻结判断：

- 上下文连续性的主锚点是 workspace state。
- provider session continuity 不应成为主连续性机制。
- 若某些 runtime 的 session/thread 能提升体验，可以作为附加优化保留。

原因：

- 这和 workspace-first 的长期方向一致。
- 也能避免系统把连续性重新压回 transcript/session。

### 8. 可接受一定重复劳动，优先稳健交接

冻结判断：

- continuity 设计不以“尽量省 token”作为最高优先级。
- 可以接受为了稳健 handoff 与恢复而多消耗一些 token、重复少量工作。

原因：

- 人类协作交接本来就会有重复劳动。
- 当前阶段更重要的是减少断档和误恢复，而不是过早追求 token 最优。

### 9. review / merge 流程优先放在 skill/policy 层

冻结判断：

- `review / merge` 更适合作为 skill、policy、workflow 组织层问题。
- 不应在 daemon/workspace 内核里过早硬编码完整的 review / merge 流程。

原因：

- review / merge 的组织方式高度依赖团队习惯。
- 过早硬编码会让内核边界变重，也不利于后续调整。

### 10. lead / worker 先冻结为装配角色，而不是 runtime 身份

冻结判断：

- `lead` / `worker` 是 orchestration 层角色
- 不是 runtime 身份
- 任何 runtime 理论上都可以成为 lead 或 worker
- role profile、prompt profile、tool profile、lifecycle policy 应优先在 agent/workspace 组装层表达

原因：

- 当前 `AgentLoop` 是 capability-based 接口，本身已经足够 runtime-agnostic
- 当前真正写死的是 workspace prompt、workspace tools、消息路由与 lead 语义
- 先冻结这个边界，后面就不会误走成 `claude=lead / codex=worker` 一类硬编码

### 11. channel 降级，task/attempt/handoff/artifact 升级

冻结判断：

- `channel` 不再承担默认任务编排主干
- `channel` 主要承担：
  - 公共可见面
  - 广播通知面
  - 辅助协作面
- workspace 后续应逐步提升：
  - `task`
  - `attempt`
  - `handoff`
  - `artifact`
  为一等对象

原因：

- 否则 lead 的长期上下文会重新退化成 transcript 阅读
- worker 的 task session 边界也会重新被消息流冲淡
- 如果不提升这些对象，hierarchical lead/worker 很容易退化成“换了说法的 channel 协作”

## Open Questions

### 1. worktree 与 sandbox 的最终职责分工

当前未决：

- code work 应该全部在 per-agent worktree 内完成，还是允许部分工作继续使用 agent sandbox
- shared sandbox 是否只放文档/中间产物，还是也允许放可执行脚本
- agent mounts 与 worktree 的关系怎么定义，避免路径模型过于复杂

这决定 `Phase 1` 的实施复杂度和默认安全边界。

### 2. worktree 粒度是否需要由代码强制约束

当前未决：

- worktree 拓扑是否真的应该由核心代码强制规定
- 还是只提供 worktree primitives，把最终粒度留给 skill/workflow 决定

当前倾向：

- 内核先提供能力，不急着把“每 agent 一个”或“每 task 一个”写死成强约束

需要继续判断：

- 哪些最小约束必须由代码保证
- 哪些拓扑选择可以晚一点放到 workflow/skill 层

### 3. 长期 agent 的最小持久化闭包

当前未决：

- `notes`
- `memory`
- `threadId`
- `current task summary`
- `last branch/worktree`
- `pending handoff`

到底哪些应当被视为默认必持久化项。

如果闭包太小，连续性不成立。  
如果闭包太大，恢复容易带回脏状态。

### 4. 持久化闭包如何取平衡

当前未决：

- 默认持久化到什么程度才算“足够连续”
- 哪些状态应当保留，哪些状态应主动丢弃
- 允许一定重复劳动的前提下，最小必要闭包是什么

这个问题的核心不是 token 最优，而是：

- 恢复时是否能把工作真正接起来
- 同时又不把过多脏状态带回来

### 5. “控制边界”该怎么表达，而不是先固定 mode 名称

当前未决：

- 是否真的需要先把它命名为 `assist / delegate / auto`
- 还是应先定义控制维度，再决定是否抽象成模式

更具体地说，需要先搞清楚：

- 哪些行为维度需要被控制
- 哪些维度应属于 workspace policy
- 哪些维度应属于 skill / workflow

当前判断：

- 现在先不要被 mode 名字绑住
- 先把“控制什么”讲清楚，再决定“如何命名”

### 6. workspace 是否应从 peer/channel-first 切到 hierarchical lead/worker

当前未决：

- 当前 workspace 默认心智是否仍应是“平级 agent 在 channels 里互相唤醒”
- 还是应改成“lead 持有长期状态，worker 主要承担 session 级执行”
- channel 在新模型里到底是主协作面，还是退化成可见公共面

已知前提：

- worker 之间不应默认私聊
- worker 可以直接与 lead 沟通，也可以通过 channel 与其他人形成可见协作记录
- lead 应主要消费结构化 workspace state，而不是原始 transcript/event stream
- worker 默认应是 ephemeral session

这会直接影响：

- prompt 结构
- tool surface
- inbox routing
- on-demand / worker lifecycle

### 7. `task / attempt / handoff / artifact` 的最小对象模型是什么

当前未决：

- task 需要哪些最小字段才能支撑 lead 调度
- attempt 和 worker session 是否一一对应
- handoff 的结构化边界是什么
- artifact 只是资源引用，还是应有更高层语义

这个问题是新模型能否真正落地的关键。

### 8. lead 与 worker 需要怎样分化的上下文机制

当前未决：

- worker 是否应明确采用 `task-session context`
- lead 是否应明确采用 `workspace-rolling context`
- 哪些状态属于 worker session 保存
- 哪些状态属于 lead 的滚动状态窗口

当前判断：

- worker 的连续性更像“任务 session + 交接恢复”
- lead 的连续性更像“workspace state rollup + 持续滚动淘汰”
- 不应再要求一套统一上下文机制同时优雅覆盖两者

## Rejected Directions

### 1. 不重做一个新的 coding runtime

否决方向：

- 在 `packages/loop` 内部再发明一套更复杂、更统一的新 loop runtime

原因：

- 这会让项目失去当前最清晰的优势边界
- 成本高，且会和现有成熟 runtime 正面竞争

### 2. 不把长期连续性重新压回 transcript/history

否决方向：

- 主要依赖 transcript compaction、prompt history、conversation lineage 来承担主连续性

原因：

- 这会让系统重新回到 session-first
- 不符合当前 workspace-first 方向

### 3. 不把整个 agent lifecycle 改成统一的异步流模型

否决方向：

- 把 `Agent`、`RunCoordinator`、`Orchestrator` 也整体重写成 async generator / full stream style

原因：

- 会削弱状态机语义
- 会让 pause/resume/interrupt/recovery 变复杂

### 4. 不先把控制边界当成唯一优先级

否决方向：

- 先只调 permission/approval 默认值，试图快速把系统“伪装成主力工具”

原因：

- 没有执行隔离和连续性，光调边界并不能真正提升信任感

## 当前建议

如果继续做 Round 2 设计评审，我建议只聚焦两件事：

1. `Phase 1` 的边界建模
   - worktree
   - sandbox
   - shared workspace
   - mounts

2. `Phase 2` 的最小持久化闭包
   - notes
   - memory
   - session continuity 作为附加优化时的最小注入点
   - task summary

`Phase 3` 先只保留“控制边界需要存在”这个原则，不急着定模式名称。

## 当前结论

到这一步可以认为：

- 设计方向已基本成立
- 还没有发现需要推翻路线图的大问题
- 下一轮不该继续泛泛讨论“是否值得做”
- 应该开始收敛 `Phase 1` 和 `Phase 2` 的结构问题
