# Psychometric foundations

Why this skill looks like MBTI, acts like Big Five, and resembles neither exactly.

## Core theoretical claim: 写作声音 = 三层构念的稳定叠加

本技能的理论基座，也是解释所有维度取舍的那根线。

一个写作者的声音不是单一"风格"，而是**三个独立层的稳定偏好叠加**。每一层测的东西不同，稳定性不同，能从不同类型的探针里被捞出来。把它们混在一个扁平的 7 维表里，会产生审稿人指出的那种"维度间测的对象不对等"的问题。

```
┌─────────────────────────────────────────────────────────┐
│  L1  认知启动 (Cognitive operation)                      │
│  写作时心智的朝向：注意力落在哪、决策靠什么                │
│  最稳定（接近认知基底），跨体裁几乎不变                    │
│  探针：具象 vs 抽象文本对比、决策场景自陈                  │
│  本层维度：W1 (S/N), W2 (T/F)                            │
├─────────────────────────────────────────────────────────┤
│  L2  文本姿态 (Textual stance)                           │
│  成文与读者的关系：朝谁发言、是否给出结论                  │
│  中等稳定（可由体裁微调但有默认值）                        │
│  探针：发言姿态题、文本收束度题                            │
│  本层维度：W3 (E/I), W4 (J/P)                            │
├─────────────────────────────────────────────────────────┤
│  L3  审美偏好 (Aesthetic preference)                     │
│  习得性品味：喜欢读/写什么样的文字                         │
│  偏稳定但需要暴露作前提——没读过就没偏好可谈                │
│  探针：选段喜好评分、作家好恶列表                          │
│  本层维度：W5 (D/L), W6 (G/H), W7 (C/V，条件维度)         │
└─────────────────────────────────────────────────────────┘
```

三个层级不是比喻，是**三种不同的测量对象**。理论推论直接给出下面几条设计约束：

### 推论 1：MBTI 字母可借但不等于 MBTI

L1-L2 的 4 维（S/N、T/F、E/I、J/P）借用 MBTI 字母，**不是因为构念相同，而是因为极性同构**。

- **MBTI E/I** 测社交能量来源（人格层面）；我们的 E/I 测**写作发言姿态**（文本层面）
- **MBTI J/P** 测生活方式偏好（人格层面）；我们的 J/P 测**文本结构封闭度**（文本层面）
- **S/N、T/F** 最接近 MBTI 原义，但我们只取其中"写作时的认知启动"部分，不推及人格整体

字母保留因为共享极性方向（outward/inward、closed/open 等）让使用者能直观记忆。但**结果不能直接套用 MBTI 人格测量结果**——两个量表测的不是同一个东西。

### 推论 2：L3 维度是条件的，需要暴露前提

审美偏好只能在"已有暴露"的前提下测得。一个从没读过《庄子》《红楼》的人对文言不是"偏好白话"，而是**无法表达文言偏好**——默认填 V 会把教育背景差异误读成审美差异。

因此 **W7 必须是条件维度**：
- 古典暴露度达阈值 → 正常测 C_V，进入类型
- 暴露度不足 → C_V 记为 null，副字计算退化

W5 (D/L) 和 W6 (G/H) 理论上也是 L3，但它们的暴露前提比 W7 低得多——任何识字的现代读者都接触过密度变化和反讽。W7 是 L3 里**暴露敏感度最高的**，所以被单独标条件。

### 推论 3：每层的维度只能测自己层的信号，否则串轴

维度设计时必须严守"只测本层"。具体排除规则：

- **L2 (W3, W4) 不能测 L0 工法层**
  - W3 不问"发表/不发表"（发表是行为，不是姿态）
  - W4 不问"大纲先行/边写边想"（起稿流程是工法，不是文本形态）
  
- **L1 不能测 L3 审美**
  - W1 不问"你喜欢写密文还是疏文"（那是 W5）
  - W2 不问"你喜欢反讽吗"（那是 W6）

