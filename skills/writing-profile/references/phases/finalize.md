# finalize — Synthesize final profile from all completed units

> **这是子阶段文件，不直接面向用户**。由 `commands/dispatch.md` 自动调用：所有 7 个维度完成后（路径 D），或某维度 retest 后（路径 F）。用户不需要直接触发 finalize。

Combine all 7 unit results into the final `profile.md` — the artifact downstream writing skills consume.

## Process

### 1. Precondition check

Verify:
- `~/.claude/writing-profile/state.md` exists
- At least 5 of 7 units have `status: completed` (soft requirement — partial profile is allowed with warning)
- If any unit marked `low confidence`, note it

If fewer than 5 units complete → suggest running more units first. Don't proceed unless user insists.

If exactly 7 complete, proceed smoothly.

### 2. Load all unit results

Read `~/.claude/writing-profile/units/W1.md` through `W7.md`. Extract:
- Final score for each dimension
- Confidence level
- Type letter (S/N, T/F, E/I, J/P for W1-4; direction-only for W5-7)

Note: for W5/W6/W7, the "letter" is just the direction (致密/疏朗, 严肃/反讽, 文言/白话). The 副字 (A/C/W/R/Z/M/D/H) is composed from their combination here at finalize.

### 3. Compute type label

Main type (4 letters from W1-W4):
- If |score| ≤ 2 for any dimension, use lowercase letter (e.g., `eNTJ` signals E is weak)
- Otherwise uppercase (standard MBTI)

副字 (from W5/W6/W7 via `references/type-archetypes.md`):
- Look up the combination. Mapping:
  - 致密-严肃-文言 = **A** (学院派)
  - 致密-严肃-白话 = **C** (思辨派)
  - 致密-反讽-文言 = **W** (才子派)
  - 致密-反讽-白话 = **R** (杂文家)
  - 疏朗-严肃-文言 = **Z** (抒情派)
  - 疏朗-严肃-白话 = **M** (平实派)
  - 疏朗-反讽-文言 = **D** (小品派)
  - 疏朗-反讽-白话 = **H** (段子派)
- If any of W5/W6/W7 is in middle type (|score| ≤ 2), use the nearest side but note the flexibility in the profile text.

### Handling null C_V (W7 not measured due to low classical exposure)

W7 is a conditional dimension (see `references/dimensions/W7-classical-vernacular.md`). If W7 unit was skipped or returned null, handle as follows:

1. **C_V in YAML**: record as `null`, and add `classical_exposure: low` field
2. **副字 derivation**: default to V (vernacular) side, because:
   - User's writing context is vernacular-based (they haven't trained in classical)
   - Downstream skills should not push classical register without positive signal
   - Falling back to V prevents biasing the type toward people with stronger classical education
3. **副字 subset after fallback**: only 4 of the 8 letters are reachable
   - 致密-严肃-V → **C** (思辨派)
   - 致密-反讽-V → **R** (杂文家)
   - 疏朗-严肃-V → **M** (平实派)
   - 疏朗-反讽-V → **H** (段子派)
4. **Type label display**: append `*` asterisk suffix to mark the null, e.g. `ENTP-R* · 杂文家 (C_V 未测)`
5. **Profile description**: in the human-readable profile.md body, add a note under W7 section: "古典文学暴露度不足，未测 C_V。副字按白话侧取。若未来古典接触增加，可重跑 W7 更新。"

### Final label format

- 正常情况：`ENTP-R · 杂文家`
- W7 未测：`ENTP-R* · 杂文家 (C_V 未测)`

### 4. Compute author anchors

From `references/type-archetypes.md` find the 2-3 authors closest to the user's combined vector. Use simple distance measure — if all 7 axes are within ±2 of a known anchor author's typical coordinate, list them.

If the user's vector is far from any pre-mapped archetype (rare), describe the type in neutral terms without forcing an author name — e.g., "你的坐标较独特，最接近的是 X 和 Y 的混合，但都不完全贴合".

### 5. Generate machine-readable contract block

The `## 坐标 (consumer contract)` section of profile.md must be valid YAML that downstream skills parse directly:

