---
name: dev-eval
description: |
  Run comparative development evaluations: assign the same task to agent-worker team AND
  claude-code (team subagents), then have an evaluator agent score both and a reviewer agent
  verify the evaluation. Fully orchestrated — you coordinate all phases, agents notify via
  channel/callback when done. Use this skill when the user wants to benchmark agent-worker
  vs claude-code, run a dev eval, compare agent performance, or prove that the workspace
  team outperforms solo agents. Trigger on phrases like 'dev eval', 'run eval', 'compare
  performance', 'benchmark', '对比评估', '开发评估', '跑评估', 'eval iteration', '/dev-eval'.
---
> **CLI path**: All bash code blocks use `$AW_CMD` for the agent-worker CLI.
> Define it at the start of any shell session before running commands:
> ```bash
> AW_CMD="/Users/lidessen/.bun/bin/bun /Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/cli/index.ts"
> ```


> **Statistical significance notice**: A single eval run is anecdotal. Conclusions require
> ≥3 independent runs of the same task config before attributing score differences to
> architecture rather than noise. Track runs in SUMMARY.md and note N before drawing
> conclusions.

# Dev Eval: Comparative Development Evaluation

Run the **same development task** through two execution paths **in parallel**, then have
agents evaluate and review the results.

```
                    ┌─────────────────────┐
                    │   Task Specification │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
 ┌──────────────────────┐       ┌──────────────────────────┐
 │  Agent-Worker Team   │       │  Claude-Code Team Agents  │
 │  $AW_CMD run eval.yaml    │       │  (Plan → Impl → Review)   │
 │  (both in worktrees) │       │  isolation: "worktree"     │
 └──────────┬───────────┘       └─────────────┬────────────┘
            │ ← process exits                 │ ← agent returns
            │                                 │
            └──────────────┬──────────────────┘
                           ▼
              ┌─────────────────────────┐
              │   Evaluator Agent       │
              │   (scores both sides)   │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │   Review Agent          │
              │   (validates scoring)   │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │   Final Report          │
              └─────────────────────────┘
```

## Phase 0: Task Definition

Write a task spec **as a file**. Both sides get identical instructions via file reference.

```markdown
# Eval Task: [slug]

## Task
[one-line summary]

## Requirements
- [requirement 1]
- [requirement 2]

## Acceptance Criteria
- [criterion 1]
- [criterion 2]

## Tier
T1 / T2 / T3
```

Save to `.agent-workspace/evals/YYYY-MM-DD-{slug}/task-spec.md`.

**IMPORTANT**: Always save the task spec as a file first. The workspace YAML reads it
via a `setup` step (`cat task-spec.md`) to avoid shell escaping issues with `--var`.

## Blind-Test Mechanism

Before passing artifacts to the evaluator, randomly assign neutral labels
to prevent anchoring bias:

```bash
# Randomly assign Solution A/B labels (50/50)
if [ $(($RANDOM % 2)) -eq 0 ]; then
  LABEL_TEAM="Solution A"; LABEL_SOLO="Solution B"
else
  LABEL_TEAM="Solution B"; LABEL_SOLO="Solution A"
fi

# Save mapping for post-eval reveal
echo "LABEL_TEAM=$LABEL_TEAM" > $EVAL_DIR/blind-mapping.txt
echo "LABEL_SOLO=$LABEL_SOLO" >> $EVAL_DIR/blind-mapping.txt
```

Pass **only** `$LABEL_TEAM` / `$LABEL_SOLO` labels to the evaluator — never
mention "agent-worker", "team", or "solo". After the evaluator returns scores,
reveal the mapping and rewrite the scorecard with real names.

## Baseline Isolation

**Both sides run in git worktrees** to ensure clean, auditable comparisons.

Before launching either run, record the baseline:

```bash
EVAL_DIR=.agent-workspace/evals/YYYY-MM-DD-slug
BASELINE_SHA=$(git rev-parse HEAD)
echo "$BASELINE_SHA" > $EVAL_DIR/baseline-sha.txt
git status --porcelain > $EVAL_DIR/baseline-status.txt
```

- **Agent-Worker Team**: `aw run` operates in the main repo by default, but we create
  a worktree for it (see Path A below) so its diff is clean.
- **Claude-Code Team**: Agent tool with `isolation: "worktree"` — already isolated.

Both diffs are computed as `git diff $BASELINE_SHA` inside their respective worktrees.
This guarantees the patches contain only changes from that specific run.

## Known Limitations

**`aw run` task mode does not auto-complete.** Workspace agent loops never self-stop —
they poll inbox indefinitely. `checkCompletion()` checks `loop.isRunning` which is
always `true` for active orchestrators. As a result, `aw run --wait` always times out.
**Use service mode (`aw create`) + manual completion detection** until this is fixed.

