---
name: writing-profile
description: Writer voice profile — an MBTI-inspired adaptive assessment that captures a person's cross-genre writing taste and style preferences. Use when the user wants to build or update their writing profile, calibrate AI writing tools to their voice, or find out "what kind of writer am I". Triggers on phrases like "写作画像", "writing profile", "writer type", "我是什么类型的作者", "测一下我的写作风格偏好", "calibrate my writing voice", or any explicit mention of building a writer profile. Produces a file at `~/.claude/writing-profile/profile.md` that downstream writing skills (technical-article-writing, future blog/diary skills) read to adapt AI output to the user's voice.
argument-hint: "[show | retest [W1-W7] | review <path>]"
---

# Writing Profile — Writer-BTI Assessment

A psychometric-style skill that builds a 7-dimension profile of the user's writing taste and preferences. The output is both a shareable type label (e.g. `ENTP-R · 杂文家`) and a continuous vector that downstream writing skills consume to match the user's voice.

Designed as a plan → run → finalize state machine with **independent, resumable test units** — each dimension gets its own methodology file and session file, loaded only when that dimension is being tested. This keeps context scoped so an 84-question assessment doesn't blow the window.

## Why this exists

Generic AI writing has "AI 味" — stacked hedges, three-part parallels, metaphor decoration, balanced non-committal endings. Those aren't inherently wrong; they're *wrong for this person* if this person writes punchy committed prose. To strip AI味, the AI needs to know what "this person's voice" actually is — not as self-report ("I like clear writing"), but as a measured preference vector inferred from the user's reactions to real literature across genres.

The profile is genre-agnostic. A writer's core taste — rhythm, density, irony tolerance, classical-vernacular balance — is stable across technical articles, blogs, and diaries. Genre-specific knobs (formality, pronoun density) are adjusted by each downstream writing skill; the baseline comes from here.

## Commands

围绕 3 件事组织：**做测试、看结果、用结果**。

**主命令**：

| Argument | Dispatch target | 用途 |
|----------|-----------------|------|
| (无参数) | `commands/dispatch.md` | 智能分发：首次→plan→W1→…→finalize→显示画像；中途→接着跑；完成→显示画像。最常用的入口 |
| `show` | `commands/show.md` | 展示 + 解读：测试完成后看结果的地方。不只 dump 坐标——读出画像在表达什么、和哪些作家近/远、写作中会自然偏向什么 |
| `retest` | `commands/retest.md` | 重做。无参 = 全部重测（二次确认）；`retest W3` 或直接 `W3` = 单维度重测 |
| `W1` – `W7` | `references/phases/run-unit.md` | `retest W<N>` 的快捷形式，也用于首次测 / 恢复进行中的单维度 |
| `review <path>` | `commands/review.md` | 用画像审查/改进一篇文档：读目标文档，询问体裁和目的，按坐标 + 机械反 AI 清单给出修改建议 |

**内部阶段方法论**（不是命令，dispatch/retest 按需加载）：

- `references/phases/plan.md` — meta-intake + 生成 state.md，首次由 dispatch 调用
- `references/phases/finalize.md` — 合成 profile.md，所有单元完成后自动触发（或 retest 后重算）

type 码分享由 `show` 在输出末尾给出一行可复制的 `ENTP-R · 杂文家 (王小波 × 鲁迅杂文)`，不再单独走命令。想彻底清掉画像数据可以直接 `rm -rf ~/.claude/writing-profile/`。

### 典型使用路径

**首次建画像**：一路 `/writing-profile` 直到出画像
```
/writing-profile          # 启动：plan → 跑 W1
/writing-profile          # 接着：跑 W2
...
/writing-profile          # W7 完 → 自动 finalize → 显示画像
```

**看结果与解读**：`/writing-profile show`  
**重测单维度**：`/writing-profile W3`（或 `/writing-profile retest W3`）  
**全部重测**：`/writing-profile retest`  
**用画像审文档**：`/writing-profile review drafts/article.md`

## The 7 dimensions — organized in 3 construct layers

