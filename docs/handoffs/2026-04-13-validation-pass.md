# First Real-Runtime Validation Pass

日期：2026-04-13
分支：`codex/dev-runtime-workspace`
配置：`docs/design/workspace-led-hierarchical-agent-system/validation-workspace.yml`
运行时：两个 `claude-code` sonnet agent（maintainer + implementer）

## 结论

**设计文档里声明的 workspace-led hierarchical 路径在真实 runtime 下跑通了，完全自动，零人工干预**。

第一次跑暴露了三个具体问题，修完第二次跑一轮到位。

## 第二次跑的完整事件序列（全自动）

```
t=0     user kickoff message → #general
t+11s   implementer run 1: my_inbox + no_action
        reason: "not addressed to me, no dispatch yet"
t+16s   maintainer  run 1: (28.3s)
          - channel_read
          - task_update id=task_8ac9c5a98b3a status=open (reused auto-draft)
            + goal rewritten to concrete acceptance criteria
          - task_dispatch taskId=... worker=@implementer
          - channel_send "@user 收到。已派给 @implementer 处理..."
t+39s   implementer run 2: (54.7s, 一轮完成)
          - my_inbox
          - channel_read
          - artifact_list (per new prompt: "check before creating duplicates")
          - bash: write greet.ts + greet.test.ts + run `bun test` (1 pass 0 fail)
          - artifact_create greet.ts
          - artifact_create greet.test.ts
          - handoff_create kind=completed
            summary="Created greet.ts... bun test 1 pass 0 fail"
            artifactRefs=[art_24..., art_2f...]
            touchedPaths=[...]
          - attempt_update id=att_ce2a11172865 status=completed
            resultSummary + outputHandoffId
          - channel_send "@maintainer 完成 task_xxx，详见 handoff hnd_yyy..."
            ← 这一条是关键，lead 就是从这里被唤醒的
t+93s   maintainer  run 2: (22.5s, 由 implementer 的 channel_send 自动触发)
          - task_update id=task_8ac9c5a98b3a status=completed
          - channel_send "@user task_xxx 已完成。验收通过..."
t+96s   implementer run 3: no_action
          reason: "maintainer's closing message, already done"
```

**总计**: 3 次 implementer 运行 + 2 次 maintainer 运行 = 5 次真 LLM 调用把一个小任务从 kickoff 驱动到验收。

## 最终状态

```
task task_8ac9c5a98b3a
  status: completed
  attempts (1):
    - att_ce2a11172865 @implementer [completed]
  handoffs (1):
    - hnd_a5472c3b836b completed: "Created greet.ts... bun test 1 pass 0 fail"
  artifacts (2):
    - art_24e71d5279bf file: greet.ts (file:///.../sandbox/greet.ts)
    - art_2f2e701e7be3 file: greet.test.ts (file:///.../sandbox/greet.test.ts)

sandbox/greet.ts:
    export function greet(name: string): string {
      return `Hello, ${name}!`;
    }

sandbox/greet.test.ts:
    import { expect, test } from "bun:test";
    import { greet } from "./greet";
    test("greet world", () => {
      expect(greet("world")).toBe("Hello, world!");
    });

bun test greet.test.ts → 1 pass, 0 fail
```

## 第一次跑发现 & 修复的问题

这三条都是"没在 real-runtime 下测过就发现不了"的坑。

### 1. claude-code 根本看不到 task*\* / attempt*_ / handoff\__ / artifact\_\* 工具

第一次跑 `maintainer` 疯狂 ToolSearch 搜 `task_create` / `task_update` / `task_dispatch` 最后得出结论 "这些工具不在 MCP 列表里" 然后试图 bash 直接改 `tasks.jsonl`。

两个地方都漏了：

- `packages/workspace/src/mcp-server.ts::createAgentServer` 调 `createWorkspaceTools` 没传 options（`stateStore` / `workspaceName` / `instructionQueue`）。
  → 修：补上第五个参数。

- `packages/workspace/src/context/mcp/stdio-entry.ts`（claude-code 用 `--mcp-config` 拉起来的 subprocess）**硬编码**只暴露了 5 个工具（channel_send/read/list、no_action、team_members），整个 task ledger 工具面根本没进它的 registry。
  → 修：新 daemon 路由 `POST /workspaces/:key/tool-call` 做通用分发；`stdio-entry.ts` 重写为从 `WORKSPACE_TOOL_DEFS` 遍历生成工具，每个都 POST 到这个端点。新加的工具会自动同步到 claude-code。

commit：`40bedba`

### 2. claude-code `maxTurns=12` 太低

第一次跑 `implementer` 每次都撞到 `Reached maximum number of turns` 在末尾 error 退出。因为自愈机制让它再跑一次，又跑出同一个 handoff + 同一对 artifact，导致最终 ledger 里有 **8 个 artifact 和 2 个 handoff**，全是重复。

