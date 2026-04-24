# {{WN}}: {{dimension_name}}

> 本文件由 `/writing-profile {{WN}}` 自动生成（或由 dispatch 触发），每道题后追加。
> 未完成状态下 `/writing-profile`（无参）或 `/writing-profile {{WN}}` 都能接着跑。

Started: {{timestamp}}
Last updated: {{timestamp}}
Status: {{in-progress | completed}}
Dimension: {{WN}} {{dimension_name}} ({{letter_A}}/{{letter_B}})
Direction convention: positive = {{letter_A}}, negative = {{letter_B}}

---

## Session

<!-- Each question appended as a block like this: -->

### Q1
Type: {{excerpt-pair-rating | reverse-keyed | completion-choice | scene-self-report | author-preference | meta-question}}
Generated from: {{source notes — e.g., "古典 vs 民国: 李白《将进酒》前 8 句 + 钱钟书《围城》比喻段"}}
Asked: {{full question text as shown to user}}
Attribution revealed: {{author info disclosed after answer}}
Answer: {{user's answer verbatim}}
Signal: {{dimension_code}} {{+/-N}} ({{strong/weak/neutral}}, {{forward-keyed/reverse-keyed}})
Running score: {{current cumulative}}
Items answered: {{n}}
Non-zero items: {{m}}

### Q2
...

<!-- Repeat for each question. -->

---

## Running signal summary (updated each question)

- Running score: {{value}}
- Non-zero items: {{m}}
- Forward-keyed sum: {{sum}}
- Reverse-keyed sum: {{sum}}
- Last 3 item signs: [+, +, +]
- Current consistency: {{ok | 1-inconsistency | multiple}}

---

## Result

<!-- Populated when unit stops. -->

Status: {{completed | in-progress | stopped-by-user}}
Final score: {{dimension}}={{value}} (capped at ±10)
Direction: {{letter_A | letter_B | flexible}}
Confidence: {{high | medium | low}}
Reverse-key check: {{passed | one-inconsistency | multiple-inconsistencies}}

Strongest signals: {{list of Q# that contributed ±2 same direction}}
Weak / cross signals: {{Q# that gave 0 or ±1, or signaled other dimension}}

Notes: {{any observation relevant to finalize — e.g., "seemed flexible on long vs short sentences but strong on concrete vs abstract"}}

Cross-dimension notes (do NOT score other dimensions here, only note):
- {{if any Q revealed signal for other dimensions, note for later}}