**Kickoff message length limit.** Channel send guard rejects messages > 1200 chars.
Do NOT inline task content in kickoff via `${{ task }}`. Instead, reference the file
path and let agents read it themselves.

**Solo diff baseline.** The Agent tool's `isolation: "worktree"` creates a worktree
from the current branch. Use `git diff HEAD` inside the solo worktree (not `git diff
$BASELINE_SHA`) to capture only the solo agent's changes.

**deepseek runtime**: Use `deepseek:deepseek-chat` as the model string with `runtime: ai-sdk`. Ensure `DEEPSEEK_API_KEY` is set in the environment.

**T1 tasks: skip team structure.** T1 tasks (add CLI command, fix bug, small config)
are too simple to benefit from team coordination. The orchestration overhead consistently
costs 1-2 points vs solo. Run T1 tasks as solo-only evals or skip Run A entirely.

**kimi-code model string**: Use `kimi-code:kimi-for-coding` (NOT `moonshot:moonshot-v1-auto`).
The `moonshot` provider is not registered — it will fail with "Unknown provider: moonshot".

**Pre-check runtimes** before starting an eval. Run `aw ls` to confirm all configured
agents are idle. Test each runtime independently if in doubt.

## Phase 1: Parallel Execution

Launch **both runs simultaneously**. You (the orchestrator) manage both.

### Path A: Agent-Worker Team — two modes

#### Option 1: `aw run` (task mode — CURRENTLY BROKEN)

Generate a workspace YAML config. The process blocks until all agents finish.

**CRITICAL**: `aw run` auto-removes the workspace after completion (`mode: "task"`).
You must configure `data_dir` to persist logs, AND start a parallel log capture process
BEFORE running, so artifacts survive workspace removal.

**Workspace isolation**: Create a git worktree for the team run so its diff is clean:

```bash
EVAL_DIR=.agent-workspace/evals/YYYY-MM-DD-slug
TEAM_WORKTREE=/tmp/eval-team-$(date +%s)

# Use --detach to avoid creating a named branch — prevents conflicts on re-runs.
# A named branch like "eval-team-tmp" would persist after worktree removal and
# block the next `git worktree add -b eval-team-tmp` with "branch already exists".
git worktree add --detach $TEAM_WORKTREE $BASELINE_SHA
echo "$TEAM_WORKTREE" > $EVAL_DIR/team-worktree-path.txt
```

```yaml
# .agent-workspace/evals/YYYY-MM-DD-slug/eval-workspace.yaml
name: eval-team

# Persist event logs to disk — survives workspace auto-removal
data_dir: .agent-workspace/evals/YYYY-MM-DD-slug/workspace-data

agents:
  claude-code:
    runtime: claude-code
    model: sonnet
    instructions: |
      You are the orchestrator (宰相). Break down the task, assign subtasks to
      the other agents, review their outputs, and coordinate to completion.

      Review is only valuable when it closes the loop. Finding a bug and then
      stopping is equivalent to not reviewing at all — the codebase ends up in
      the same broken state. A complete review cycle is:
      review → find issue → delegate fix to implementer → implementer fixes →
      you verify the fix → only then declare done.
      If you exit after finding issues without fixing them, the team's effort
      produces no better outcome than working alone.

      IMPORTANT — Completion protocol:
      1. Do NOT stop until ALL subtasks are implemented AND reviewed.
      2. If review finds issues, assign fix tasks back to the implementer and
         re-review after fixes land. Repeat until all dimensions pass.
      3. After ALL dimensions pass, post EVAL_COMPLETE_TEAM to general channel.
         If blocked and cannot complete, post EVAL_COMPLETE_TEAM status=blocked
         reason=<why> so the run can be scored.
      4. You must be the LAST agent to stop. Verify all others are done first.

  kimi-code:
    runtime: ai-sdk
    model: kimi-code:kimi-for-coding
    instructions: |
      You are an executor. Complete the subtasks assigned by @claude-code.
      Report back when done. Do NOT stop until @claude-code confirms your work.

      Before implementing, confirm TypeScript types by reading the relevant
      source files. Do NOT use `as any` casts — find the correct type first.

channels:
  - general
  - code-review

# Read task from file — avoids shell escaping issues with --var
setup:
  - shell: cat ${{ eval_dir }}/task-spec.md
    as: task

kickoff: |
  @claude-code 以下是开发任务，请分解并协调团队完成：

  ${{ task }}

  项目路径: ${{ project_path }}
```

Then run with **parallel log capture**:

