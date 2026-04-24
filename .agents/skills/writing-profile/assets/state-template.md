# 写作画像 · 测试状态

> 本文件由 skill 内部的 plan 阶段自动生成（由 dispatch 在首次启动时调用），随 run-unit / finalize 自动更新。用户不应直接编辑，除非清楚结构。
> 不要手工编辑除非你清楚结构。
> 最终画像产出在 `~/.claude/writing-profile/profile.md`。

Created: {{timestamp}}
Last updated: {{timestamp}}

## Meta-intake

### Q1 阅读日常
{{user_answer_verbatim}}

### Q2 写作日常
{{user_answer_verbatim}}

### Q3 古典接触深度
{{user_answer_verbatim}}

### Q4 翻译文学比例
{{user_answer_verbatim}}

### Q5 反感的作家/类型
{{user_answer_verbatim}}

## Calibration flags

(From meta-intake analysis. Affects excerpt selection in each dimension's run.)

- {{flag_1}}
- {{flag_2}}
- ...

## Target question count

- Default: 84 (7 × 12)
- Adjusted for this user: {{computed}}
- Hard cap per unit: 15
- Soft floor per unit: 6

## Units

| Unit | Name | Status | Score | Confidence | Notes |
|------|------|--------|-------|-----------|-------|
| W1 | 感官-直觉 (S/N) | [ ] not started | — | — | |
| W2 | 理性-感性 (T/F) | [ ] not started | — | — | |
| W3 | 外倾-内倾 (E/I) | [ ] not started | — | — | |
| W4 | 收束-发散 (J/P) | [ ] not started | — | — | |
| W5 | 致密-疏朗 (D/L) | [ ] not started | — | — | |
| W6 | 严肃-反讽 (G/H) | [ ] not started | — | — | |
| W7 | 文言-白话 (C/V) | [ ] not started | — | — | {{degraded_note_if_applicable}} |

Status legend:
- `[ ] not started` — never run
- `[~] in-progress` — started, paused
- `[~] in-progress (retest)` — 该 unit 已 completed，用户又触发 retest；completes 后会自动重算 profile
- `[x] completed` — finalized for this dimension
- `[?] low-confidence` — completed but needs re-run
- `[-] skipped` — 条件维度（如 W7）因 gate 不满足而跳过。**计入"全部完成"判定**；dispatch 会把 `[x]` 和 `[-]` 都算作已处理

## Finalized

(Populated by the finalize sub-phase — triggered automatically by dispatch when all/most units complete, or after a retest.)

## Profile freshness flag

If any unit is re-run after profile.md was generated, this flag is set. Dispatch reads it and re-finalizes on next invocation.

```
profile_stale: false | true
```

First finalized: —
Last finalized: —
Output file: `~/.claude/writing-profile/profile.md`
