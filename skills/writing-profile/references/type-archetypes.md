# Type archetypes — the 16 × 8 catalog

Every finalized profile maps to a 5-letter code `<MBTI4>-<副字>` with a Chinese category name. This file is the lookup table.

## The 副字 (W5 × W6 × W7 → single letter)

Derived from the user's W5 (致密/疏朗), W6 (严肃/反讽), W7 (文言/白话) combination. See `phases/finalize.md` step 3 for computation; see this file for the resulting category descriptor.

| 副字 | 中文类别 | W5 | W6 | W7 | 作家锚点 |
|------|---------|----|----|----|---------|
| **A** | 学院派 | 致密 | 严肃 | 文言 | 钱钟书、王国维、陈寅恪 |
| **C** | 思辨派 | 致密 | 严肃 | 白话 | 刘未鹏、刘瑜、王垠（论证篇）、李泽厚 |
| **W** | 才子派 | 致密 | 反讽 | 文言 | 钱钟书《围城》、李敖、林语堂、木心 |
| **R** | 杂文家 | 致密 | 反讽 | 白话 | 王小波、鲁迅杂文、许知远、王朔 |
| **Z** | 抒情派 | 疏朗 | 严肃 | 文言 | 朱自清、沈从文、鲁迅散文、废名 |
| **M** | 平实派 | 疏朗 | 严肃 | 白话 | 万维钢、吴军、阮一峰、毕飞宇散文 |
| **D** | 小品派 | 疏朗 | 反讽 | 文言 | 汪曾祺、梁实秋、丰子恺、周作人 |
| **H** | 段子派 | 疏朗 | 反讽 | 白话 | 李诞、马伯庸、王小波（轻松篇）、梁欢 |

### How to pick when边界模糊

If any of W5/W6/W7 is middle-type (|score| ≤ 2), pick the nearest side. In profile.md, note the flexibility — "你在 W6 上倾向不强，副字 R 和 Z 都合适，这里取偏向的 R"。Downstream consumers read the continuous score, not the letter, so this doesn't break anything.

### W7 为 null 的 fallback (conditional dimension)

W7 是条件维度（见 `references/dimensions/W7-classical-vernacular.md`）。若 W7 未测（`C_V: null`），副字计算只用 W5×W6 决定，默认落在 V（白话）侧：

| W5 | W6 | W7 | 副字 |
|----|----|------|------|
| 致密 | 严肃 | null → default V | **C** (思辨派) |
| 致密 | 反讽 | null → default V | **R** (杂文家) |
| 疏朗 | 严肃 | null → default V | **M** (平实派) |
| 疏朗 | 反讽 | null → default V | **H** (段子派) |

Type label 加星号标记未测：`ENTP-R*`、`ISTJ-M*` 等。profile.md 里写明"C_V 未测（古典暴露度不足），副字按白话侧默认取"。

**为什么默认 V 而不是中间或随机**：
- 用户的实际写作环境是白话基底（没有古典训练）
- AI 消费者读到 null 时不应主动推文言风格（推了用户也用不上）
- 默认 V 减轻 W7 对有古典教育背景者的系统性偏向（审稿人指出的高危点）

## Notable MBTI-副字 combinations (archetype catalog)

Not all 128 combinations are common or coherent. Below are the ~25 most commonly-landed combinations with writer-anchors. If a user lands on a combination not listed here, the agent at finalize should:
1. Describe it by decomposing its axes ("你是 E+T+N+P + 致密-反讽-白话 = 外倾直觉论证发散的杂文家倾向")
2. Find the 2 nearest listed archetypes and position the user between them

### 常见组合

**INTJ-A · 学院派**  
学问家型。钱钟书、王国维一路。重视知识密度、文言底子、严肃构建。容易掉进考据癖/掉书袋陷阱。

**INTP-C · 思辨派**  
冷静分析家型。刘瑜、刘未鹏、李泽厚（学术）一路。白话说理、逻辑推演，较少华丽修辞。

**INTJ-C · 思辨派 (INTJ 变体)**  
收束的思辨派。王垠论证篇、陈嘉映、韩炳哲中译。结构更紧，论点更 assertive。