```bash
EVAL_DIR=.agent-workspace/evals/YYYY-MM-DD-slug

# 1. Start parallel event log capture BEFORE $AW_CMD run (run_in_background)
#    Use workspace key "eval-team" — must match YAML name field.
#    If using --tag, key becomes "eval-team:tag-value".
#    MUST use -f (--follow) for SSE streaming mode — without it, $AW_CMD log does a
#    one-shot read of existing events and exits immediately.
$AW_CMD log @eval-team -f --json > $EVAL_DIR/team-log.jsonl

# 2. Run workspace as task (run_in_background)
$AW_CMD run $EVAL_DIR/eval-workspace.yaml \
  --var eval_dir="$EVAL_DIR" \
  --var project_path="$TEAM_WORKTREE" \
  --wait 30m
```

**Log capture timing**: `aw log @eval-team -f` opens an SSE stream that waits for the
workspace to appear if it doesn't exist yet. The daemon creates the workspace on
`aw run`, and the log stream attaches as soon as the workspace key becomes available.
Start the log process first to avoid missing early events. The `-f` flag is **required**
— without it, `aw log` does a one-shot read of existing events and exits immediately,
which will produce an empty or incomplete log file.

**Why parallel log capture?** `aw run` with `mode: "task"` auto-removes the workspace
on completion. After removal, `aw log` and MCP tools can no longer access workspace
data. The `data_dir` config persists raw data files, and the parallel `aw log -f --json`
pipe captures the streaming event log before the workspace disappears.

**Completion**: `aw run` exits with:
- `0` — all agents stopped naturally (completed)
- `1` — a loop errored (failed)
- `2` — `--wait` timeout exceeded

**Completion safety**: `checkCompletion()` triggers when ALL agent loops stop running.
The orchestrator prompt explicitly requires @claude-code to be the **last to stop**
and to verify all work is done first. This prevents premature completion where an
executor stops but hasn't received review feedback yet.

Use `--tag` to run the same config multiple times:

```bash
# With tag, workspace key becomes "eval-team:iter-1"
# Log capture must match: $AW_CMD log @eval-team:iter-1 -f --json
$AW_CMD run eval-workspace.yaml --tag iter-1 --var eval_dir="..." --wait 30m
$AW_CMD run eval-workspace.yaml --tag iter-2 --var eval_dir="..." --wait 30m
```

#### Option 2: Service mode (RECOMMENDED until aw run is fixed)

Create a workspace with `aw create`, send the task, and monitor for completion.
This mode does NOT auto-remove — you can collect artifacts at leisure.

**Target syntax**: `agent@workspace[#channel]` — see [target.ts](packages/agent-worker/src/cli/target.ts).

```bash
# 1. Verify workspace is running
$AW_CMD ls

# 2. Send task to the orchestrator agent within the workspace
#    Syntax: agent@workspace — "claude-code" is the agent, "eval-team" is the workspace
$AW_CMD send "claude-code@eval-team" "$(cat .agent-workspace/evals/.../task-spec.md)

完成后请在 general 频道发送: EVAL_COMPLETE_TEAM

项目路径: /path/to/worktree"
```

**Completion detection** (service mode needs explicit signals):

```bash
# Option A: Read workspace channel — must scope to workspace
$AW_CMD read "@eval-team#general" 5   # look for EVAL_COMPLETE_TEAM

# Option B: Check all agents idle via MCP
agents               # all idle = likely done

# Option C: Block-wait via MCP (best for background)
wait_inbox           # run_in_background, notified on completion
```

### Path B: Claude-Code Team Agents (worktree)

Use the **Agent tool** with `isolation: "worktree"` to run a full team pipeline
(Planner → Implementer → Reviewer) in an isolated git worktree. This mirrors what
the `/team` skill does, but in isolation.

```
Agent(
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: """
  You are executing a development task using the team pipeline approach.
  Follow the Planner → Implementer → Reviewer flow.

  ## Task
  [paste task-spec.md content here]

  ## Instructions
  1. PLAN: Analyze the codebase. Produce an implementation plan with phases,
     files to modify, and key changes.
  2. IMPLEMENT: Execute each phase. Read files before modifying.
     Follow existing patterns and conventions from CLAUDE.md.
  3. REVIEW: After implementation, review your own changes for correctness,
     completeness, and code quality. Fix any critical issues.
  4. COMMIT: After completing implementation and tests, commit all changes:
     git add -A && git commit -m "feat: <brief task description>"
  5. REPORT: When done, output a structured completion report:
     - Files changed (with paths)
     - Tests added/modified
     - Key design decisions
     - Any issues encountered and how resolved
     - Time taken per phase (estimate)
     - Total tool calls made (count from your conversation)

  You may spawn sub-agents (Plan, general-purpose, feature-dev:code-reviewer)
  to parallelize. Use the same flow as the /team skill.
  """
)
```