```yaml
S_N: <signed int>
T_F: <signed int>
E_I: <signed int>
J_P: <signed int>
D_L: <signed int>       # W5: +Dense / -Light
G_H: <signed int>       # W6: +Grave / -Humor
C_V: <signed int>       # W7: +Classical / -Vernacular (null if degraded/skipped)
type: <5-letter type code>
subtype_cn: <中文类别名>
confidence:
  S_N: high | medium | low
  T_F: high | medium | low
  ...
```

Don't decorate this block — it's the stable contract. Add commentary elsewhere.

### 6. Generate 机械反 AI 清单

From the vector, derive a concrete checklist of phrases and patterns to ban during revision. Examples:

**If T score is strong (assertive, direct)**:
- Delete hedges: "可能"、"或许"、"也许"、"在某种程度上"、"可以说"
- Delete "值得注意的是"、"不难看出"、"可以看到"

**If G_H is negative and strong (i.e., H dominant, 反讽倾向)**:
- Preserve user's sarcasm/irony signals
- Don't soften punchlines with "当然"、"客观来说"

**If G_H is positive and strong (i.e., G dominant, 严肃倾向)**:
- Don't inject irony or deadpan the user didn't ask for
- Preserve earnest tone; avoid "其实是在说反话嘛" 类型的改写

**If D is low (疏朗, sparse density)**:
- Avoid three-part parallels unless semantically required
- Avoid adjective stacking ("深入的、全面的、系统的")
- Break long sentences — target average ≤ 18 字

**If V is strong (白话)**:
- Delete 四字词堆砌 (cap at 1 per paragraph unless native usage)
- Delete "进行 + 动词" structures
- Delete "对……进行……" structures
- Delete "基于……的原因"-type 西化连接词

**If N is strong (abstract / conceptual)**:
- Allow cross-domain metaphors
- Don't translate abstract claims back into concrete examples the user didn't ask for

Be specific. Each rule should map to a find-and-rewrite operation an agent can execute mechanically.

### 7. Write profile.md

Use `assets/profile-template.md` structure. Fill in:

1. Title + type label + archetype name + anchor authors
2. One-paragraph description of the type (generated from the combined archetype in type-archetypes.md + agent's judgement)
3. Machine-readable contract block
4. Per-dimension breakdown (human-readable): what each axis measured, user's score, brief interpretation
5. 机械反 AI 清单 (from step 6)
6. 作家锚点图 (closest / furthest)
7. Generated date + source: "based on N completed dimensions"
8. Footer noting that this is a preference snapshot, editable, not an identity claim

Save to `~/.claude/writing-profile/profile.md`. If a previous profile exists, archive it to `profile-<YYYYMMDD>.md.bak` first.

### 8. Update state.md

Mark all units' state verbatim (unchanged). Add:

```
## Finalized
First finalized: <timestamp>
Last finalized: <timestamp>
Output: ~/.claude/writing-profile/profile.md
```

### 9. Show user the result

Present the type label + archetype + anchors in chat:

> 你是：ENTP-R · 杂文家
> 作家谱系：王小波 × 鲁迅杂文
>
> 完整画像已写到 `~/.claude/writing-profile/profile.md`。下次使用技术写作 / 博客 / 日记 等 skill 时会自动读入。
>
> 若对某一维度结果有疑问，可以用 `/writing-profile W<N>` retest 那一维；系统会自动重新 finalize。

Then show a 3-4 line summary of what the archetype means (don't dump the full profile.md in chat — that's what the file is for).

## Handling edge cases

- **Middle type on a dimension**: flag in profile.md under that dimension's section with "你在这一维度上倾向不强/灵活" explanation. Use lowercase letter for that position. Consumer skills will read the score (small value) and know to not push either way.
- **W7 degraded/skipped**: 遵循上面"Handling null C_V"节的完整规则——`C_V: null` + 副字**固定取 V 侧**（4 选 1：C/R/M/H）+ 类型后缀加 `*`。不要"pick any of the 2 possible"——那会让同一输入产生不同副字，污染分享时的类型码。
- **Reverse-key failures (multiple inconsistencies in a unit)**: mark confidence as `low` for that dim; suggest retest in footer.
