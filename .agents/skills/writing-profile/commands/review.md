# review — Audit / improve a document using the profile

`/writing-profile review <path>` 读一篇写好的文档，用画像对它做声音体检：这篇的声音像不像"你"，哪些是 AI 味，哪些是体裁应付不了的，怎么改。

这是画像的**使用**入口。测试 (`retest`) 和看结果 (`show`) 只触达画像本身；`review` 把画像作用于具体文本。

## 前提

1. `~/.claude/writing-profile/profile.md` 必须存在（否则提示 "尚未建画像。`/writing-profile` 先跑完 7 维测试再回来做 review。"）
2. `<path>` 必须是可读的 markdown / 纯文本文件（web 链接、Figma URL 等不支持，明确拒绝）

## 流程

### 1. 读文档 + 读画像

- 读 `<path>` 全文。若超过 4000 字，提示用户是否只 review 某章节（避免上下文撑爆），默认接受全篇。
- 读 `~/.claude/writing-profile/profile.md`，提取：
  - `## 坐标` 的 7 维向量 + confidence
  - `## 机械反 AI 清单`（必删 / 必审查 / 保留 三段）
  - 档案标注的 `classical_exposure`（决定 C_V 能不能用）

### 2. 问体裁和目的（必问，不猜）

review 的评判标准随体裁变。同一段 G_H -8（反讽重）的人，在日记里是声音，在 design spec 里是灾难。两个问题一次问完：

```
## 先确认两件事（影响评判标准）

1. 这是什么体裁？
   - technical article / essay （argue a claim）
   - blog / 随笔 （share a thought）
   - diary / 日记 （record a moment）
   - reference / tutorial （teach/lookup）
   - 其他 —— 请描述
2. 写这篇的目的是？
   - 说服 / 改变读者看法
   - 记录 / 整理想法
   - 娱乐 / 情绪释放
   - 解释 / 让读者学会某件事
   - 其他 —— 请描述
```

用户回答后才进入后续评审。回答含糊则追问一次，仍含糊就按"随笔 + 整理想法"默认处理并明示。

### 3. 分派 genre modulator（如果有）

- 如果用户选 **technical article / essay** → 告知 "genre-specific 的深度审查用 `/technical-article-writing revise <path>` 更好（它会加载体裁 modulator 和 genre 专属机械清单）。本次仍按 profile baseline 继续。"
- 其他体裁 or 用户坚持 → 跳过 delegation，用 baseline 评审（不施加体裁 modulator——writing-profile 自己不懂体裁偏差）

这一步的关键是**不越权**：体裁偏差是体裁 skill 的职责，writing-profile 只做跨体裁一致的声音体检。

### 4. 跑三类审查

三类独立输出，别混着讲。

#### A. 机械扫（从 profile 的机械反 AI 清单，直接扫文本）

- **必删命中**：列出在文档里找到的必删短语，给出行号/上下文，建议删除或替换
- **必审查命中**：列出命中的模式（三段式排比、四字词堆砌、段落均匀等），每条给 1 个重写示例
- **保留标注**：如果文档里有用户画像鼓励保留的特征（比如强 H 的反讽段落），**显式标出**并说 "这是你的声音，别改"——防止下游自动化把它们抹平

#### B. 轴偏离扫（坐标 vs 文档实测）

按画像维度逐条对照文档实际表现，只报"显著偏离"（绝对差 ≥ 4 或方向反向）：

| 维度 | 你的坐标 | 文档实测 | 判断 |
|------|---------|---------|------|
| D_L  | +8 致密 | -3 疏朗  | ⚠️ 偏离：这篇比你平时稀，可能是迁就体裁也可能是没发挥。问用户 intent。|
| G_H  | -7 反讽 | +2 偏严肃 | ⚠️ 偏离：压住了反讽。check 是体裁要求还是写得拘束 |
| E_I  | +5 朝外 | +5 朝外  | ✓ 一致 |
| …    | …       | …        | … |

实测怎么估：句长分布给 D_L；hedge 数 + 情感形容词密度给 T_F；第一人称占比给 E_I；反讽/自嘲/双关出现频率给 G_H；结尾是否 land 给 J_P；文言借词/对仗频率给 C_V（若 `classical_exposure != low`）。粗估就行，不用精确打分。

偏离的解释要**双向**："这可能是体裁要求（OK），也可能是你这次没发挥到位（需要改）——你怎么看？"不要替用户下结论。

#### C. 体裁和目的合不合（用户上一步的回答）

把文档对照用户声明的**目的**评：说服类要看论证链是否闭环（但 writing-profile 不懂论证，就说"需要 technical-article-writing 级别的审查"然后打住）；记录类要看是否压抑了本该有的情绪温度；娱乐类要看反讽/节奏是否够。

这一段做得浅没关系——深的交给体裁 skill，writing-profile 只做"体裁合不合画像"的一阶判断。

### 5. 输出结构

```
# Review: <filename>

## 画像坐标（参考）
ENTP-R · 杂文家 | D+8 G-7 C-3 | confidence: high on S_N T_F D_L G_H

## A. 机械扫
### 必删（<N> 处）
- line 12: "值得注意的是，……" → 直接删
- line 47: "综上所述" → 前文已经说完，删掉最后一段首句
### 必审查（<N> 处）
- line 33-35: 三段式排比（"它是 X，它是 Y，它是 Z"）→ 本段是 thesis，排比让它变装饰；改成一句直述
### 保留
- line 78-82: 一段自嘲性括号 —— 这是你 H-7 的声音，不要改

## B. 轴偏离
2 处显著偏离（其余一致）：
- D_L: 文档偏疏朗（-3），你偏致密（+8）。体裁要求还是没发挥？
- G_H: 文档偏严肃（+2），你偏反讽（-7）。同上。

## C. 体裁判断
你选了 technical article + 说服。这个体裁会把 G_H 向严肃方向拉（technical-article-writing 的 modulator 写过 clamp_min -3），
所以 G_H 偏离是**体裁正常**，不用改。D_L 偏离**没有体裁理由**，值得 revisit。

## 建议优先级
1. 机械扫的必删（~5 分钟就能清完）
2. D_L 的偏离（段落重写，~30 分钟）
3. 机械扫的必审查（看情况）
```

### 6. 问要不要应用

最后问："要我把机械扫的必删在文件里直接改掉吗？其他建议仅报告。" 默认不改动源文件，要用户显式同意才 Edit。

## 不做的事

- **不替画像 finalize**——画像 stale 时只提示 "先 `/writing-profile` 重算"，不强行用旧数据
- **不做体裁专属的深审**——technical article 的论证链审查、blog 的钩子强度等，交给体裁 skill
- **不在文件里默默改东西**——所有修改走显式确认
- **不把机械反 AI 清单应用到"保留"区域**——profile 的保留段是最高优先级
- **不做 web URL / Figma URL**——只 review 本地文本文件