The Agent tool **returns when done** — this is the natural completion signal.

### Parallelism

Launch both paths in the **same message** using parallel tool calls:

```
# Step 0 (before both runs): record baseline + create team worktree + save task spec
git rev-parse HEAD > baseline-sha.txt
git worktree add --detach /tmp/eval-team-$(date +%s) $(cat baseline-sha.txt)
Write task-spec.md to the eval dir

# Step 1 (parallel):
#   Bash (run_in_background): start log capture (MUST use -f for streaming)
#     $AW_CMD log @eval-team -f --json > $EVAL_DIR/team-log.jsonl
#   Bash (run_in_background): $AW_CMD run
#     $AW_CMD run $EVAL_DIR/eval-workspace.yaml --wait 30m
#   Agent (worktree): Claude-Code team pipeline
#     Agent(isolation: "worktree", prompt: "...")
```

The `aw run` Bash command blocks in background until workspace completes.
The Agent tool blocks until the worktree agent finishes.
You get notified when each completes — no polling needed.

While both run, you can optionally monitor workspace progress:
```
$AW_CMD ls                               → workspace status
$AW_CMD read "@eval-team#general" 5      → recent channel messages
```

## Phase 2: Collect Artifacts

After both complete, gather the evidence for evaluation.

### Agent-Worker artifacts

```bash
EVAL_DIR=.agent-workspace/evals/YYYY-MM-DD-slug
TEAM_WORKTREE=$(cat $EVAL_DIR/team-worktree-path.txt)
BASELINE_SHA=$(cat $EVAL_DIR/baseline-sha.txt)

# Event log — already captured by parallel log process
# $EVAL_DIR/team-log.jsonl

# Metrics summary from captured log
cat $EVAL_DIR/team-log.jsonl | bun .claude/skills/dev-eval/scripts/eval-metrics.ts \
  > $EVAL_DIR/team-metrics.txt

# Code diff from team worktree (clean — only this run's changes)
cd $TEAM_WORKTREE && git diff $BASELINE_SHA > $EVAL_DIR/diff-team.patch

# Persistent workspace data (from data_dir config)
ls $EVAL_DIR/workspace-data/   # run logs, agent state, etc.

# Cleanup team worktree after capturing artifacts.
# --force is needed because agents leave uncommitted changes in the worktree.
# The diff was already captured above, so it's safe to discard.
git worktree remove --force $TEAM_WORKTREE
```

**Note on `aw run` mode**: By this point the workspace is already removed. All data
comes from: (1) the parallel log capture file, (2) the `data_dir` persistent storage,
and (3) the git diff from the team worktree.

**Note on service mode**: Workspace is still alive — you can also use MCP tools:
```
channel_read(channel: "general", limit: 200)
events(limit: 200)
agent_activity(agent: "claude-code", limit: 50)
```

### Claude-Code artifacts

The worktree agent returns:
- Its completion report (inline in result)
- The worktree path + branch (from isolation)

```bash
SOLO_WORKTREE=[worktree-path from agent result]

# Code diff from solo worktree — use HEAD (not BASELINE_SHA!) because the
# Agent tool's worktree branches from the current branch tip. Diffing against
# BASELINE_SHA would include all branch divergence, not just the solo agent's work.
cd $SOLO_WORKTREE && git diff HEAD > $EVAL_DIR/diff-solo.patch
git log --oneline --all > $EVAL_DIR/solo-commits.txt
```

### Evidence symmetry

Both sides must provide **comparable** evidence for fair evaluation. The orchestrator
should normalize artifacts before passing them to the evaluator:

| Evidence type | Run A (Team) | Run B (Solo) | How to align |
|--------------|-------------|-------------|-------------|
| Code diff | `diff-team.patch` | `diff-solo.patch` | Both from worktrees against same baseline SHA ✅ |
| Process log | `team-log.jsonl` (event stream) | Agent tool conversation (not captured) | Extract: total tool calls, errors, phases, duration from both |
| Activity log | `aw log` events: messages, tool calls, status changes, errors per agent | Agent return value (self-reported) | Team has full observability; Solo is self-reported. Note asymmetry. |
| Completion report | Channel messages (general) | Agent return value | Both should list: files changed, tests, decisions, issues |
| Cost | Event log has token/usage data | Agent doesn't report tokens | Note as "unavailable" for Run B; don't score what you can't measure |

**Rule**: If a metric is unavailable for one side, mark it "N/A" in the scorecard
rather than guessing. The evaluator scores only what evidence supports.

