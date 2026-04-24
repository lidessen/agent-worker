# Adaptive branching — when to drill, skip, switch, or stop

Within a single dimension's unit run, the agent adapts which question types and source categories to use based on the user's answers so far. This file gives the rules.

## The default sequence (when no signals trigger branching)

For a standard 12-question unit:

| Question # | Typical type | Notes |
|-----------|-------------|-------|
| 1-2 | 匿名选段打分（A/B 评分） | Warm-up; low cognitive load |
| 3 | 反向键（reverse-keyed）匿名选段打分 | Consistency check early |
| 4-5 | 续写选择 or 场景自陈 | Different modality, reduces monotony |
| 6 | 作家好恶列表 | Halfway marker |
| 7-8 | 匿名选段打分（不同素材） | Core measurement |
| 9 | 反向键对照 | Second consistency check |
| 10 | 元问题自评 | Weak signal, background confirmation |
| 11-12 | 最可能做的类型（基于前面 answers） | Close with highest-info question type |

This is the default weaving — the dimension methodology file may override specific slots.

## When to drill (escalate depth on a revealed preference)

If the user shows strong positive signal toward some source category in questions 1-3:
- Use more questions from that same category in slots 4-9
- The user is clearly engaged; precision improves

Example: user rates 李白 5 and 王维 5 but 李商隐 2 → they like 古典诗 in general but skew豪放/白描 over朦胧 → in slot 4-5, add another 豪放-vs-朦胧 contrast using 苏轼 vs 李贺 to sharpen signal.

## When to horizontal-switch (different source category)

If user gives 2 consecutive "不熟/没读过/没感觉" responses:
- Switch source category immediately
- Don't keep probing a dead zone
- Switch priority: 古典诗 → 古典散文 → 民国散文 → 当代 → 技术/网络

If user is cold on classical entirely:
- Use the `calibration flag: classical_exposure_low` from state.md (set at plan stage)
- Replace 古典 anchors with modern-era authors for remaining questions

## When to pivot mid-unit (question type change)

If user expresses fatigue or repetition:
- After 3-4 pair-rating questions, switch to a completion-choice or scene-self-report
- Variety in question types reduces response set bias

If user repeatedly says answers sound "both interesting" on pair-rating:
- That's low-discrimination — switch to forced-choice (must pick A or B)
- Or switch to author-preference ranking ("pick your top-3 out of these 6")

## When to stop early (high confidence)

See `signal-interpretation.md` for exact numerical criteria. Summary:
- Score ≥ 6 magnitude + reverse-key consistent + ≥ 6 non-zero items + last 3 items same direction → STOP
- Don't over-measure; the user's time is finite

## When to accept "flexible" and stop

If 10+ items in and score oscillates within ±2:
- The user genuinely has no preference on this axis
- Mark as flexible, don't push for a stronger signal
- Don't add "tiebreaker" questions — they'd be noise, not signal

## When to redirect a question

If the user misinterprets a question ("我不知道你要问什么"):
- Don't defend the question — it failed
- Rephrase with a concrete example, or swap to a different question type
- Log the aborted question in the unit file with status "replaced"; don't score it

## When to acknowledge cross-signal

If a W1 answer gives you strong evidence about W3:
- Don't score W3 in the W1 unit (scoring stays in the active unit)
- Add a line to the W1 unit file: "Note: Q5 also signals E_I direction; expect W3 unit to find X"
- This helps at finalize time — cross-references improve overall confidence

## When to abort the unit

Situations that warrant aborting mid-unit and coming back later:
- User is clearly distracted / not engaging
- User has answered "不确定" on 5+ questions in a row
- The agent recognizes the questions are poor for this user's background

Action:
- Set unit status to `in-progress` with note: "paused; user engagement low"
- Don't score partially if the items weren't earnest
- Suggest user resume later

## The general principle

**Adapt to the user, don't force them through a fixed script.** The fixed structure is the 12-slot default, but any slot can be replaced with a better-fitting question type given the user's demonstrated state. The methodology file for each dimension shows what question types are valid for that dimension; pick among those.

## Ordering of dimensions (global, affects dispatch's "next unstarted" selection)

Default order for dispatch to pick the next not-started unit:
1. W1 (S/N) — high discrimination, good first measure
2. W2 (T/F) — clear dimension, helps calibrate expectations
3. W3 (E/I) — reinterprets "voice presence", novel to user
4. W4 (J/P) — structure preference
5. W5 (致密-疏朗) — density
6. W6 (严肃-反讽) — irony tolerance
7. W7 (文言-白话) — last; 条件维度，暴露度不足时跳过

Reasoning:
- W1-W4 are the MBTI-familiar core; doing them first gives the user a sense of progress and the type letters they recognize
- W5-W7 are the "extra" dimensions that compose into the 副字; order within them is arbitrary
- W7 last allows it to be gracefully skipped if the user has no classical exposure

If the user explicitly picks a different order (`run W6` first), respect it. The units are independent.