Writer's voice = stable preferences stacked across three distinct layers. Each layer measures a different kind of thing; this framing (see `references/psychometric-foundations.md` for theory) is what prevents cross-layer confusion in the question design.

### L1 认知启动 (Cognitive operation — 最稳定)
How the mind moves during writing: where attention lands, how decisions get made.

| Code | Name | Ends | Heritage |
|------|------|------|----------|
| W1 | Sensing ↔ iNtuition | S / N | MBTI S/N (closest to original meaning, restricted to writing cognition) |
| W2 | Thinking ↔ Feeling | T / F | MBTI T/F (same) |

### L2 文本姿态 (Textual stance — 中等稳定)
How the finished text relates to the reader: direction of address, degree of closure.

| Code | Name | Ends | Heritage |
|------|------|------|----------|
| W3 | Extraversion ↔ Introversion | E / I | MBTI E/I letter, **construct redefined**: 发言姿态朝外/朝内 (reader-addressed vs self-addressed), not social energy |
| W4 | Judging ↔ Perceiving | J / P | MBTI J/P letter, **construct redefined**: 文本收束度 (closed/open structure), not lifestyle |

### L3 审美偏好 (Aesthetic preference — 需要暴露前提)
Learned taste for what's read and written. Requires baseline exposure to measure.

| Code | Name | Ends | Heritage |
|------|------|------|----------|
| W5 | 致密 ↔ 疏朗 (Density) | D / L | Writing-specific |
| W6 | 严肃 ↔ 反讽 (Grave ↔ Humor) | G / H | Writing-specific |
| W7 | 文言 ↔ 白话 (Classical ↔ Vernacular) | C / V | Chinese-specific · **conditional dimension** (see below) |

W7 is a **conditional dimension**: 审美偏好只能在"已有暴露"前提下测得。若用户对古典文学暴露度不足，W7 记为 `null`（不可测），副字计算退化。详见 `references/dimensions/W7-classical-vernacular.md`。

Each dimension has a dedicated methodology file under `references/dimensions/`. The agent reads only the active dimension's file when running that unit.

W5+W6+W7 combine into a single enumerated "副字" (one of A/C/W/R/Z/M/D/H) for the type label. See `references/type-archetypes.md`. When W7 is `null`, the副字 falls back to defaulting on the vernacular side (less classical-education-biased), and the profile marks `C_V: null` so downstream skills know not to push classical register.

## ⚠️ MBTI 字母是重诠释别名，不是 MBTI 人格测量

W1-W4 借用 S/N/T/F/E/I/J/P 是因为这 4 维在**写作域**的极性与 MBTI 原构念同构，保留字母便于记忆与分享。但构念已重定义：

- **E/I**：发言姿态（朝外/朝内），不是社交能量来源
- **J/P**：文本收束度（封闭/开放），不是生活方式
- **S/N、T/F**：最接近 MBTI 原义，但只取"写作时的认知启动"部分，不推及人格整体

若你是 MBTI 爱好者，这里的结果**不能直接套用**你的人格测量结果——两个量表测的不是同一个东西。见 `references/psychometric-foundations.md` 的"三层构念"论证。

## Type label format

`ENTP-R · 杂文家`

- **First 4 letters**: standard MBTI code from W1-W4
- **Single letter after dash**: encodes W5/W6/W7 combination
- **After `·`**: a recognizable Chinese style category (not an invented label)

| 副字 | 中文类别 | 维度组合 |
|------|---------|---------|
| A | 学院派 | 致密-严肃-文言 |
| C | 思辨派 | 致密-严肃-白话 |
| W | 才子派 | 致密-反讽-文言 |
| R | 杂文家 | 致密-反讽-白话 |
| Z | 抒情派 | 疏朗-严肃-文言 |
| M | 平实派 | 疏朗-严肃-白话 |
| D | 小品派 | 疏朗-反讽-文言 |
| H | 段子派 | 疏朗-反讽-白话 |

Type labels are **shareable summaries of the underlying vector**, not identity claims. Two writers with slightly different vectors may share a label; the agent always consumes the vector, not the label.

## Methodology principles