### Activity log analysis

The team's event log (`team-log.jsonl`) is a rich source of process-quality signals
beyond the final diff. When preparing evidence for the evaluator, extract:

**Collaboration quality:**
- Message flow: who @mentioned whom, response latency between agents
- Task handoffs: did the orchestrator decompose clearly? Did executors stay in scope?
- Review loops: how many review cycles? What got caught?

**Autonomy signals:**
- Error → recovery patterns: did agents self-recover or get stuck?
- Idle gaps: long periods with no events = agent likely stuck
- Repeated tool calls on same file = potential thrashing

**Efficiency signals:**
- Parallel activity: overlapping timestamps across agents = concurrent work
- Total events per agent: high count on one agent = unbalanced load
- Tool call success rate: failures / total = quality of approach

Use the metrics script to extract these automatically:
```bash
cat $EVAL_DIR/team-log.jsonl | bun .claude/skills/dev-eval/scripts/eval-metrics.ts
```

For the Solo side, the Agent tool return value is the only process evidence.
Require the solo agent to self-report (via the REPORT step in its prompt):
tool call count, phases completed, errors encountered, and time estimates.
This is less reliable than observed data but the best available.

## Phase 3: Evaluator Agent

Spawn an **Evaluator Agent** that scores both runs. This agent receives all artifacts
and produces the scorecard. It does NOT see which side it's "supposed" to favor — the
evaluation must be honest.

```
Agent(
  subagent_type: "general-purpose",
  prompt: """
  You are an impartial development evaluation judge. Score two parallel
  development runs that completed the same task.

  ## Task Specification
  [task-spec.md content]

  ## Run A
  - Process summary: [extracted from team-log.jsonl: phases, tool calls, errors, duration]
  - Activity log highlights: [key events — message flow between agents, task handoffs,
    review cycles, error→recovery patterns, idle gaps, parallel activity timestamps]
  - Completion report: [final summary from general channel]
  - Code diff: [diff-team.patch content or summary]
  - Human interventions: N
  - Wall-clock time: Xm

  ## Run B
  - Process summary: [extracted from agent conversation: phases, tool calls, errors, duration]
  - Activity log: [self-reported — tool call count, errors, phase timing. NOTE: less
    reliable than observed data; weight accordingly]
  - Completion report: [agent's structured report]
  - Code diff: [diff-solo.patch content or summary]
  - Human interventions: N
  - Wall-clock time: Xm

  ## Scoring Rubric (1-5 per dimension)

  **Autonomy**: How independently did it complete? Self-recovery from errors?
  - 1: Blocked entirely — required human to unblock every step
  - 2: Stuck once — required one human nudge to continue
  - 3: Minor nudges — asked clarifying questions but self-directed
  - 4: Fully autonomous — completed without intervention
  - 5: Self-recovered + proactive — caught and fixed own errors, anticipated edge cases

  **Quality**: Correctness, tests, code review findings?
  - 1: Broken — tests fail or core requirement unmet
  - 2: Works but messy — functional but with bugs or missing tests
  - 3: Functional — all requirements met, basic test coverage
  - 4: Clean + tested — solid implementation, good test coverage, handles edge cases
  - 5: Exceptional — production-ready, comprehensive tests, handles all edge cases

  **Speed**: Wall-clock efficiency, parallelism utilized?
  - 1: >5x slower than expected for the task complexity
  - 2: 2-5x slower — significant sequential bottlenecks
  - 3: Expected duration for the task tier
  - 4: Faster than expected — good parallelism or efficient tool use
  - 5: Much faster — optimal parallelism, minimal wasted steps

  **Maintainability**: Code readability, naming, structure, test coverage for future changes?
  - 1: Unreadable — magic values, no structure, zero tests
  - 2: Partially readable — some naming issues, minimal tests
  - 3: Readable — consistent style, basic test coverage
  - 4: Clean — clear abstractions, good test coverage, easy to extend
  - 5: Exemplary — self-documenting, comprehensive tests, designed for change

  **Completeness**: Requirements coverage, edge cases?
  - 1: Major gaps — core requirements unmet
  - 2: Core only — primary requirements done, secondary ignored
  - 3: All requirements — full spec coverage
  - 4: + edge cases — spec coverage plus error handling and edge cases
  - 5: + proactive improvements — spec plus meaningful enhancements not asked for

  **Cost**: Token/resource efficiency relative to output quality?
  - 1: >10x wasteful — enormous token spend for minimal output
  - 2: 3-10x wasteful — clearly over-engineered approach
  - 3: Reasonable — proportionate token use for output quality
  - 4: Efficient — achieved equivalent quality with notably fewer tokens
  - 5: Remarkably efficient — high output quality per token
  - If cost data is unavailable for a side, mark N/A and exclude from total.

  ## Output Format

  Produce EXACTLY this format:

  ### Scorecard

  | Dimension     | Run A | Run B | Delta | Justification |
  |---------------|:---:|:---:|:---:|---|
  | Autonomy      | X/5 | X/5 | +/-N | [why, citing specific evidence] |
  | Quality       | X/5 | X/5 | +/-N | [why] |
  | Speed         | X/5 | X/5 | +/-N | [why] |
  | Maintainability | X/5 | X/5 | +/-N | [why] |
  | Completeness  | X/5 | X/5 | +/-N | [why] |
  | Cost          | X/5 or N/A | X/5 or N/A | +/-N | [why, or "insufficient data"] |
  | **TOTAL**     | **/N** | **/N** | **+/-N** | (denominator excludes N/A dimensions) |

  ### Analysis
  - Where Run A excelled: ...
  - Where Run B excelled: ...
  - Key improvement suggestion for Run A: ...
  - Key improvement suggestion for Run B: ...

  ## Rules
  - Score ONLY from evidence. If you can't determine a score from the artifacts, use N/A.
  - Do NOT assume either side should win. Judge purely on what the diffs and logs show.
  - Every score must cite specific evidence (file names, error counts, timing data).
  - A higher agent count does NOT automatically mean better collaboration.
  - A solo agent with effective sub-agent decomposition deserves full collaboration credit.
  """
)
```

