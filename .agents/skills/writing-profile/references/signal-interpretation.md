# Signal interpretation — how to score answers and when to stop

Every answer turns into a numeric contribution to the active dimension's cumulative score. This file defines the scoring scale, the stop conditions, and the confidence calibration.

## Per-item scoring scale

Each item contributes between **-2 and +2** to the dimension's running score:

| Value | Meaning |
|-------|---------|
| +2 | Strong signal in positive direction |
| +1 | Weak signal in positive direction |
| 0 | Neutral, ambiguous, or user said "无感" |
| -1 | Weak signal in negative direction |
| -2 | Strong signal in negative direction |

Direction convention: **positive = first-listed pole** in the dimension file. For example in `W1-sensing-intuition.md`, positive = N (intuition), negative = S (sensing). Follow the dimension file's header to avoid sign flips.

## How to assign values

### For pair-rating questions (A vs B, 1-5 each)

Use the difference:
- Rating difference ≥ 3 (e.g., A=5, B=2): full signal ±2 toward the preferred side
- Rating difference = 2: ±1
- Rating difference ≤ 1: 0 (ambiguous / no clear preference)

### For forced-choice questions (pick A or B)

- Clear pick without hesitation: ±2
- Picked one but said "相似" or "勉强选 A": ±1
- Refused to pick / "都不选" after push: 0

### For 续写 / completion-choice questions

- Strong stylistic preference visible: ±2
- Moderate preference: ±1
- Ambiguous or eclectic response: 0

### For 场景自陈 questions

- User's own writing sample clearly demonstrates one pole: ±2
- Mixed signals: ±1
- No discernible lean: 0

### For 元问题 (meta self-report)

- Weak signal only — cap at ±1 regardless. Self-report is notoriously biased.

## Reverse-keyed item handling

Reverse-keyed items (~30% of a dimension's questions) are scored with the sign flipped. So if a reverse-keyed item's "consistent" answer for an I-leaner is B, and the user picks B, that contributes +1 (or +2) toward **I**, which in our convention with positive-toward-E means **-1** or **-2** on the dimension score.

The agent should mark reverse-keyed items clearly in the unit file:
```
Q7 [reverse-keyed]
...
Signal: E_I -2 (reverse-key consistent — user picked the introvert option)
```

### Reverse-key consistency check

After the unit completes:
- Compute sum of **forward-keyed** items' signed contributions → should point one direction
- Compute sum of **reverse-keyed** items' signed contributions → should point the *same* direction (signs are already flipped during scoring)
- If they agree → reverse-key check passes
- If forward says +4 and reverse says -2 → inconsistency; flag as "medium confidence"
- If forward says +5 and reverse says -5 → severe inconsistency; flag as "low confidence, user may be careless or the axis is genuinely unclear for them"

## Cumulative score tracking

After each question, the agent maintains:
- **running_score**: signed sum of all item contributions
- **running_items**: count of non-zero items (items with 0 contribute nothing signal-wise)
- **reverse_items_sum**: running sum of reverse-keyed items' contributions only

Display running state only **in the unit file** (for audit), not to the user during the run.

## Stop conditions

After each question, check all four conditions in order. Stop on first trigger.

### 1. User-invoked stop

Keywords: "够了", "停", "暂停", "stop", "pause", "先到这儿吧"

Action:
- Mark unit status `in-progress` (not `stopped-by-user` — the user might resume)
- Don't finalize scores yet
- Save current state
- Exit gracefully, tell user how to resume

### 2. Early high-confidence stop

Conditions (ALL must hold):
- |running_score| ≥ 6
- reverse-key items contribute ≥ 25% of total magnitude AND agree in sign with forward items
- ≥ 6 items answered with non-zero signal
- Last 3 non-zero items all same sign

Action:
- Finalize unit, status `completed`, confidence `high`
- Move to next unit or await user's next command

### 3. Flexible-type stop

Conditions:
- ≥ 10 items answered (not just slots — actual answers)
- |running_score| ≤ 2 AND
- item signs oscillate (at least 4 sign changes among non-zero items)

Action:
- Finalize unit, status `completed`, confidence `low — flexible type`
- Note in unit file: "该维度用户倾向不强，可视为中间型 / flexible"
- In profile.md finalize, use lowercase letter and mark in text

### 4. Hard cap

Conditions:
- 15 items answered

Action:
- Finalize regardless of confidence
- Compute confidence per the rules below
- If confidence came out low, note in unit file: "hit hard cap at 15 items; may re-run for stronger signal"

## Confidence rules (final, per-unit)

Once the unit stops, determine final confidence:

| Confidence | Criteria |
|-----------|----------|
| **high** | |final_score| ≥ 6, reverse-key consistent, ≥ 3 extreme (±2) items same direction, ≥ 6 non-zero items |
| **medium** | |final_score| ≥ 4 AND reverse-key mostly consistent (at most 1 inconsistent item) AND majority of items lean same direction |
| **low** | any of: |final_score| ≤ 3; reverse-key contradicts; items oscillate |

Low-confidence results in profile.md are marked with `⚠️` and a suggestion to re-run.

## The 0-score interpretation

If final_score is literally 0 after enough items:
- Mark as **flexible type** (not low-confidence)
- This is a legitimate outcome — some users genuinely have no preference on some axes
- In the type label, this dimension gets a lowercase letter OR is noted as "—" (agent decides based on finalize.md rules)

## Note on dimension interactions (keep separate)

During scoring of W1, **do not** update W2's score based on answers that also touch W2. Each unit is isolated. If a W1 answer reveals strong W3 signal, note it in W1's unit file as a "cross-signal" but don't score W3 until W3's own unit runs.

This is deliberate — cross-unit scoring would create dependencies and defeat the "independent units" architecture.

## Worked example (for clarity)

Running W1 S/N (positive = N):

```
Q1: pair-rating (李白《将进酒》 vs 钱钟书《围城》比喻段)
   User: 李白 4, 钱 5. Difference = 1 toward N. → +1
   running_score = +1, reverse_sum = 0, items = 1

Q2: forced-choice (续写片段 — concrete vs abstract)
   User: picks abstract → strong N. → +2
   running_score = +3, reverse_sum = 0, items = 2

Q3: [reverse-keyed] forced-choice (this time "picking the concrete side" signals N)
   User: picks concrete-side → reverse-keyed means N. → +2
   running_score = +5, reverse_sum = +2, items = 3

Q4: pair-rating (沈从文《边城》 vs 庄子《秋水》)
   User: 沈从文 4, 庄子 4. Diff = 0. → 0
   running_score = +5, reverse_sum = +2, items = 3 (non-zero count stays)

Q5: forced-choice
   User: picks N side → +2
   running_score = +7, items = 4

Check stop conditions:
- Not user-invoked
- |score| = 7 ≥ 6 ✓
- reverse_sum agrees with forward (+2 vs +5, same sign) ✓  
- non-zero items = 4 < 6 ✗ — need more

Continue.

Q6: pair-rating — diff = 3 → +2
   running_score = +9, items = 5

Q7: meta-question — cap at +1 — user says "I think in images" → +1
   running_score = +10, items = 6

Check stop:
- |score| = 10 ≥ 6 ✓
- reverse consistent ✓
- non-zero items = 6 ✓
- Last 3 items all positive ✓

STOP. Unit complete. Confidence high.

Write: "Final: N +10 (capped at +10), confidence: high"
```

Cap extreme scores at ±10 in the final output even if cumulative exceeded (helps downstream math stay in range).