**Inherited from MBTI (the defensible parts)**:
- Forced-choice between equally-valid alternatives — eliminates "都还行" responses
- Multi-item per dimension (target ≥ 10 items) for reliability
- Reverse-keyed items (~30% of items per dimension) to catch careless answering
- Dimensional structure (7 axes, not one global score)

**Rejected from MBTI (pop-psych parts)**:
- Type fatalism ("you are forever INTJ")
- Function stacking (Ni-Te-Fi-Se)
- Strict dichotomization — we keep continuous scores internally; labels are only summaries

**Added from Big Five / IRT**:
- Continuous scores with confidence bands (not just binary picks)
- "Middle type" allowed when |score| ≤ 2 — the user is genuinely flexible on that axis

**Agent behavior during run**:
- **Never use a fixed question bank.** Generate excerpts and questions on the fly, following strategy in `references/excerpt-strategy.md` and the active dimension's methodology file.
- **Use real authors, real texts.** Excerpts must be actual passages, not AI-confected "in the style of X." Cite attribution only after the user answers, to prevent prestige bias.
- **Keep one dimension active per session.** When running W1, don't load W2-W7 methodology files. This is how context stays scoped for 80+ questions.
- **Record every answer verbatim in the unit file.** The session file is the source of truth; the agent's working memory is volatile.
- **Stop a dimension early** if confidence is high before the question cap. Sliding scale (see `references/signal-interpretation.md`).

See also:
- `references/psychometric-foundations.md` — full theory of what we inherit/reject and why
- `references/adaptive-branching.md` — when to drill, skip, or stop
- `references/signal-interpretation.md` — how to score answers

## File layout

```
skills/writing-profile/                  ← methodology (read-only)
  SKILL.md                               ← this file
  commands/
    dispatch.md, show.md, retest.md, review.md                # user-facing
  references/
    psychometric-foundations.md
    type-archetypes.md
    excerpt-strategy.md
    signal-interpretation.md
    adaptive-branching.md
    genre-adaptation.md                  # how downstream writing skills consume the profile
    phases/
      plan.md, run-unit.md, finalize.md  # meta-intake / 单维度测试 / profile 合成 (按需加载)
    dimensions/
      W1-sensing-intuition.md
      W2-thinking-feeling.md
      W3-extraversion-introversion.md
      W4-judging-perceiving.md
      W5-density.md
      W6-solemnity-irony.md
      W7-classical-vernacular.md
  assets/
    state-template.md, unit-template.md, profile-template.md

~/.claude/writing-profile/               ← user state (written by skill)
  state.md                               ← index + meta-intake + progress
  units/                                 ← one file per dimension session
    W1.md, W2.md, ...
  profile.md                             ← final synthesized profile (consumer artifact)
```

## Consumer contract

Downstream writing skills read `~/.claude/writing-profile/profile.md`. The file's top YAML block (`## 坐标`) is the stable machine-readable contract; the rest is human-facing explanation.

How a genre skill adapts this baseline to its own genre — the clamp/shift/amplify framework, genre-specific extras, two-pass application, and fallback contract — is specified in [`references/genre-adaptation.md`](references/genre-adaptation.md). Skill authors building new writing genres should read it before integrating.

```yaml
# Example contract block from profile.md
S_N: +7       # -10 to +10, positive = N
T_F: -2
E_I: +5
J_P: +6
D_L: -4       # W5: positive = Dense (致密), negative = Light (疏朗)
G_H: -8       # W6: positive = Grave (严肃), negative = Humor (反讽)
C_V: -3       # W7: positive = Classical (文言), negative = Vernacular (白话)
type: ENTP-R
confidence:
  S_N: high
  T_F: medium
  ...
```

The profile file also contains a **"机械反 AI 清单"** — concrete banned phrases and patterns derived from the user's axes, to be executed during the revision phase of any writing task.

## Fallback when no profile exists

If a downstream writing skill activates and no profile exists at `~/.claude/writing-profile/profile.md`, suggest (don't force) that the user run `/writing-profile` to calibrate. Writing should proceed with generic defaults if they decline — a profile improves output but isn't a hard prerequisite.