## Phase 4: Review Agent

Spawn a **Review Agent** to validate the evaluator's scoring. This catches bias,
scoring errors, and missed observations.

```
Agent(
  subagent_type: "feature-dev:code-reviewer",
  prompt: """
  Review this development evaluation for accuracy and fairness.

  ## Original Task
  [task-spec]

  ## Evaluator's Scorecard
  [scorecard from Phase 3]

  ## Raw Evidence
  - Run A diff: [summary]
  - Run B diff: [summary]

  ## Check For
  1. **Scoring accuracy** — Does each score match the justification?
  2. **Evidence support** — Is every claim backed by the artifacts?
  3. **Structural bias** — Does the rubric or framing unfairly advantage one side?
     (e.g., scoring format advantages, asymmetric evidence availability)
  4. **Missing observations** — Did the evaluator miss something important in the diffs?
  5. **Actionable insights** — Are the improvement suggestions specific and implementable?

  Output:
  - APPROVED if the evaluation is fair and accurate
  - REVISED SCORES if you disagree (with justification for each change)
  - Key additional observations the evaluator missed
  """
)
```

## Phase 5: Gap Report

After scoring, spawn a **Gap Analysis Agent** to identify systematic weaknesses
in the agent-worker team and propose concrete improvements.

```
Agent(
  subagent_type: "general-purpose",
  prompt: """
  Analyze this development evaluation and produce a Gap Report for the
  agent-worker team. Focus on root causes and actionable improvements.

  ## Scorecard
  [scorecard from Phase 3/4]

  ## Event Log Highlights
  [team-metrics.txt content]

  ## Report Structure

  ### Weakest Dimensions (ranked)
  List dimensions where agent-worker scored lowest, with delta vs solo.

  ### Root Cause Analysis
  For each weak dimension, identify WHY it underperformed:
  - Prompt deficiency (agent didn't know what to do)
  - Coordination overhead (multi-agent tax)
  - Model capability gap (wrong model for the role)
  - Infrastructure issue (tool failures, timeouts)
  - Task mismatch (wrong tier for team approach)

  ### Improvement Recommendations
  For each root cause, ONE specific change to the workspace YAML:
  - Quote the exact line to change
  - Show before/after
  - Estimated impact (high/medium/low)

  ### Team Composition Assessment
  Was this the right team for this task tier?
  If not, suggest a leaner alternative configuration.

  ### Next Eval Priority
  What single change would most improve the score if re-run?
  """
)
```

Save output to `$EVAL_DIR/gap-report.md`.

## Phase 6: Final Report

Compile everything into the eval directory:

```
.agent-workspace/evals/YYYY-MM-DD-{slug}/
  task-spec.md              # The task definition
  baseline-sha.txt          # Git SHA before both runs
  baseline-status.txt       # Working tree status before runs
  eval-workspace.yaml       # Workspace config used
  team-log.jsonl            # Agent-worker event log (from parallel capture)
  team-metrics.txt          # eval-metrics.ts output
  workspace-data/           # Persistent workspace data (from data_dir)
  solo-report.md            # Claude-code completion report
  diff-team.patch           # git diff from team worktree (clean)
  diff-solo.patch           # git diff from solo worktree (clean)
  scorecard.md              # Evaluator's scorecard (possibly revised)
  review.md                 # Review agent's assessment
  gap-report.md             # Gap analysis and improvement recommendations
```