- **L3 不能测 L1 认知**
  - W5 不测"你思考时是具象还是抽象"（那是 W1，本层只测对结果文本的喜好）

审稿人的 3 条 medium/high 问题（W3 公共性、W4 工法、W7 混合）都是同一个根源：**构念跨层了**。这个三层框架是所有维度设计的第一性原理。

### 推论 4：类型标签的语义分层

5 字母 type 本身也分层：
- 前 4 位（MBTI 结构）= L1 (2位) + L2 (2位) = 认知 + 姿态
- 后 1 位（副字）= L3 审美

用户分享 `ENTP-R` 时，他其实在说"我的认知是 NT、姿态是 EP、审美是 R"。三层信息打包成一个短码。当 L3 的 W7 缺测时，副字退化，这是**语义一致的降级**（不是 bug）——L3 的一部分被标为"不可测"，而不是强行猜一个。

---

## The three frameworks we borrow from

### MBTI — what we take, what we leave

MBTI is popular because it's memorable and shareable. It's also psychometrically weak (low test-retest reliability, forced dichotomies where continuity exists, Type interpretations approaching pseudoscience). We take the parts that work, leave the parts that don't.

**Take**:
- **Forced-choice between equally-valid alternatives.** Users asked "do you like clear writing?" always say yes. Users asked "which of these two sentences is yours?" reveal real preference.
- **Multiple items per dimension.** A single question is noise; 10+ items averaging out is signal.
- **Dimensional structure.** Multiple orthogonal axes beat a single global "style score."
- **Letter-based type labels for shareability.** `ENTP-R` is memorable in a way that `[+5, -3, +8, +2, -4, -9, -3]` is not.

**Leave**:
- **Type fatalism.** MBTI sells "you ARE this forever." We say "this is your current writing preference, which you can edit or update."
- **Function-stack theory (Ni-Te-Fi-Se etc.).** Over-modeled, low empirical support, increases complexity without obvious payoff.
- **Hard dichotomization.** A +1 S is not the same as a +8 S. We retain continuous scores internally; type labels are summaries.
- **The 16 Personalities / NERIS-style fluff.** No "you're a rare type" flattery. No astrology-adjacent branding.

### Big Five (OCEAN) — what we steal

Big Five is the psychometric standard for personality. It uses continuous scales, reverse-keyed items, and heavy psychometric validation. We adopt:

- **Continuous dimensional scoring.** -10 to +10 per axis.
- **Reverse-keyed items.** Questions phrased in both directions on the same construct, to catch random or socially-desirable answering.
- **"Middle type" acknowledgment.** When |score| ≤ 2, the user is genuinely flexible on that axis; don't force a label.
- **Confidence bands.** High / medium / low based on item-response consistency.

We don't use Big Five's domain structure directly because:
- Big Five measures personality (Openness, Conscientiousness, etc.), not writing preference
- Some Big Five traits don't map to writing (e.g. Agreeableness)
- Writing has axes that personality doesn't (文言-白话 for Chinese, 致密-疏朗 for density)

### IRT (Item Response Theory) — principles we approximate

Real IRT requires calibrated item banks with discrimination parameters per item. We don't have that luxury (and couldn't — we generate items on the fly). But we approximate:

- **Item difficulty / discrimination.** Some questions are more diagnostic than others. Flag highly-diagnostic item types (匿名选段对比 > 元自评问题) and weight accordingly.
- **Local stopping rules.** Stop testing a dimension when cumulative evidence crosses a confidence threshold — don't mechanically run all 12 items if the first 6 already tell a consistent story.

## Our 7-dimension axis choice

The 7 dimensions come from:

- **W1-W4**: direct MBTI heritage (S/N, T/F, E/I, J/P), writing-reinterpreted where needed
- **W5 (致密-疏朗)**: Density is empirically the most visible stylistic differentiator in Chinese writing and has no MBTI equivalent. Borrowed from Helen Sword's Writer's Diet.
- **W6 (严肃-反讽)**: Solemnity vs irony tolerance — stable aesthetic preference that spans genres. No MBTI or Big Five equivalent.
- **W7 (文言-白话)**: Chinese-specific. Classical-vernacular balance is a core axis in 中国现代文学批评 (余光中《中文的常态与变态》, etc.). Not present in English-centric frameworks. **Conditional** — requires baseline classical exposure to measure; see Three-layer construct above.

Why not more dimensions? Each added dimension adds ~12 questions to the assessment, diminishes discrimination per-question, and makes the final type label harder to communicate. 7 is at the upper edge of what fits in 80-90 questions while keeping each axis reliable.

Why not fewer? Collapsing 致密-疏朗 into N/S (they correlate but aren't identical) loses signal. Dropping 严肃-反讽 loses a huge practical axis — writers with identical MBTI can be completely different companions to read depending on their irony channel.

## Reverse-keyed items — how we use them

For each dimension, roughly 30% of items should be phrased/structured such that a "strong preference" answer counts as evidence for the *opposite* pole than the user's main leaning. This isn't trickery — it's a check that the user is answering consistently rather than pattern-matching the test.

Example for W3 (E/I) — W3 只测**发言姿态**（朝外 vs 朝内），不测发表行为：
- Forward-keyed (E signal if chosen): 给两段同主题文字——A 段是呼告式开头（"你可能想过……"），B 段是内省式开头（"我一直在想……"）。问哪段像用户写。A = E，B = I。
- Reverse-keyed (I signal if chosen): 选段互换包装——A 段用"我"但独白朝内（"那天我坐在窗前……"），B 段完全不用"我"但对读者讲述（"注意：这里有件事值得说……"）。问哪段像用户写。A = I（即使带"我"），B = E（即使不带"我"）。

这对 pair 同时验证用户理解了"姿态朝向 ≠ 人称字频"。一个真心 I-leaning 的用户应该在 forward-keyed 选 B（内省开头 = I），在 reverse-keyed 选 A（带"我"但朝内 = I）。若两题都选 I 对应项 → 信号一致；若反向（例如 forward 选 B 但 reverse 选 B，等于 forward 判 I 但 reverse 判 E）→ 说明用户可能按"有没有'我'"答题而非"姿态朝向"，需要补一题澄清。

## Confidence computation

Per dimension, after N items:

- **Cumulative score**: sum of signed item contributions (-2 to +2 each)
- **Consistency**: |forward-keyed sum| vs |reverse-keyed sum| (both should point same way; large divergence = inconsistency)
- **Extremity**: how many items gave ±2 vs 0

Heuristics (no hard math, judgement-based):
- **High**: |cumulative| ≥ 6, reverse-key consistent, ≥ 3 extreme items in same direction
- **Medium**: |cumulative| ≥ 4, one reverse-key inconsistency tolerated, items mostly leaning same direction
- **Low**: |cumulative| ≤ 3, or reverse-key contradicts, or items oscillating ±2

Low-confidence results should be flagged in the profile and suggested for re-test.

## What this skill is NOT

- Not a valid psychometric instrument by academic standards. It's deliberately fast, LLM-generated, and uses public-domain literature samples. Don't cite it in research.
- Not a diagnosis. The type label describes writing preference today, not personality, not cognitive style, not a permanent label.
- Not a ranking. No type is "better." Every archetype produces good writers when the writer works within their type, and bad writers when forced out of it.

## Further reading (for humans curious)

- **MBTI critiques**: Pittenger (1993), Grant (1999) on type-theory flaws
- **Big Five foundations**: Costa & McCrae's NEO-PI
- **Writing style metrics**: Helen Sword, *The Writer's Diet* (2007)
- **Chinese style frameworks**: 余光中《中文的常态与变态》, 思果《翻译研究》
- **Stylometry (computational)**: Koppel, Argamon, et al. on authorship attribution
