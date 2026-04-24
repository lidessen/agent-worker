# Excerpt strategy — how to pick excerpts on the fly

The agent does **not** have a fixed question bank. When running a dimension, the agent generates excerpt pairs/ratings on the fly using the principles below and the dimension-specific methodology file.

## Why on-the-fly

- **Freshness**: each session is slightly different; same user running twice gets different excerpts, reducing memorization effects
- **Adaptivity**: if the user doesn't know classical poetry, swap to modern anchors
- **Context efficiency**: we don't load a huge question bank into context; we load dimension methodology (~1-2k tokens) and the agent generates

## Source of truth: real texts, not AI imitations

**Always use real excerpts from real authors.** Never invent a passage "in the style of X." Reasons:

- AI-generated excerpts carry AI tells, which contaminate the measurement
- Real excerpts have subtle rhythms and authorial fingerprints that forced-in imitation misses
- The user may recognize fake texts, losing trust

If you can't recall a specific passage verbatim, reach for a passage whose shape you're confident about — the first paragraph of 《边城》, the opening of 《一只特立独行的猪》 王小波, 《故都的秋》 郁达夫, etc. Better to use common well-anchored passages than to invent.

If the user asks for a less-common author you don't know well, say so honestly and pick a different anchor: "I'd rather use a passage I can quote accurately."

## Anchor pools per category

### 古典诗歌 (W1 imagery, W5 density, W6 tone, W7 classical)
- 豪放奔流: 李白《将进酒》《蜀道难》
- 沉郁对仗: 杜甫《春望》《登高》《秋兴八首》
- 空灵白描: 王维《山居秋暝》《竹里馆》《鹿柴》
- 朦胧意象: 李商隐《锦瑟》《无题》（相见时难别亦难）
- 旷达自然: 苏轼《定风波》《水调歌头·明月几时有》
- 婉约细腻: 李清照《声声慢》《如梦令》
- 先秦古朴: 《诗经》风雅颂；《楚辞·九歌》《离骚》选段

### 古典散文 (W1 concrete/abstract, W2 reasoning style, W5-7 all)
- 先秦诸子: 《庄子·逍遥游》（汪洋恣肆）、《论语》（简约）、《孟子·告子》（铺排）、《韩非子·说难》（冷峻）
- 史传: 《史记·项羽本纪》（叙事节制）、《左传·郑伯克段于鄢》
- 唐宋八大家: 韩愈《师说》、柳宗元《捕蛇者说》、欧阳修《醉翁亭记》、苏轼《前赤壁赋》
- 笔记: 《世说新语·任诞》《世说新语·文学》、《容斋随笔》

### 民国 (覆盖最广 — 几乎所有 7 维都能用)
- 鲁迅: 《立论》（讽刺）、《秋夜》（意象）、《故乡》（叙事）
- 胡适: 《差不多先生传》（白话清浅）、《文学改良刍议》（论证）
- 周作人: 《北京的茶食》《乌篷船》（冲淡、闲适）
- 朱自清: 《背影》《荷塘月色》（抒情）
- 沈从文: 《边城》开头、《湘行散记》
- 梁实秋: 《雅舍小品·孩子》（闲适雅致）
- 张爱玲: 《金锁记》开头、《倾城之恋》、《流言》散文
- 钱钟书: 《围城》（机锋）、《谈艺录》（学术）
- 汪曾祺: 《受戒》《故乡的食物·端午的鸭蛋》
- 废名: 《竹林的故事》（诗化散文）
- 林语堂: 《人生的盛宴》《京华烟云》（才子体）
- 丰子恺: 《缘缘堂随笔》

### 当代严肃
- 余华: 《活着》、《许三观卖血记》
- 莫言: 《红高粱》
- 史铁生: 《我与地坛》《务虚笔记》
- 贾平凹: 《秦腔》
- 阿城: 《棋王》《遍地风流》
- 王小波: 杂文（《一只特立独行的猪》《沉默的大多数》）、小说