→ 修：`packages/loop/src/loops/claude-code.ts` `maxTurns` 12 → 40。第二次跑 implementer **一轮搞定**（54.7s）。

commit：`0815ea1`

### 3. Lead 没有触发器去复核 worker 的 handoff

第一次跑 implementer 完成了所有事情（`attempt_update completed` + `handoff_create kind=completed`），但 **maintainer 没有自动醒来去验收**。worker prompt 当时写的是 "don't channel_send — the lead will see your handoff in its next run"，问题是没有"next run"触发器——lead 只有在 inbox 有新消息时才会 run。

第一次跑我手动 `curl` POST 一条 channel 消息假装 user 说 "status check" 才把 maintainer 唤醒。

→ 修：worker prompt 改成 "在 `attempt_update` 之后 MUST `channel_send` 一行给 lead"。第二次跑 implementer 执行了这一步，maintainer 通过 channel 消息路由自然唤醒。

commit：`0815ea1`

### 4. Chronicle 从 MCP tool 路径写不进来

HTTP POST 路径有 chronicle hook，MCP tool 路径没有。第一次跑全程用 MCP 所以 chronicle 是空的。

→ 修：`createTaskTools` 接 optional `chronicle` deps，每次 task_create / task_update（仅状态变） / task_dispatch / attempt_update 后 `chronicle.append`。`createWorkspaceTools` 把 `provider.chronicle` 塞进去。

commit：`0815ea1`

### 5. kickoff 自动 draft 的 chronicle 条目缺失

`managed-workspace.kickoff()` 直接调 `stateStore.createTask(...)` 绕过 HTTP 和 MCP 两条路径，自然没 chronicle。

→ 修：kickoff 手动 append 一条 `author:"system" category:"task" content:"task_create [id] [draft]: title (auto from kickoff on #channel)"`。

commit：`17b5d80`（本次 commit）

### 6. `task_dispatch worker="@implementer"` 导致 `@@` 和潜在路由失败

`args.worker` 字符串被原样当成 `agentName` 塞进 attempt、instruction queue 和 chronicle。claude-code 习惯传带 `@` 前缀的名字（`@implementer`），orchestrator 按纯名（`implementer`）poll 队列——**实际上 dispatch instruction 根本没被 worker 的 queue 取到**。两次跑 worker 能工作纯粹是因为 maintainer 的 channel_send 里的 `@implementer` 被 inbox 路由唤醒了 worker。

→ 修：`task_dispatch` 入口直接 `args.worker.replace(/^@+/, "")`，两种写法统一路由。

commit：`17b5d80`（本次 commit）

## 尚未自动验证的东西

这一轮证明了：

- ✅ Prompt guidance → real model 会照做
- ✅ 状态机 draft→open→in_progress→completed 全链路走通
- ✅ Worker 重用 dispatch 给的 attempt id，没乱 `attempt_create`
- ✅ Artifact + handoff 正确落盘、归属正确
- ✅ Lead 通过 worker 的 channel_send 自然唤醒，不需要人工 poke
- ✅ onCheckpoint 的 task-ledger-delta 在 lead 的 prompt 里显示（lead 能直接引用 task id）
- ✅ file-backed state store 在真 workspace 下 replay 正确
- ✅ Chronicle 记录真任务流

还没验证的：

- Worker 崩溃/超时恢复（orphan attempt recovery 的单元测试覆盖了 daemon restart 路径，但不是真的崩溃）
- Compact PressureAction 在真 usage 压力下触发（这次任务太小根本没接近阈值）
- Multi-worker task（队列里同时有几个任务，lead 要调度）
- Re-dispatch 一个 failed attempt（换 worker 重试）
- Blocked 路径（worker 报阻塞，lead 决策换 worker 或 abort）
- 真正复杂的任务（多文件、跨目录、需要 git）

## 下次做什么

这次验证的最大发现是：**没有真的跑一次，你永远找不到这 6 个坑**。单元测试 + 自动 e2e（mock runtime 驱动）只证明"零件组装是对的"，证明不了"真 model 能按 prompt 走"。

下次：

1. 再跑一次做 regression（确认 6 个 fix 稳定）
2. 造一个稍微大一点的任务（比如 "在 packages/shared 加一个工具函数，写测试，改索引 export"）
3. 观察 compact PressureAction 能不能真的被触发（增大任务规模直到 context 压力）
4. 试一次 blocked 路径：让 worker 故意需要外部信息

## 关键 commit 列表

- `40bedba` fix: expose every workspace tool to claude-code via stdio MCP proxy
- `0815ea1` fixes from first real-runtime validation pass（maxTurns / worker channel_send / chronicle MCP path）
- 本次 commit：cosmetic dispatch cleanup + kickoff chronicle entry + validation pass writeup