**ENTP-R · 杂文家**  
反讽漫游者型。王小波、李敖。逻辑密度高但以戏谑包裹；第一人称突出；短句为主。

**ENTJ-C · 思辨派 (ENTJ 变体)**  
论辩型思辨。激烈直接的论战者。王垠激烈篇、某些毛泽东论战文。

**ENTP-W · 才子派**  
机锋型才子。林语堂、早期李敖、梁遇春。中西兼备，文白夹杂，玩笑和学问杂陈。

**INTJ-W · 才子派 (INTJ 变体)**  
沉静才子。钱钟书《围城》、木心。机锋但不外放，学问含而不露。

**ISTJ-M · 平实派**  
务实说理型。万维钢、吴军、一些科普名家。段落扎实，结构封闭，不装饰。

**ISTP-M · 平实派 (ISTP 变体)**  
极简工程师型。阮一峰、左耳朵耗子。一句一信息，最低修辞，技术场景友好。

**INTP-M · 平实派 (INTP 变体)**  
学者式说理。刘瑜白话篇、李零说学问。理性但不紧。

**INFJ-Z · 抒情派**  
沉思抒情者。史铁生、周国平（早期）、朱自清《荷塘月色》。严肃、有文人气、白描与沉思交替。

**INFP-Z · 抒情派 (INFP 变体)**  
内向诗性。海子（散文）、顾城、废名。句式疏朗但意象深，感伤基调。

**ISFP-Z · 抒情派 (ISFP 变体)**  
山水派。沈从文、汪曾祺（严肃篇）、阿城。场景优先，情感收敛。

**ISFJ-D · 小品派**  
温柔闲适型。汪曾祺（闲适篇）、丰子恺、周作人。不激烈、日常事物、四字词点缀。

**INFJ-D · 小品派 (INFJ 变体)**  
文人雅士。梁实秋、林语堂（闲适面）。有文化典故、生活趣味。

**ENFP-H · 段子派**  
灵感联想型。李诞、马伯庸、梁欢。发散跳跃，笑点密集，白话到底。

**ESTP-H · 段子派 (ESTP 变体)**  
网感型段子手。王朔部分、冯唐白话篇、某些网络博主。直接、口语、市井感。

**ENTP-H · 段子派 (ENTP 变体)**  
思辨段子手。王小波轻松篇、李诞深度访谈版。段子里藏论点。

**INTJ-R · 杂文家 (INTJ 变体)**  
冷峻杂文家。鲁迅杂文、王垠某些篇、许知远反思篇。更结构、更封闭的 Rant。

**INFJ-R · 杂文家 (INFJ 变体)**  
情绪型杂文。许知远、刘瑜杂文篇、熊培云。讽刺中带悲悯。

**ESFJ-D · 小品派 (ESFJ 变体)**  
生活教员型。刘墉（生活篇）、毕淑敏。温情常识、平易戏谑。

**ISTJ-A · 学院派 (ISTJ 变体)**  
严谨学者。陈寅恪、汤用彤、一些旧派学者。比 INTJ-A 更重史料与文献。

**INFP-H · 段子派 (INFP 变体) 罕见**  
感性段子手。极少见；李诞的个别自反段落。

**ENTJ-A · 学院派 (ENTJ 变体)**  
论辩型学者。鲁迅（学术论战）、陈独秀、李敖学术篇。

**ENTP-A · 学院派 (ENTP 变体)**  
外放型学者。启功、张大春（考据篇）。

### 罕见/张力组合的处理原则

如果用户坐标组合罕见（比如 ESFP-A：外倾感官感性发散 + 致密-严肃-文言），这可能意味着：
- 测试噪声（某些轴置信度低）
- 用户的写作身份正在重塑中
- 确实是少见组合，未必有公认作家代表

在这种情况下，finalize 时用以下话术：

> 你的组合 `ESFP-A` 比较罕见——感性外倾发散型却偏好学院派文风。通常 ESFP 倾向 H/D，偏爱学院派的更多是 INTJ/INTP。你的坐标可能意味着：(a) 你刚从其他主导风格转向新尝试; (b) 你测试结果在某个轴上尚不稳定（W6 置信度为 medium，可考虑 retest）; (c) 你就是这么独特。

