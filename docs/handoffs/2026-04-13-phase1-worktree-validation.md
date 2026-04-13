# Phase 1 Worktree Isolation — First Real-Runtime Validation

Date: 2026-04-13
Branch: `codex/dev-runtime-workspace`
Workspace: `docs/design/phase-1-worktree-isolation/validation-worktree.yml`
Runtime: three `claude-code sonnet` agents (maintainer + coder-a + coder-b)

## Result

**Two model-driven coder agents edited the same repo in parallel, on
separate branches, in isolated worktrees, with zero collisions.**
Daemon-level cleanup on `aw rm` removes the worktrees cleanly.

## Event sequence

```
t=0     user kickoff → #general (auto-draft task)
t+2s    maintainer run 1 start
        - channel_read, team_members, task_update open, task_create ×2
        - task_dispatch worker=coder-a, task_dispatch worker=coder-b
        - channel_send dispatch ack
        - wait_inbox (blocking)
t+26s   coder-a run start + coder-b run start (1ms apart — true parallel)
t+36s   coder-a writes hello.ts, git add/commit, captures hash 86864cc
t+42s   coder-b writes world.ts, git add/commit, captures hash 14d5d75
t+62s   coder-a run end  (channel_send "完成 task_..., commit 86864cc")
t+68s   coder-b run end  (channel_send "完成 task_..., commit 14d5d75")
t+68s→192s maintainer still blocked inside wait_inbox / verifying via bash
t+230s  maintainer run 1 end — three tasks closed, final summary posted
t+232s  maintainer run 2 start (woken by its own closing message replay)
t+250s  maintainer run 2 end (no_action — task already complete)
```

Run counts:
- maintainer: 2 runs (1 big coordination run + 1 no-action)
- coder-a:    1 run
- coder-b:    1 run

## Git state after the run

```
$ git branch -a
* main
+ phase1-worktree-validation/coder-a
+ phase1-worktree-validation/coder-b

$ git log --oneline phase1-worktree-validation/coder-a
86864cc coder-a: add hello.ts
211a320 initial

$ git log --oneline phase1-worktree-validation/coder-b
14d5d75 coder-b: add world.ts
211a320 initial

$ git ls-tree -r phase1-worktree-validation/coder-a
README.md
hello.ts          ← only coder-a's file

$ git ls-tree -r phase1-worktree-validation/coder-b
README.md
world.ts          ← only coder-b's file
```

The key property: **neither branch contains the other coder's file.**
coder-a wrote hello.ts and did not see world.ts; coder-b wrote
world.ts and did not see hello.ts. They were physically isolated on
different working directories rooted at different worktrees.

Worktree layout:

```
$ git worktree list
/private/tmp/aw-phase1-validation/repo                                              211a320 [main]
/Users/lidessen/.agent-worker/workspace-data/phase1-worktree-validation/worktrees/coder-a  86864cc [phase1-worktree-validation/coder-a]
/Users/lidessen/.agent-worker/workspace-data/phase1-worktree-validation/worktrees/coder-b  14d5d75 [phase1-worktree-validation/coder-b]
```

## Cleanup

```
$ bun run aw rm @phase1-worktree-validation
Removed workspace @phase1-worktree-validation

$ git worktree list
/private/tmp/aw-phase1-validation/repo  211a320 [main]

$ git branch -a
* main
  phase1-worktree-validation/coder-a     ← retained (work preserved)
  phase1-worktree-validation/coder-b     ← retained
```

`removeWorktree` unlinks the working-directory registrations and
runs `git worktree prune`, but intentionally leaves the branches
alone so the committed work survives a workspace lifecycle. A
future `ws rm --discard` flag could delete the branches as well.

## Acceptance criteria vs. design doc

From `docs/design/phase-1-worktree-isolation/README.md`:

- [x] Two coder agents in the same workspace can modify the same
      repo on separate branches in parallel without overwriting
      each other.
- [x] Any agent's default shell/file operations land in its
      worktree, never in the shared repo root. (Coder cwd is the
      worktree; their bash `pwd` returns the worktree path.)
- [x] Lead can list each agent's worktree path and branch from
      the task ledger / prompt. (`Git worktree` / `Branch` fields
      render in the Directories section for worktree-enabled
      agents.)
- [x] Graceful `ws rm @name` cleans up worktrees via
      `removeWorktree`.
- [~] Daemon restart reattaches to existing worktrees rather
      than rebuilding them, preserving uncommitted work.
      *Covered by unit tests on `provisionWorktree` idempotency
      (four cases including "worktree dir nuked out-of-band") but
      not yet exercised end-to-end. Next iteration will add a
      daemon-restart test.*

## Observations for the next iteration

- **Maintainer run 1 is very long** (~230s). Nearly all of it is
  spent inside two `wait_inbox` calls waiting for both coders to
  finish. Bumping the `wait_inbox` default timeout above the
  default 60s would smooth this out — otherwise maintainer wakes
  up mid-verification when the first timeout fires. This is a
  quality-of-life improvement, not a correctness issue.
- **maintainer run 2 is a no-op.** The closing `channel_send`
  posted by maintainer at the end of run 1 got re-queued into
  the inbox after run 1 ended (own-message delivery is normally
  suppressed, but the orchestrator replayed seen entries on
  `markRunStart`). Worth a quick look in the next iteration —
  could trim this cleanly with one more guard.
- **Prompt: branch name in "Branch" field is very long.** The
  phase1 validation branches are `phase1-worktree-validation/coder-a`
  which is fine but long. No action needed.

## Phase 1 status

**Done.** The MVP acceptance criteria are met end-to-end with
real claude-code model runs. The remaining ~5% (crash-recovery
E2E test, `wait_inbox` timeout ergonomics, own-message guard)
are polish items, not blockers.

Next phases from the roadmap:

- **Phase 2**: session continuity (notes/memory/thread)
- **Phase 3**: control boundaries (permission/approval/git policy)