### 当代学术思想
- 钱穆: 《国史大纲》引论
- 李泽厚: 《美的历程》
- 陈嘉映: 《何为良好生活》
- 刘瑜: 《观念的水位》
- 李零: 《丧家狗》

### 当代诗
- 海子: 《面朝大海，春暖花开》《九月》
- 北岛: 《回答》
- 顾城: 《一代人》
- 西川: 《在哈尔盖仰望星空》

### 网络/技术/新媒体
- 阮一峰: 网络日志任一则
- 左耳朵耗子: CoolShell 任一则（尤其开头段）
- 王垠: 《完全用 Linux 工作》《谈程序语言设计》
- 刘未鹏: 《暗时间》《为什么你应该学点微积分》
- 霍炬: blog 任一则
- Steve Yegge / Paul Graham 中译（只有对翻译文学熟悉的用户才用）

### 段子/轻口语
- 李诞: 《冷场》任一篇
- 马伯庸: 《长安十二时辰》轻松段落、微博段子
- 梁欢: 微博/文章

## Excerpt-selection algorithm

For a given dimension + current Q number within that unit:

1. **Consult the dimension methodology file** for its recommended question types at this Q slot (e.g., "第 3 题用反向题")
2. **Pick the appropriate source category** — some dimensions want诗, some want散文, some want技术文
3. **Apply calibration flags** from state.md — if user flagged "古典基本没读", substitute modern equivalents
4. **Pick concrete excerpts** — prefer passages you can quote verbatim; avoid paraphrasing
5. **Pair / contrast with second excerpt** — for A/B questions, the contrast should be on the target dimension with other dimensions as similar as possible (e.g., for W1 S/N, both excerpts should be similar in W5 density and W7 classical-vernacular — otherwise the pair measures multiple things)

## Quotation rules

- **Quote directly from memory when confident**. Verbatim is best. Paraphrase only if genuinely uncertain and mark it: "大致如此，你应该能猜出是哪一段"
- **Keep excerpts short**: 30-100 字 for prose; a couplet or short stanza for poetry. Very long excerpts fatigue the user and introduce noise.
- **Don't pre-annotate**: no "这段比较豪放/朦胧" before showing. Let the user react.
- **Attribute after answer**: "刚才 A 是李白《将进酒》，B 是李商隐《锦瑟》"

## Pair-quality criteria

A good A/B pair for dimension measurement:
- Both excerpts are of roughly comparable length and "weight"
- The contrast is clean on the target dimension
- Other dimensions are roughly matched (don't pair "短句白话讽刺" vs "长句文言抒情" for a pure W1 test — too many variables change)
- Both should be legitimately good writing within their styles (so the user isn't just picking "the better one")

A bad pair:
- One is clearly from a higher prestige author the user will recognize and favor
- One is much longer than the other
- They differ on 4+ dimensions (user can't tell which they're rating on)

## When the user doesn't engage with the excerpts

If the user answers "我对这两段都没感觉" or similar 2+ times in a row:
- Switch to a different question type (e.g., from 匿名选段打分 → 场景自陈 or 元问题)
- Or switch source category (from 古典诗 → 民国散文 if user seems cold on poetry)
- Don't force; a weak-signal answer (0) is still valid data, and the remaining questions can carry the dimension

## Cross-dimension contamination

Some excerpts light up multiple dimensions. That's fine — the signal goes primarily to the dimension being tested, but the agent may make a note in the unit file: "Note: this Q also showed strong W6 humor signal; may cross-check during W6 unit."

Don't double-count across units. Keep the primary scoring within the active dimension.

## Prohibited selections

- **Don't use AI-generated texts** (ChatGPT samples, Claude samples) as any part of an excerpt pair — they're the contamination we're trying to detect
- **Don't use texts with political or traumatic content** unless the dimension genuinely requires (W6 might need it for serious/deadpan contrast, but even then, be thoughtful)
- **Don't use works the user has said they dislike** as the "positive" option in a pair; can use as contrast but not as target