## What this file is / isn't

- **IS** a lookup catalog for finalize step — agent reads this to generate human-readable descriptions
- **IS** a jumping-off point for describing rare combinations (use listed archetypes as neighbors)
- **IS NOT** prescriptive — writers can and should break out of their archetype when the task requires
- **IS NOT** exhaustive — 128 combinations means ~100 are unnamed here; the agent handles those by decomposition
- **IS NOT** used during `run` (unit tests). Don't leak archetype names to user during questions — would bias answers.

## Author-anchor coordinate map (for distance computation)

Rough coordinate estimates for known authors (for computing "closest author" in finalize). These are estimates, not measured. Use as fuzzy distance targets.

| 作家 | S_N | T_F | E_I | J_P | D_L | G_H | C_V |
|------|-----|-----|-----|-----|-----|-----|-----|
| 钱钟书《围城》 | +6 | +3 | +2 | -4 | +7 | -5 | +6 |
| 钱钟书（学术） | +7 | +8 | -3 | +4 | +8 | +4 | +8 |
| 王国维 | +5 | +6 | -5 | +5 | +8 | +8 | +9 |
| 王小波 | +6 | +2 | +5 | -7 | +4 | -9 | -5 |
| 鲁迅（杂文） | +5 | +4 | +4 | +2 | +6 | -6 | +3 |
| 鲁迅（散文） | -2 | 0 | -3 | 0 | -1 | +4 | +5 |
| 李敖 | +4 | +5 | +9 | -3 | +5 | -5 | +3 |
| 林语堂 | +2 | 0 | +4 | -2 | -2 | -4 | +3 |
| 梁实秋 | -3 | -2 | 0 | +3 | +2 | -3 | +6 |
| 汪曾祺 | -8 | -4 | -5 | +2 | -6 | -2 | +3 |
| 沈从文 | -9 | -5 | -7 | +1 | -5 | +4 | +2 |
| 朱自清 | -4 | -3 | -4 | +3 | -3 | +6 | +4 |
| 张爱玲 | -2 | -3 | -2 | +4 | +8 | -2 | +4 |
| 史铁生 | -3 | -6 | -6 | +1 | -1 | +8 | +2 |
| 胡适 | +3 | +5 | +3 | +6 | -4 | +3 | 0 |
| 周作人 | -4 | -2 | -6 | -1 | +2 | -1 | +6 |
| 万维钢 | +4 | +7 | +2 | +5 | -5 | +4 | -5 |
| 吴军 | +2 | +5 | +1 | +5 | -4 | +5 | -3 |
| 刘未鹏 | +8 | +8 | -4 | +3 | +5 | +6 | -3 |
| 刘瑜 | +5 | +6 | +2 | +2 | +3 | +2 | -2 |
| 王垠（论证） | +6 | +9 | +6 | +2 | +7 | +3 | -4 |
| 王垠（激烈） | +4 | +6 | +9 | -2 | +5 | -2 | -5 |
| 阮一峰 | -3 | +6 | -2 | +6 | -8 | +5 | -9 |
| 左耳朵耗子 | +1 | +5 | +2 | +3 | -5 | +2 | -7 |
| 李诞 | +3 | -2 | +5 | -8 | -7 | -9 | -8 |
| 马伯庸 | +1 | -1 | +6 | -4 | -3 | -6 | -2 |
| 庄子 | +9 | +2 | +2 | -9 | +6 | -3 | +10 |
| 李白（诗） | +3 | -4 | +9 | -8 | +5 | -2 | +10 |
| 杜甫（诗） | 0 | -1 | -2 | +6 | +6 | +8 | +10 |
| 王维（诗） | -8 | -2 | -6 | +3 | -8 | +5 | +10 |
| 李商隐（诗） | +8 | -4 | -5 | -2 | +10 | -1 | +10 |
| 史记列传 | -2 | +3 | -5 | +4 | +4 | +5 | +10 |
| 世说新语 | +3 | +2 | -1 | -5 | -2 | -6 | +9 |

These are agent-calibration estimates; if the user's reading is that a writer fits differently, that's a valid signal to update the catalog locally.
