---
name: workspace-team
description: |
  Configure and manage the agent workspace team — a self-driving, proactive team of agents
  modeled after 三省六部制 (Three Departments and Six Ministries). Use this skill when the
  user wants to set up a workspace, adjust agent roles, change team composition, update the
  roadmap, review the chronicle, or tune how agents collaborate. Trigger on phrases like
  'workspace team', 'team config', 'agent roles', 'update roadmap', 'check chronicle',
  'adjust team', '调整团队', '团队配置', '工作空间', or when the user references _global.yml.
---

# Workspace Team: Self-Driving Agent Organization

This skill governs the design, configuration, and operation of the agent workspace team.
The team is modeled after the Chinese 三省六部制 — a system that evolved over centuries to
solve the fundamental problem of dividing labor between planning, decision-making, execution,
and oversight.

## Design Philosophy

### Why 三省六部制

Division of labor isn't arbitrary. Chinese bureaucratic history reveals that effective
organizations naturally separate into four functions:

| Function     | Origin      | Role                                    | Agent                      |
| ------------ | ----------- | --------------------------------------- | -------------------------- |
| 谋 (plan)    | 中书省      | Draft strategies, evaluate architecture | codex                      |
| 断 (decide)  | 门下省      | Review, approve, coordinate             | claude-code                |
| 行 (execute) | 尚书省      | Implement through specialization        | cursor, kimi-code, minimax |
| 监 (observe) | 史官/御史台 | Watch, record, surface patterns         | deepseek                   |

The key insight: these functions must be separated because combining them creates conflicts.
A planner who also executes will cut corners on planning. A reviewer who also plans will
rubber-stamp their own work. An executor who also reviews will skip self-criticism.

### Self-Driving vs Task-Driven

Unlike the `/team` skill (which is invoked per-task), this workspace team is **persistent
and proactive**:

- **claude-code** maintains a `roadmap` and identifies improvements without being asked
- **codex** thinks ahead — prerequisites, consequences, priority adjustments
- **executors** flag issues they notice while working (after completing their assigned task)
- **deepseek** surfaces recurring patterns as `insight` entries in the chronicle
- The feedback loop: chronicle insights → claude-code reads → roadmap updates → new tasks

## Configuration

The workspace config lives at `~/.agent-worker/workspaces/_global.yml`.

### Agent Roster

```
claude-code (宰相)     — runtime: claude-code, model: opus
  Orchestrator + strategic leader. Drives the project forward.

codex (中书)           — runtime: codex
  Planner + quality advocate. Thinks, never codes.

cursor (尚书·工)       — runtime: cursor, model: auto
  Fast builder. Multi-file features, prototyping.

kimi-code (尚书·吏)    — runtime: ai-sdk, model: kimi-code:kimi-for-coding
  Precise specialist. Focused single-module tasks.

minimax (尚书·礼)      — runtime: ai-sdk, model: minimax:MiniMax-M2.7
  Versatile support. Research, docs, gap-filling.

deepseek (史官)        — runtime: ai-sdk, model: deepseek:deepseek-chat
  Silent observer. Records to "chronicle" doc, surfaces insights.
```

### Team Documents

The team uses shared documents (via `team_doc_*` tools) for persistent state:

- **roadmap** — Strategic goals, priorities, current focus. Maintained by claude-code,
  reviewed and adjusted with input from codex.
- **chronicle** — Append-only log maintained by deepseek. Records decisions, plans, tasks,
  corrections, patterns, and insights. The team's institutional memory.

### Communication Patterns

- **Assignment**: claude-code tags specific agents — `@cursor implement phase 1...`
- **Completion**: executor tags claude-code — `@claude-code phase 1 done, found X`
- **Proactive observation**: executor mentions after task — `also noticed Y in adjacent code`
- **Planning**: codex shares via channel_send, never DMs the user directly
- **Chronicle**: deepseek writes to team_doc only, never sends channel messages

### Delegation Matrix

| Task Type                 | Primary   | Fallback    |
| ------------------------- | --------- | ----------- |
| Architecture planning     | codex     | claude-code |
| Multi-file feature        | cursor    | kimi-code   |
| Single module / algorithm | kimi-code | cursor      |
| Research / analysis       | minimax   | codex       |
| Documentation             | minimax   | codex       |
| Code review               | codex     | claude-code |
| Quick prototype           | cursor    | —           |

## Operations Guide

### Setting Strategic Direction

When the user provides a high-level goal:

1. claude-code writes/updates the `roadmap` team_doc
2. claude-code asks codex to break the goal into concrete plans
3. codex returns phased plan with file paths and dependencies
4. claude-code reviews, adjusts, approves
5. claude-code assigns phases to executors
6. deepseek records everything to the chronicle

### Proactive Improvement Cycle

When there's no active user task:

1. claude-code reads the chronicle for `insight` entries
2. claude-code scans the codebase for improvement opportunities
3. For low-risk, clearly beneficial improvements:
   - claude-code notes the improvement in the channel (context for the team)
   - Assigns to appropriate executor
   - Reviews result
4. For anything touching public APIs or architecture:
   - claude-code checks with the user first

### Reading the Chronicle

The chronicle is the team's memory. To get value from it:

```
team_doc_read("chronicle")
```

Look for:

- `insight:` entries — patterns deepseek has identified
- `correction:` entries — where the team changed course (learn from these)
- `pattern:` entries — recurring themes

### Adjusting the Team

Common adjustments to `_global.yml`:

**Add a new agent**: Add to the `agents:` map with runtime, model, and instructions.
Assign it a clear 尚书 specialty — don't create generalists that overlap with existing roles.

**Change the observer**: Swap deepseek for another low-cost model. The observer must:

- Use `no_action("observing")` for all inbox messages
- Write only to the chronicle via `team_doc_append`
- Never send channel messages

**Adjust proactivity**: If the team is too noisy with proactive suggestions, tighten the
instructions — e.g., "only flag issues that would cause bugs, not style preferences."
If too quiet, loosen — e.g., "suggest improvements whenever you see code that could be
cleaner, even if it works."

**Add channels**: For larger projects, split communication:

```yaml
channels:
  - general # coordination and announcements
  - planning # codex shares plans here
  - execution # executors report progress here
```

## Principles

1. **Separation of concerns is load-bearing.** Don't let planners code or executors
   self-review. The boundaries exist because combining functions creates blind spots.

2. **Proactivity has scope.** Agents suggest improvements but don't act outside their
   assigned scope uninvited. Flag → discuss → assign → execute.

3. **The chronicle is institutional memory.** Without the historian, the team forgets
   its own lessons. Protect this role even if it seems like overhead.

4. **Strategic goals flow down, insights flow up.** User → roadmap → plans → tasks →
   execution → chronicle → insights → roadmap adjustments. The loop must close.
