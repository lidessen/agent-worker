# Dev Eval Summary

This summary condenses local evaluation runs that compared team and solo workflows while building `agent-worker`.

| Date       | Task                    | Tier | Team  | Solo  | Delta    | Config                                           | Key Insight                                                                                                                                |
| ---------- | ----------------------- | ---- | ----- | ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-03-27 | aw history CLI          | T2   | 13/25 | 17/25 | -4       | 2-agent (claude-code+cursor)                     | Cursor failed; team was effectively solo. Solo won on quality (real event types) and speed (23% faster). Team overhead yielded no benefit. |
| 2026-03-27 | aw version cmd          | T1   | 14/20 | 20/20 | -6       | 2-agent (claude-code+claude-code-worker)         | ai-sdk executor has no filesystem tools and required one human restart. T1 work did not justify team overhead.                             |
| 2026-03-28 | aw search cmd           | T2   | 21/25 | 17/25 | Team +4  | 2-agent (lead/sonnet + on_demand coder/deepseek) | The result mostly measured model differences, not multi-agent benefit, because the coder never contributed.                                |
| 2026-03-28 | aw search cmd (run4)    | T2   | 14/30 | 25/30 | Solo +11 | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Inbox wake-up was fixed, but the coder could not receive a follow-up bug-fix request in a second iteration.                                |
| 2026-03-28 | aw stats cmd (run5)     | T2   | 17/25 | 20/25 | Solo +3  | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Infrastructure stabilized; remaining losses came from prompt quality and shallow review.                                                   |
| 2026-03-28 | aw tail cmd (run6)      | T2   | 21/25 | 24/25 | Solo +3  | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Structural prompt improvements helped, but missing constraints on unsafe casts and test shape still hurt team quality.                     |
| 2026-03-29 | aw filter cmd (run7)    | T2   | 19/25 | 18/25 | Team +1  | 2-agent (lead/sonnet + on_demand coder/sonnet)   | First narrow team win. A deliverable checklist and no-action idle rule noticeably improved execution.                                      |
| 2026-03-29 | aw export cmd (run8)    | T2   | 14/25 | 22/25 | Solo +8  | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Lead review found a real bug but failed to drive the fix loop to completion.                                                               |
| 2026-03-29 | aw wait cmd (run9)      | T2   | 5/25  | 22/25 | Solo +17 | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Delegation silently dropped because the coder was not subscribed to `#dev`; solo completed cleanly.                                        |
| 2026-03-29 | aw pause/resume (run10) | T2   | 5/25  | 19/25 | Solo +14 | 2-agent (lead/sonnet + on_demand coder/sonnet)   | Mention-guard override semantics were misunderstood, so the coder never received work.                                                     |
| 2026-03-30 | mention-guard-on-demand | T2   | 5/20  | 23/20 | Solo +18 | lead(claude-code)+coder(on_demand,claude-code)   | Live daemon delivery still diverged from unit-test behavior.                                                                               |
| 2026-03-30 | aw rename cmd (run12)   | T2   | 12/20 | 20/20 | Solo +8  | lead(claude-code)+on_demand coder(claude-code)   | Team still missed a key mapping bug and used unsafe casts.                                                                                 |
| 2026-03-30 | aw pause/resume (run13) | T2   | 17/25 | 24/25 | Solo +7  | lead(claude-code)+on_demand coder(claude-code)   | Loop-closure and test-pattern guidance remained weaker on the team side than solo execution.                                               |

## Recurring Patterns

- T1 work generally did not justify multi-agent overhead.
- Infrastructure failures and routing bugs dominated early losses more than coding quality did.
- Team performance improved when prompts required explicit deliverables, idle behavior, and review checklists.
- The largest remaining team gap was loop closure: finding a defect was not enough unless the lead also drove the fix to completion.
