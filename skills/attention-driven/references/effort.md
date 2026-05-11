# Agent Effort Model

**Core principle: time is a broken metric for Agent work. Measure information throughput instead.**

## Why time fails

Human intuition equates effort with time because humans are roughly:
- Single-threaded (one thing at a time)
- Constant-speed (expert vs novice: 2-3x variance at most)
- Blocking = stopped (blocked human cannot work on something else)

Agents break all three. They can parallelize, vary speed by orders of magnitude (same task: 2 seconds or 20 minutes, depending on model / tools / iteration count), and switch to unblocked work while waiting.

**Time measures the wrong variable.**

## Two countable dimensions

| Dimension | Metric | What it captures |
|---|---|---|
| Information throughput | context tokens (input + output) | How much information the agent absorbed and produced |
| Intervention count | tool calls | How many corrections the agent applied |

**Iteration cost falls out naturally:** more retries → more tool calls + more context tokens → larger effort. No separate "iteration resilience" metric needed.

## Rough scale

```
Light:  < 10K tokens AND < 10 tool calls
        One-line fix, single verification pass.

Medium: 10K-100K tokens OR 10-50 tool calls
        Refactor across a few files, several verification rounds.

Heavy:  > 100K tokens OR > 50 tool calls
        Cross-module design decision, extensive research, multiple review cycles.
```

## Ratio as task-type signal

The ratio of tokens to tool calls reveals task nature:

- Low token + high tool → **action-dense** (bulk rename/relocate, mechanical ops)
- High token + low tool → **thought-dense** (design decision, reframe, research)
- High + high → genuinely heavy work

## Effective vs. wasted

Raw totals are not enough. Wasted effort = tokens and tool calls spent on a correction that does not shrink the gap.

The operational guard from attention-driven:

> **If the same correction fails twice, stop applying more force.**
> Run identification: assumption / contradicting observation / smallest distinguishing check.
> Route by what the check distinguishes.

This rule is not just "don't brute-force." It is: **cut off wasted throughput, protect your token and tool call budget.**

## Relationship to attention-driven framework

| Concept | attention-driven analog |
|---|---|
| context tokens | ContextPacket size (complexity signal) |
| tool calls | correction count (control loop iterations) |
| effective vs. wasted | same-correction-fails-twice rule + identification step |
| ratio as signal | task nature classification (action vs. thought) |

## One-liner

**W ≈ (effective context tokens, effective tool calls).**
Stop and re-identify when the same correction fails twice.
