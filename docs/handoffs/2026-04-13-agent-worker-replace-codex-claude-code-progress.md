# Agent Worker 替代 Codex / Claude Code 进度交接

日期：2026-04-13  
目标：把 `agent-worker` 从多 agent 编排层推进成一个可承接原本由 `Codex / Claude Code` 承担的日常主力开发系统。

## 1. 当前总进度判断

按这个目标衡量，当前状态可以分成两部分看：

### 已经完成并可用的部分

- `7420` 工作台主链已经成立
  - daemon + HTTP API + Web UI + workspace lifecycle 已可工作
- Bun-first / Node fallback 已基本打通
  - 有 Bun 时优先 Bun
  - 没 Bun 时可以回退到 `node --import tsx`
- CI 基础面已经收干净
  - `lint`
  - `fmt:check`
  - `typecheck`
  - `test`
- 设计主线已经从散乱 research 收口到 `docs/design/`

### 还没有完成的关键部分

- execution isolation 还没真正落地
- continuity 还没从“概念”变成可恢复机制
- task / attempt / handoff / artifact 还没有进入内核对象
- lead / worker 的新交互模型还只是设计，不是实现

一句话：

- 工程基础和现有系统整理工作已经推进不少
- 但“替代 Codex / Claude Code”的核心结构能力还处在设计阶段

## 2. 这次会话里已经完成的工程工作

### 2.1 Node 兼容第一阶段

目标是：

- 有 Bun 时优先 Bun
- 没 Bun 时 Node 能跑起来

已经做过的改动方向：

- 增加 `tsx`
- 根 `aw` 脚本支持 Bun 优先、Node fallback
- 新增共享运行时解析逻辑
- MCP stdio 子进程不再写死 `bun`
- `claude-code` loop 的脚本运行时也跟随解析器

已经验证过的结果：

- `bun run aw --help`
- `bun run aw:node --help`
- `node --import tsx packages/agent-worker/src/cli/index.ts status`

都通过过。

### 2.2 CI / 检查面修复

已经处理过：

- `vendor` 不再影响主仓库 lint/test/typecheck
- 根 scripts 已可作为 CI 入口
- 若干 lint / typecheck / test 问题已被修掉

之前这几条都已经通过：

- `bun run lint`
- `bun run fmt:check`
- `bun run typecheck`
- `bun run test`

### 2.3 `7420` 工作台现状确认

之前已经实际确认过：

- `http://127.0.0.1:7420/` 可打开
- `/health` 可返回运行时状态
- Web UI、daemon、workspace 主链是通的

注意：

- 这是本次会话中确认过的状态，不保证下次恢复时 daemon 仍在同一状态

## 3. 设计工作当前主结论

这轮设计已经从 `docs/research` 收口到了：

- [docs/design/workspace-led-hierarchical-agent-system/README.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/README.md)
- [docs/design/workspace-led-hierarchical-agent-system/interaction-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/interaction-model.md)
- [docs/design/workspace-led-hierarchical-agent-system/state-and-context-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/state-and-context-model.md)
- [docs/design/workspace-led-hierarchical-agent-system/profiles-and-policies.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/profiles-and-policies.md)

### 3.1 已冻结的方向

- 系统从 `channel-first peer collaboration` 转向 `workspace-led hierarchical orchestration`
- `channel` 降级为公共可见面 / 广播通知面 / 辅助协作面
- `task / attempt / handoff / artifact` 升级为 workspace 一等对象
- `lead` 持有长期调度视角
- `worker` 主要承担 task/session 级执行
- `lead / worker` 不是 runtime 类型
- runtime 继续复用 `claude-code / codex / cursor / ai-sdk`
- `loop.run()` 继续保持异步迭代器边界

### 3.2 已收敛的上下文模型

- `worker` 使用 `task-session context`
  - 更接近 `Claude Code / Codex`
  - 一个 session 对应一个任务
  - 通过结构化 handoff 恢复，而不是无限依赖 provider session

- `lead` 使用 `workspace-rolling context`
  - 主上下文来自 workspace state
  - 按 `hot / warm / cold / deep` 分层
  - 不依赖“达到瓶颈再 compact”

