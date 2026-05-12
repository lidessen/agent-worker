# Handoff → Codex

**From:** Hermes (deepseek-v4-pro) | **Date:** 2026-05-12 04:30 UTC
**Status:** Core loop verified. 3 blockers before daily use.

## Where we are

agent-worker daemon starts, discovers 6 agents (codex/cursor/claude-code/deepseek/kimi-code/minimax), and Codex successfully processes tasks dispatched through the harness. The `task create → dispatch → agent runs in worktree → file created` path works end-to-end (verified live with hello.txt).

But results stay in isolated worktrees instead of appearing in the user's project, the direct-send path is broken (agent ignores messages), and `sendToHarness` crashes on the default harness. Three fixes unblock daily use.

## What's verified

- ✅ Daemon starts on port 7420, auto-discovers runtimes, creates global harness
- ✅ Codex v0.130.0 (gpt-5.5) authenticated and available as CLI backend
- ✅ `aw task new → aw task dispatch → codex` processes task in worktree, completes handoff
- ✅ Claude Code subscription paused — **do not use claude-code backend**
- ❌ Worktree results deleted with Wake, never surfaced to project dir
- ❌ `aw send codex "message"` → agent calls `no_action` (ignores notification format)
- ❌ `aw send @global#general "message"` → `TypeError: harness.harnessTypeId is undefined`

## Next action

Three changes, in order. Verify with live smoke test after all three.

### 1. Auto-merge worktree results

**File:** `packages/agent-worker/src/harness-registry.ts`
**Location:** `wake.terminal` event handler (~line 427–438). Currently runs `removeWorktree` immediately.

Before `removeWorktree`, insert:

```
git -C <repoPath> merge --no-ff <worktreeBranch>
```

- Exit 0 → merge succeeded → proceed to `removeWorktree`
- Non-zero → conflict → keep worktree alive, log error, skip cleanup
- Skip for chat-type harnesses
- Use `execa` with `reject: false`

### 2. `aw send <agent>` → auto task + dispatch

**File:** `packages/agent-worker/src/cli/commands/send.ts`
**Location:** Agent-only branch (~line 57–64), the `else if (target.agent)` block.

Replace the `client.sendToAgent(...)` call with:

1. `client.createHarnessTask("global", { title: first 50 chars of message, goal: full content })`
2. `client.dispatchHarnessTask("global", taskId, { worker: target.agent })`
3. Print `"Task <id> dispatched to @<agent>"`

Only change the agent-only path (no harness specified). Harness+agent path stays as-is.

### 3. Fix `sendToHarness` crash

**File:** `packages/agent-worker/src/daemon.ts`
**Location:** `handleSendToHarness` method. Find `handle.harness.harnessTypeId` access.

Add guard: `const typeId = handle.harness.harnessTypeId ?? "";` and use `typeId` instead of direct property access on the following lines.

### Verify

```bash
bunx tsgo -p packages/agent-worker/tsconfig.json
bun test packages/agent-worker/
aw daemon start -d
aw send codex "在项目根目录创建 smoke-test.txt，内容写 'smoke test passed'"
# Wait ~15s
stat smoke-test.txt  # Should exist
rm smoke-test.txt
aw daemon stop
```

## State to preserve

- Codex v0.130.0 with gpt-5.5 — **use this, not claude-code or cursor**
- Daemon currently stopped (port 7420)
- `~/.agent-worker/` is the data directory (default)
- The 3 prior `uncommitted` artifacts from earlier sessions (007 decision, coordination-substrate-cut blueprint, record entries) stay uncommitted — don't touch them
- Monitor (decision 004) is still unbuilt — not in scope for this handoff

## When done

- Move this file to `handoffs/archive/2026-05-12-hermes→codex.md`
- Add a closing entry to `goals/record.md` with results
- Commit the 3 changes + record entry