Update the running summary:

```
.agent-workspace/evals/SUMMARY.md

| Date | Task | Tier | Team | Solo | Delta | Config | Key Insight |
|------|------|------|------|------|-------|--------|-------------|
```

## Notification Mechanism

How each side signals completion:

| Side | Mode | Signal | How to detect |
|------|------|--------|---------------|
| **Agent-Worker** | `aw run` (task) | Process exits with status 0/1/2 | Bash `run_in_background` — notified on exit |
| **Agent-Worker** | service | `EVAL_COMPLETE_TEAM` in channel | `aw read "@eval-team#general" 5` |
| **Agent-Worker** | service (backup) | All agents idle | `agents` MCP tool |
| **Claude-Code** | worktree | Agent tool returns | Natural — return value contains report |
| **Evaluator** | — | Agent tool returns | Parse scorecard from return |
| **Reviewer** | — | Agent tool returns | APPROVED or REVISED SCORES |

**`aw run` is the preferred mode** because:
- Exit code = completion status (0=done, 1=failed, 2=timeout)
- `--tag` allows re-running the same config for iterations
- `--wait 30m` prevents indefinite hanging
- No need for channel polling or explicit completion markers

**Caveat**: `aw run` auto-removes workspace on completion. Mitigated by:
1. `data_dir` in YAML config → persists workspace data to disk
2. Parallel `aw log @eval-team -f --json` pipe → captures event stream before removal
3. Git diff captured from team worktree → not affected by workspace removal

## CLI Target Syntax Reference

The `aw` CLI uses a unified target syntax: `[agent][@workspace[:tag]][#channel]`

```
$AW_CMD send "claude-code@eval-team" "msg"      # send to agent in workspace
$AW_CMD send "@eval-team" "msg"                  # send to workspace (kickoff channel)
$AW_CMD read "@eval-team#general" 10             # read workspace channel
$AW_CMD log @eval-team -f --json                 # stream workspace events (SSE)
$AW_CMD log @eval-team:iter-1 -f --json          # stream tagged workspace events
```

See [target.ts](packages/agent-worker/src/cli/target.ts) for full grammar.

## Evaluation Dimensions

| Dimension | What to measure |
|-----------|----------------|
| **Autonomy** | Human interventions, stuck episodes, self-recovery |
| **Quality** | Correctness, test pass rate, review findings |
| **Speed** | Wall-clock time from start to completion |
| **Maintainability** | Code readability, structure, naming, test coverage for future changes |
| **Completeness** | Requirements coverage, edge cases handled |
| **Cost** | Total tokens/API calls consumed (N/A if unavailable) |

**No pre-assumed advantages.** The eval measures what actually happened, not what
the architecture theoretically enables. The whole point is to discover — with evidence
— whether and when the team approach outperforms solo.

## Task Tiers

| Tier | Examples |
|------|----------|
| **T1** (simple) | Add CLI command, fix known bug, add config option |
| **T2** (medium) | New feature 3-5 files, refactor with cross-cutting concerns |
| **T3** (complex) | New subsystem, multi-package change, perf optimization |

**Start with T2** — that's where the comparison is most interesting.

### Dimension Weights by Tier

Different tiers weight dimensions differently. Apply multipliers when
computing weighted totals (optional — useful for trend analysis):

| Dimension | T1 weight | T2 weight | T3 weight |
|-----------|:---------:|:---------:|:---------:|
| Autonomy | 1.0 | 1.5 | 2.0 |
| Quality | 2.0 | 2.0 | 2.0 |
| Speed | 1.5 | 1.0 | 0.5 |
| Maintainability | 0.5 | 1.5 | 2.0 |
| Completeness | 2.0 | 2.0 | 2.0 |
| Cost | 0.5 | 1.0 | 1.5 |

**T1**: Speed and quality matter most — overhead dominates.
**T2**: Balanced — autonomy and maintainability start to differentiate.
**T3**: Autonomy and maintainability dominate — system-level quality shows here.

## Team Design Iteration

The eval isn't just about comparing scores — it's a feedback loop for **finding the
ideal workspace team design**: agent prompts, role division, team composition, and
coordination patterns.

### What to iterate on

Each eval produces a scorecard + reviewer analysis. Extract **specific** improvement
actions for the workspace YAML:

| Signal in scorecard | What to change in YAML |
|---------------------|----------------------|
| Low **Autonomy** — agents got stuck, waited | Strengthen agent instructions: add self-unblocking rules, error recovery steps |
| Low **Quality** — bugs, missing tests | Add a dedicated reviewer agent, or strengthen review in orchestrator prompt |
| Low **Speed** — sequential when could be parallel | Restructure roles so more work can happen concurrently |
| Low **Maintainability** — messy code, missing tests | Add reviewer agent or strengthen review prompt; require test coverage in done criteria |
| Low **Completeness** — missed requirements | Add requirement-checking step in orchestrator's completion protocol |
| High **Cost** — too many tokens for the result | Reduce agent count, use cheaper models for simple roles, tighten prompts |

### Team composition experiments

The workspace YAML is the experiment config. Try different team shapes:

```yaml
# Experiment A: 3 agents, orchestrator + 2 executors (baseline)
agents:
  claude-code: { runtime: claude-code, model: sonnet }  # orchestrator
  kimi-code:   { runtime: ai-sdk, model: kimi-code:kimi-for-coding }  # executor
  deepseek:    { runtime: ai-sdk, model: deepseek:deepseek-chat }  # executor

# Experiment B: 4 agents, add dedicated reviewer
agents:
  claude-code: { runtime: claude-code, model: sonnet }    # orchestrator
  coder-1:     { runtime: ai-sdk, model: deepseek:deepseek-chat }  # executor
  coder-2:     { runtime: ai-sdk, model: kimi-code:kimi-for-coding }   # executor
  reviewer:    { runtime: claude-code, model: haiku }     # reviewer only

# Experiment C: 2 agents, lean team for T1/T2 tasks
agents:
  claude-code: { runtime: claude-code, model: sonnet }    # orchestrator + reviewer
  coder:       { runtime: ai-sdk, model: deepseek:deepseek-chat }  # sole executor

# Experiment D: specialist split
agents:
  planner:     { runtime: claude-code, model: opus }      # plans only, high-quality model
  coder-1:     { runtime: ai-sdk, model: deepseek:deepseek-chat }  # implements plan (parallel)
  coder-2:     { runtime: ai-sdk, model: deepseek:deepseek-chat }  # implements plan (parallel)
  reviewer:    { runtime: claude-code, model: sonnet }    # reviews output
```

### Agent prompt iteration

The `instructions` field in YAML is the most impactful lever. Key patterns to test:

**Orchestrator prompt variables:**
- Decomposition granularity: "break into 2-3 subtasks" vs "one subtask per agent"
- Review depth: "spot-check" vs "review every file changed"
- Completion protocol: strict (checklist) vs loose (judgment call)
- Communication style: verbose (explain reasoning) vs terse (action only)

**Executor prompt variables:**
- Autonomy level: "ask @orchestrator before making design decisions" vs "make best judgment, report after"
- Scope discipline: "ONLY do your assigned subtask" vs "fix related issues you notice"
- Reporting: "post progress updates" vs "only report when done"

### A/B testing team designs

For rigorous comparison, run the **same task** with **two different YAML configs**:

```bash
# Config A: baseline team
$AW_CMD run eval-workspace-A.yaml --tag config-a --wait 30m

# Config B: experimental team (different prompts/roles)
$AW_CMD run eval-workspace-B.yaml --tag config-b --wait 30m
```

Both run against the same task-spec.md. Compare the scorecards to see which team
design produces better results. Track in SUMMARY.md with a "Config" column.

### Graduation criteria

A team design "graduates" when:
1. It consistently outperforms claude-code solo on T2+ tasks (Delta > +3)
2. It doesn't regress on T1 tasks (Delta >= -1, acceptable overhead)
3. The cost ratio is reasonable (Team cost < 3x Solo cost for > +5 quality delta)
4. Prompts are stable — minor rewording doesn't cause score swings > ±2

## Iteration Loop

```
1. /dev-eval → run eval → get scorecard
2. Analyze: which dimension scored lowest? What caused it?
3. Iterate on ONE variable at a time:
   - Agent prompts (instructions field)
   - Team composition (add/remove/change agents)
   - Role division (orchestrator vs executor split)
   - Channel structure (general vs specialized channels)
   - Model selection (which model for which role)
4. Re-run SAME task with new YAML config → measure delta
5. Track in SUMMARY.md with Config column → build trend data
6. When team design graduates → use it as the default workspace config
```

Each eval cycle should change exactly **one variable** for clean attribution.

## Quick Start

```
1. Pick a T2 task
2. /dev-eval
3. I'll define the spec, create worktrees for both sides,
   launch parallel runs, wait for completion,
   run evaluator + reviewer, and save the report
4. Review scorecard → identify weakest dimension
5. Modify workspace YAML (one change) → re-run → compare
```
