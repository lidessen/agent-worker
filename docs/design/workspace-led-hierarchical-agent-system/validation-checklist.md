# Workspace-led Hierarchical Validation Checklist

日期：2026-04-13
目标：用一个 **真实** runtime（claude-code / codex）走通一次完整的
workspace-led hierarchical 路径，验证 prompt guidance 真的能让 agent 自主
使用 task ledger，而不是靠操作员手工 `aw task *` 驱动。

这是 handoff doc 里提的**剩余工作 #1**——从 "all tests green" 到
"真的能用来替代 Codex/Claude Code"之间的关键验证。

## 为什么这件事必须人工在场

自动化 e2e 测试已经验证 **链路组装是对的**（见 `packages/agent-worker/test/orchestrator.test.ts`
的 "end-to-end: lead dispatches → orchestrator delivers → worker closes"）。

**没验证过的是：真实模型在 prompt 里读到 guidance 后，会不会真的按规则做。**

这需要一个真的 API key + 一个真的 runtime + 一个人类观察它是不是按规则走。

## 前置条件

- `aw` CLI 可用（`bun run aw --help` 能跑）
- claude-code CLI 或 codex CLI 装好
- 对应 runtime 的认证完成：
  - claude-code: `aw auth anthropic` 或已有 `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`
  - codex: `codex` CLI 已登录
- 一个干净的 working directory（没有别的 workspace 抢端口 7420）

## 步骤

### 0. 启动守护进程

```bash
bun run aw daemon start -d
bun run aw status
```

预期：daemon 在 127.0.0.1:7420 运行，没有其它 workspace。

### 1. 创建验证 workspace

```bash
bun run aw create docs/design/workspace-led-hierarchical-agent-system/validation-workspace.yml
```

预期输出：workspace 名 `hierarchical-validation`，两个 agent（`maintainer`、`implementer`），都用 `claude-code` runtime。

### 2. 立即检查任务 ledger

```bash
bun run aw task ls @hierarchical-validation
```

预期：**正好 1 个任务**，状态 `draft`，source ref `kind=kickoff`，title 从 kickoff 消息的第一行截出来。

如果看到 0 个：kickoff 自动 draft 创建失败了，看 daemon 日志排查。  
如果看到 2+：重复 draft，说明 lead 已经被唤醒并自己又 create 了一个——prompt 里的 "check the ledger first" 指令没生效，**这是 validation 失败**。

### 3. 观察 lead 的决策

```bash
bun run aw log @hierarchical-validation -f
```

预期的事件序列（用 2-3 分钟观察）：

1. `workspace.kickoff` — kickoff 消息发出
2. `agent.run_start` (maintainer, run_number=1)
3. maintainer 调用了工具：
   - 可能先调 `task_list`（接受）
   - **不应该**调 `task_create`（已经有了）
   - 调 `task_update id=task_xxx status=open`
   - 调 `task_dispatch taskId=task_xxx worker=implementer`
   - 可能调 `channel_send` 回执（一句话）
4. `agent.run_end` (maintainer)
5. `agent.run_start` (implementer)
6. implementer 调用工具做实际工作：
   - `bash` / `writeFile` 写出 `greet.ts` 和 `greet.test.ts`
   - `bash` 跑 `bun test greet.test.ts` 验证
   - `artifact_create`（两个）
   - `handoff_create kind=completed`
   - `attempt_update status=completed`
7. `agent.run_end` (implementer)
8. maintainer 被 `onCheckpoint` 的 handoff delta 唤醒
9. `agent.run_start` (maintainer, run_number=2)
10. maintainer 读 handoff，可能 `channel_send` 结果，调 `task_update status=completed`
11. `agent.run_end` (maintainer)

### 4. 验证最终状态

```bash
bun run aw task ls @hierarchical-validation
```

预期：1 个任务，状态 `completed`。

```bash
bun run aw task get <task-id> @hierarchical-validation
```

预期：

- `task.status = completed`
- `attempts.length >= 1`，每个都 `status=completed` 或 `handed_off`
- `handoffs.length >= 1`，至少一个 `kind=completed`，summary 由 implementer 写
- `artifacts.length >= 2`，对应 `greet.ts` 和 `greet.test.ts`

```bash
# 检查真的产出了文件
ls ~/.agent-worker/workspaces/hierarchical-validation/sandbox/workspace/
# 预期: greet.ts 和 greet.test.ts 都在，内容正确
cat ~/.agent-worker/workspaces/hierarchical-validation/sandbox/workspace/greet.ts
```

```bash
bun run aw task get <task-id> @hierarchical-validation | grep -i "accept"
```

### 5. 读 chronicle

```bash
curl -sS http://127.0.0.1:7420/workspaces/hierarchical-validation/chronicle?category=task | jq .entries[].content
```

预期至少 4 条：

- `task_create`
- `task_update draft → open`
- `task_dispatch → @implementer`
- `task_completed`

## 成功标准

全部以下成立就算 validation 通过：

- [ ] 初始 `aw task ls` 正好 1 个 draft（kickoff auto-draft 有效）
- [ ] maintainer 没有重复创建 task（prompt 的 "check ledger first" 有效）
- [ ] maintainer 自主调用了 `task_update status=open` + `task_dispatch`
- [ ] implementer 重用了 dispatch 里的 attempt id（没调 `attempt_create`）
- [ ] implementer 实际产出了两个文件且测试通过
- [ ] implementer 调用了 `artifact_create` 和 `handoff_create kind=completed`
- [ ] implementer 调用了 `attempt_update status=completed`
- [ ] maintainer 在下一次 run_start 看到了 handoff delta（onCheckpoint 有效）
- [ ] maintainer 最终调用了 `task_update status=completed`
- [ ] 最终 `aw task get` 显示 status=completed，有 artifacts，有 handoffs
- [ ] chronicle 有对应的 4 条 task-category 条目

## 失败模式和可能的修复

**lead 重复 `task_create`**  
→ prompt 的 "check the ledger first" 需要更强硬。考虑在 workspacePromptSection 开头加入一段显式检查指令。

**lead 直接自己写代码没有 dispatch**  
→ `maintainer.instructions` 里 "you do NOT implement anything yourself" 不够强。加 few-shot 示例或显式禁止 `writeFile`。

**worker 调了 `attempt_create` 造新 attempt**  
→ worker 的 dispatch instruction body 可能不够显眼。在 `formatDispatchInstruction`（packages/workspace/src/context/mcp/task.ts）里把 attempt id 放到显眼位置（MD 粗体）。

**worker 忘了 `attempt_update status=completed`**  
→ 现在没有强制机制。将来的 profile resolver 可以在 handoff_create 成功后自动 stamp attempt；目前只能靠 prompt。

**onCheckpoint delta 里 lead 看不到 handoff**  
→ 检查 `buildLeadHooks` 的 `reportedHandoffIds` 逻辑（packages/workspace/src/loop/lead-hooks.ts）。有可能是 seeding 太激进把新 handoff 当成 baseline 了。

**maintainer 永远等不到 run 2**  
→ orchestrator 的 pollInterval 是 2000ms；等 30s 后如果还没下一次 run_start，说明它没有在等新 input。检查 maintainer 的 inbox + instruction queue 是否有新 entry。

## 失败时怎么清理

```bash
bun run aw rm @hierarchical-validation
rm -rf ~/.agent-worker/workspaces/hierarchical-validation/
```

然后改 prompt / config，重跑。

## Validation 通过后的下一步

接着做 handoff doc 里的 **剩余工作 #2**：错误恢复（worker 崩溃/超时/daemon 重启）。