### 3.3 配置面的当前结论

配置面现在收敛成：

- 继续尽量贴近现有 `workspace.yml`
- 默认 agent 不要求显式写 `role: worker`
- 只需要额外标记谁是 `lead`

也就是：

- 对外：`lead-marked config with default workers`
- 对内：`profile/policy-based assembly`

## 4. 当前 review 后仍然存在的关键问题

这部分最重要，下次恢复不要跳过。

### 4.1 `AgentSpec` 和 `Attempt` 的关系还没完全收口

现在已经开始纠正，但还没完全写透：

- `agents:` 里的静态定义，应该是 `AgentSpec / member spec`
- 真正的 task-scoped worker，应该是运行时派生出来的 `Attempt`

为什么重要：

- 否则会把静态团队成员和一次任务实例混在一起
- 影响恢复、生命周期、worker pool、bot 这类长期角色

### 4.2 角色体系不能只剩 `lead` 和默认 worker

当前设计已经明显需要至少这三类：

- `lead`
- `worker-capable member`
- `observer / automation member`

例如：

- 现在 dogfood workspace 里的 `bot` 明显不是 task-scoped worker

如果这层不补，后面角色模型会返工。

### 4.3 `TaskDraft -> canonical Task` 规则还不够明确

目前已经倾向：

- canonical task intake owner = `lead`

但还没完全定清楚：

- `TaskDraft` 是否是正式对象
- 哪些输入可以自动生成 draft
- lead 是显式确认还是自动接纳后修正
- draft 的 rejected / merged / split 流程

这件事如果不先定，系统很容易重新退回“lead 读消息脑补任务”。

## 5. 推荐的恢复顺序

下次恢复时，建议按这个顺序进入：

### 第一步：先读主设计文档

按这个顺序读：

1. [README.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/README.md)
2. [interaction-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/interaction-model.md)
3. [state-and-context-model.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/state-and-context-model.md)
4. [profiles-and-policies.md](/Users/lidessen/workspaces/agent-worker/docs/design/workspace-led-hierarchical-agent-system/profiles-and-policies.md)

### 第二步：重点复核这三个未决点

1. `AgentSpec -> Attempt` 的装配关系
2. 最小角色集合
3. `TaskDraft -> canonical Task` intake 规则

### 第三步：确定后续是继续设计还是开始实现

如果继续设计：

- 优先把上面三点补硬

如果开始实现：

- 第一批优先做内核对象和配置接口，而不是先改 prompt 文本

## 6. 如果继续实现，最推荐的第一批实现顺序

### Phase 0：接口收口

优先改：

- [packages/workspace/src/config/types.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/config/types.ts)
- `WorkspaceDef`
- `AgentDef`
- `ResolvedWorkspace`
- `ResolvedAgent`

目标：

- 明确 `lead`
- 保持现有配置心智
- 不直接暴露内部 profile/policy DSL

### Phase 1：最小内核对象

优先引入最小对象模型：

- `Task`
- `Attempt`
- `Handoff`
- `Artifact`

先不用一次做全功能，先让这几个对象成为 canonical state。

### Phase 2：lead intake

把：

- 用户输入
- channel 输入
- kickoff 输入

通过 lead 归一化成 task/draft/task state。

### Phase 3：worker attempt lifecycle

把非 lead 静态成员视作：

- worker-capable member specs

再由 orchestration 派生：

- task-scoped `Attempt`

## 7. 当前工作树状态

截至本次交接，工作树大致状态是：

- 新增 `docs/design/workspace-led-hierarchical-agent-system/`
- `docs/research/2026-04-12-daily-productivity-roadmap.md` 有修改
- `docs/research/2026-04-12-daily-productivity-design-review-plan.md`、`docs/research/2026-04-12-daily-productivity-design-review-round1.md` 目前仍在工作树里

恢复前建议先跑：

```bash
git status --short
```

确认现场。

## 8. 一句话恢复提示

下次恢复不要从“怎么做 lead/worker prompt”开始。  
先把这三件事钉死：

1. `agents:` 是 `AgentSpec/member spec`
2. `Attempt` 才是 task-scoped worker instance
3. `lead` 是 canonical task intake owner
