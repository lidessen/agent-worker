---
source: share.md
extracted: 2026-04-20
unit_count: 58
---

# Inventory · Agent Harness / 上下文架构

Neutral, atomic information units extracted from [share.md](share.md). IDs are stable; do not renumber when new units are added — append.

Legend: `fact` · `claim` · `definition` · `example` · `metaphor` · `anecdote` · `reasoning` · `diagram` · `reference`

---

## U-001 · definition: LLM 是续写引擎,不是记忆主体

**Content (neutral)**: LLM 生成输出本质上是对一段文本的延续预测。它没有持续记忆、没有"我"这一主体。所有的回答、推理、工具调用,都是续写同一段文本的尝试。

**Source**: share.md §1.1

**Load-bearing for (original)**: 作为全文第一块基石,用来推出"让 LLM 做事 = 创建上下文"。

**Reusable for**: 任何需要重申 LLM 机制、反驳"模型有记忆/意图"拟人化叙述的场合;讲 prompt engineering 基本盘;讲 agent 本质。

**Notes**: 避免拟人化描述;保持机械视角。

---

## U-002 · claim: 让 LLM 做事 = 设计上下文

**Content (neutral)**: 既然 LLM 没有记忆也没有主体,引导其行为的唯一手段就是构造合适的上下文。Agent 的一切工程问题,最终都落在"给模型看什么"上。

**Source**: share.md §1.1

**Load-bearing for (original)**: 贯穿全文的核心前提,后续对话/事件流/分层都建立在此之上。

**Reusable for**: 任何关于 agent 工程的开篇;prompt/上下文工程课的主线命题;反驳"agent = 一段 prompt"的观点。

---

## U-003 · diagram: 预测循环示意图

**Content (neutral)**: 图 1.1。展示 LLM 一步步续写一段文本("今天天气很"→"好"→","→...)的循环:每一步的输出被追加回输入,整段再喂回模型。

**Source**: share.md §1.1 图 1.1

**Load-bearing for (original)**: 让"续写"从抽象命题变成视觉事实;铺垫后面"上下文整段重喂"的现实。

**Reusable for**: 讲 LLM 基本原理的任何 explainer;强调"每轮都整段喂回"的成本图示。

---

## U-004 · fact: 对话范式是 LLM 产品的历史起点

**Content (neutral)**: GPT 最早以对话形态向公众发布;直到今天,主流 LLM 产品仍未跳出对话这一交互框架。

**Source**: share.md §1.2

**Load-bearing for (original)**: 解释"为什么上下文默认长成对话的样子"——路径依赖。

**Reusable for**: 回顾 ChatGPT/LLM 产品史;任何讨论"为什么上下文 ≠ 对话"的背景铺垫。

**Notes**: 文中自称"不负责任的推测",紧邻的 U-005 是推测本身,此处的历史事实是硬的。

---

## U-005 · claim: 对话是一种相对自然的滚动式上下文

**Content (neutral)**: 对话之所以成为 LLM 产品事实标准,可能是因为它恰好提供了一种交互自然、随时间滚动追加的上下文形态。

**Source**: share.md §1.2

**Load-bearing for (original)**: 解释对话范式粘性强的原因。

**Reusable for**: 讨论对话 UX / agent UX / 交互设计时的背景论断。

**Notes**: 原文明确标记为推测,非结论。复用时保留这种语气或降级为"一种解释"。

---

## U-006 · diagram: 消息序列追加示意图

**Content (neutral)**: 图 1.2。三轮对话里,每轮都把从第一轮起的所有消息(user / assistant / tool_result)整段喂回模型,新内容只是追加在尾部。

**Source**: share.md §1.2 图 1.2

**Load-bearing for (original)**: 让读者亲眼看到"对话历史每轮都整段重喂"。

**Reusable for**: 讲上下文窗口成本;讲 stateless 模型与 stateful 体验之间的鸿沟。

---

## U-007 · claim: 当代 agent 上下文已包含大量非对话内容

**Content (neutral)**: 实际运行中的 agent 上下文早已不是纯对话——工具调用与结果、系统通知、状态快照等大量非对话内容混入其中,它们是 agent 内部自产自消的上下文推进来源,而非单纯噪声。

**Source**: share.md §1.3

**Load-bearing for (original)**: 铺垫"内循环"概念,为后续"外循环 vs 内循环"的切分打底。

**Reusable for**: 反驳"agent 上下文就是聊天记录";介绍 tool use 引入的结构变化。

---

## U-008 · metaphor: 对话是外循环,工具调用是内循环

**Content (neutral)**: 可以把 agent 的上下文推进类比为两套循环。外循环由对话驱动——人说一句,agent 回一句;内循环由 agent 自己驱动——调用工具、消费返回、继续推进,不需要用户介入。

**Source**: share.md §1.3

**Load-bearing for (original)**: 贯穿后半篇——"现有 harness 只给外循环打补丁,内循环一直没被单独处理"正是以此为骨。

**Reusable for**: 解释 agent 自主性的来源;区分"用户驱动的交互"与"agent 自驱的推理"。

**Notes**: 这是全文最常被引用的概念性工具,务必在新文中保留清晰的形象。

---

## U-009 · claim: 上下文里可以并存多条独立脉络

**Content (neutral)**: 对话与工具调用各算一条循环只是起点。agent 的上下文里完全可以有更多条独立脉络并存——多个 worker 并行处理子任务、agent 之间异步协作、跨会话的长期观察、定时触发的复盘——每条都有自己的节奏和产物。

**Source**: share.md §1.3

**Load-bearing for (original)**: 预告第二部分"横向分模块"。

**Reusable for**: 讲 multi-agent / 并行 worker 架构;讲 event-driven agent。

---

## U-010 · metaphor: 把所有脉络塞进一条对话 = god file

**Content (neutral)**: 把本该独立的多条上下文脉络挤进同一条扁平的对话序列,相当于把几个独立模块的代码全塞进一个 god file——能跑,但结构的代价会在规模上来时集中爆出。

**Source**: share.md §1.3

**Load-bearing for (original)**: 把抽象的"上下文稀释"问题转成软件工程师熟悉的画面。

**Reusable for**: 任何讨论 agent 上下文膨胀、状态混杂、责任边界模糊的场合。全文最好用的类比之一。

---

## U-011 · diagram: Agent 循环示意图

**Content (neutral)**: 图 1.3。一次 agent 循环的流程:用户 prompt → 组装上下文 → 调用模型 → 模型输出文本或 tool call → 若 tool call 则执行后结果追加回上下文 → 下一轮循环。

**Source**: share.md §1.3 图 1.3

**Load-bearing for (original)**: 把"组装上下文"这一步可视化为循环的起点,为 §1.4 的 Claude Code 分析引出焦点。

**Reusable for**: 任何想解释"tool use 是如何延长一次 agent 任务"的场合。

---

## U-012 · fact: Agent 规模化时的三类上下文压力

**Content (neutral)**: agent 要真正跑起来,立刻会遇到三类具体的上下文压力:(1) 项目里几十个文件需要让模型有所感知,(2) 单次工具调用可能返回几万行搜索结果,(3) 长会话里早期对话不断堆积挤占窗口。

**Source**: share.md §1.4

**Load-bearing for (original)**: 作为"Claude Code 四件套"登场的问题侧。

**Reusable for**: 讲 coding agent 工程挑战;介绍 context window 压力的来源。

---

## U-013 · definition: Claude Code 的四件上下文机制

**Content (neutral)**: Claude Code 应对上下文压力的四项机制:
- **Skill**:描述常驻、正文按需加载
- **Tool 定义**:列表常驻、结果按需裁剪
- **Subagent**:独立上下文干脏活,只把结论返回主会话
- **Compaction**:到达高水位时自动压缩早期对话

**Source**: share.md §1.4

**Load-bearing for (original)**: 作为现有范式的代表,指出即便是最成熟的 harness,也都在给对话主体打补丁。

**Reusable for**: 介绍 Claude Code;比较 agent harness 的具体机制;用作后文"都没跳出对话主体"批评的对象。

---

## U-014 · diagram: Claude Code 上下文窗口组成

**Content (neutral)**: 图 1.4。从上到下排列:System Prompt → CLAUDE.md(项目指令)→ MEMORY.md 前 200 行(auto memory)→ Skill 描述列表 → Tool 定义 → 对话历史(可能被 compaction)→ 最新用户输入,上限由上下文窗口大小封顶。

**Source**: share.md §1.4 图 1.4

**Load-bearing for (original)**: 让"四件套"落到具体位置,读者能一眼看出各机制占的是哪一块。

**Reusable for**: 任何 Claude Code 架构介绍;讨论 agent 上下文布局的通用示意图。

---

## U-015 · claim: Harness 的工程重点在上下文组装,不在模型

**Content (neutral)**: 把四项机制放在一起看会发现,Claude Code 的工程重点其实不在模型本身,而在上下文组装——每次调用模型前都在判断:什么留、什么不留、什么压缩、什么外包。

**Source**: share.md §1.4

**Load-bearing for (original)**: 提升讨论层级——harness 不是工具的堆叠,是信息管理系统。

**Reusable for**: 反驳"agent 竞争就是比模型"的论调;解释为什么 harness 这一层会决定产品体验。

---

## U-016 · definition: Harness 的本质是上下文组装机

**Content (neutral)**: Harness 的本质是一台上下文组装机。Codex、Hermes、Agents SDK 做的都是这件事——它们不生产智能,生产的是喂给模型的那段文本。

**Source**: share.md §1.4

**Load-bearing for (original)**: 给出全文的一个核心定义。

**Reusable for**: 介绍 harness 概念;任何关于 agent infra 的开篇。

---

## U-017 · claim: Agent 是运行时系统,不是一段 prompt

**Content (neutral)**: Agent 不是一段 prompt,而是一套围绕上下文做信息管理的运行时系统。这一点在当前主流 harness 实现中已经是事实上的共识。

**Source**: share.md §1.4

**Load-bearing for (original)**: 把"agent = prompt"的朴素看法明确否定。

**Reusable for**: 开篇立场;反驳"写好 prompt 就是 agent";向非从业者解释 agent infra 为何复杂。

---

## U-018 · claim: 长对话中有效状态信息占比极低

**Content (neutral)**: 对话膨胀到几十轮后,真正对后续推进有价值的核心状态信息可能只有几条,淹没在大量礼貌措辞、过程性回复、工具原始输出中——几千 token 可能换回几行有效信息。

**Source**: share.md §1.5

**Load-bearing for (original)**: 量化"对话稀释"问题,推向"需要换范式"。

**Reusable for**: 讲上下文窗口效率;任何关于 token 浪费的论证。

---

## U-019 · claim: 单条模型回复同时承担多种职责

**Content (neutral)**: 一次模型输出被迫同时完成几件事:面向用户的表达、工具调用的发起、作为下一轮预测的输入、任务进展的状态记录。每一件事本该各有节奏和输出要求,被压在同一段文本里彼此稀释。

**Source**: share.md §1.5

**Load-bearing for (original)**: 给"god file"比喻提供具体职责清单,推出"该拆"。

**Reusable for**: 讨论 agent 输出设计;讨论"agent 该不该分离展示层与推理层"。

---

## U-020 · claim: 外循环补丁解决不了内循环稀释

**Content (neutral)**: 对话上下文膨胀的根源是"外循环(对话)与内循环(工具调用、推理)的产物混在一起"——这只是多脉络挤占同一上下文问题中最显眼的一面。光给外循环打补丁,内循环的稀释并不会消失。

**Source**: share.md §1.5 / §2.2

**Load-bearing for (original)**: 为 §2.2 批评现有 harness 方案做底。

**Reusable for**: 分析任何"加点 memory / 加点 summary 就行"类方案的局限。

---

## U-021 · claim: 对话范式在跨天跨话题任务上已到边界

**Content (neutral)**: 当任务跨越多天、多个话题持续推进时,把所有内容塞进一条对话的做法达到了它的边界——上下文要么膨胀到无法使用,要么被迫开新会话丢失连续性。

**Source**: share.md §1.5

**Load-bearing for (original)**: 第一部分的结论句,开启第二部分。

**Reusable for**: 开场问题陈述;讲长期运行 agent 的难点。

---

## U-022 · anecdote: 三天维护中型项目的典型场景

**Content (neutral)**: 一个具体设想:让 agent 维护一个中型项目三天。第一天排查 bug 并加新功能;第二天发现 bug 没修干净、回到老话题,同时提出新的重构;第三天把所有改动整理成 PR 说明。这是真实工作里普通的三天,却在对话模式下极难实现。

**Source**: share.md §2.1

**Load-bearing for (original)**: 贯穿第二部分的具象场景,后面 §2.5 的时间轴图也复用它。

**Reusable for**: 任何需要"把抽象问题变成一个能想象的任务"的开篇;讲长期 agent 的痛点时的标准示例。

---

## U-023 · claim: "同一对话"与"开新对话"两头不讨好

**Content (neutral)**: 面对跨天任务,放在同一对话里意味着第一天下午上下文就开始严重膨胀、第三天基本不可用;每次开新对话意味着模型是白纸,用户每次都要重讲一遍——而用户自己都不一定记得全。

**Source**: share.md §2.1

**Load-bearing for (original)**: 展示现状的两难,使"需要新范式"成为必然。

**Reusable for**: 讲会话粒度选择;讲记忆系统的必要性。

---

## U-024 · diagram: 现有方案对比表

**Content (neutral)**: 图 2.2 表格。五种主流方案按"作用域 / 本质 / 局限"三列排开:
- Compaction:对话内;有损压缩历史;细节丢失
- 持久化 transcript:跨对话;按需回查;不持续在场
- CLAUDE.md:会话起点;手写起手素材;需要维护
- Auto memory:会话起点;自动积累起手素材;只在起点加载
- 24h Synthesis:跨对话;合成关键洞察;粒度粗

底部注:"共同前提——对话是上下文主体,只是让对话跑得更久。"

**Source**: share.md §2.2 图 2.2

**Load-bearing for (original)**: 一张图完成"现有方案综述 + 集体局限"两件事。

**Reusable for**: 任何 harness 横向对比;任何讨论 memory/context 系统取舍的文章。

---

## U-025 · claim: 主流 harness 方案共享同一隐含前提

**Content (neutral)**: 主流 harness 给出的解法看似各异,但共享一个未被质疑的前提:"对话是上下文的主体,目标是让对话能跑得更久"。这个前提限定了所有方案的天花板。

**Source**: share.md §2.2

**Load-bearing for (original)**: 直接指向"要换前提"的路径,推出事件流方案。

**Reusable for**: 任何希望从架构层质疑既有做法的论述;"补丁还是重构"类讨论。

---

## U-026 · claim: 现有方案没有区分内外循环

**Content (neutral)**: 现有的 memory / compaction / 历史搜索方案几乎都作用在外循环(对话)上——memory 是对话的起手素材,compaction 是对话的内部压缩,历史搜索是对话之外的回查通道。没有一类方案真正处理"内循环(agent 自产自消的工具调用与推理)"本身。

**Source**: share.md §2.2

**Load-bearing for (original)**: 把 U-008 的内外循环概念与 U-013 的四件套连起来,形成批评。

**Reusable for**: 任何要指出"现有 memory 系统视角不全"的论述。

---

## U-027 · claim: 真正的出路是不要让对话当上下文主体

**Content (neutral)**: 既然所有补丁都撞在"对话是上下文主体"这一前提上,真正的出路是换掉这个前提——让对话退到一条脉络,上下文主体交给别的结构。

**Source**: share.md §2.2 / §2.3

**Load-bearing for (original)**: 全文论证的转折点。

**Reusable for**: 任何倡议架构层重设计的开篇;从"优化方案"切换到"替换前提"的 pivot 句。

---

## U-028 · definition: 工作区信息流

**Content (neutral)**: 工作区信息流是一种替代对话的上下文形态:把"项目当前正在发生什么"以客观记录的形式排成一串——系统通知、任务派发、完成报告等。每条都是高密度的结构化事件,不含礼貌措辞、过程性表达、工具原始输出。

**Source**: share.md §2.3

**Load-bearing for (original)**: 引入第二部分的核心替代方案。

**Reusable for**: 讲 event-driven agent;讲结构化上下文;讲"不是对话"的 agent 交互。

---

## U-029 · claim: 事件流的本质是把多条脉络各自单独成线

**Content (neutral)**: 事件流方案的本质不是换了一种数据格式,而是把原本挤在一条对话里的多条脉络——任务执行、跨会话观察、异步协作、定时复盘——各自单独拎出来成线。对话没消失,但从"全部上下文"降格为"其中一条"。

**Source**: share.md §2.3

**Load-bearing for (original)**: 把表面的格式差异还原为结构层变化。

**Reusable for**: 解释 event-based 架构对比 chat-based 架构的根本差别;强调"不是加功能,是换维度"。

---

## U-030 · definition: Worker 与完成报告的关系

**Content (neutral)**: 每个具体任务由一个独立的对话式 agent(称 worker)完整执行;worker 任务完成后,整段对话被压成一条几十字级别的"完成报告",作为事件写入上一层。worker 本身短生命周期、任务结束即销毁。

**Source**: share.md §2.3 / §2.4 / §2.5

**Load-bearing for (original)**: 确立 L0 的基本单位与 L0 → L1 的交互协议。

**Reusable for**: 任何分层 agent 设计;讲 worker-coordinator 模式。

---

## U-031 · diagram: 对话模式 vs 事件流模式可视化

**Content (neutral)**: AI 图 2.3。两个同等大小的上下文窗口并排。左侧对话模式:内部密集排列 user / assistant / tool 往返消息,颜色交织、拥挤、压抑。右侧事件流模式:稀疏的几条结构化事件(系统通知 / 任务派发 / 完成报告),每条独立成块,有明显呼吸空间——信息密度高但视觉留白多。核心对比是相同窗口容量下两种结构的装载效率差异。

**Source**: share.md §2.3 图 2.3(AI 图示描述)

**Load-bearing for (original)**: 让"信息密度"从概念变成视觉直觉。

**Reusable for**: 任何文章的"范式对比"视觉;讲上下文效率的直觉图。

**Notes**: 是对设计师的 brief,不是成图。复用时仍需生成或绘制。

---

## U-032 · definition: 上下文的纵向分层 L0 / L1 / L2

**Content (neutral)**: 上下文按时间尺度分层:
- **L0**:对话式 worker,执行具体任务,任务结束即销毁
- **L1**:统筹层,上下文是事件流,每条事件是下层的完成报告
- **L2 及以上**:按场景需要,更高层把下层事件流进一步抽象

每往上一层,信息密度更高、积累速度更慢、时间跨度更长。

**Source**: share.md §2.4

**Load-bearing for (original)**: 全文的架构骨架。

**Reusable for**: 任何讲分层 agent / hierarchical context 的文章。本文的标志性结构概念。

---

## U-033 · metaphor: 分层类似公司管理结构(工程师/经理/总监)

**Content (neutral)**: L0/L1/L2 的信息粒度类似公司的三层管理:一线工程师关心"这个函数的这个 bug",部门经理关心"这个模块这周的进展",总监关心"这个产品线这个季度的方向"。总监不该也不需要知道每个 ticket 的细节,他该看到的是被压缩过的高层事件。

**Source**: share.md §2.4

**Load-bearing for (original)**: 把抽象的分层结构落到读者熟悉的组织画面。

**Reusable for**: 解释信息分层;讨论 management abstraction;agent 与人组织协作时的岗位映射。

---

## U-034 · claim: 上下文架构还有横向分模块维度

**Content (neutral)**: 除了纵向分层,同一层内还可以并存多条独立脉络:L0 层同时可以有几十个 worker 各跑各的,L1 层的同一条事件流也可以被多个订阅方共用,每个订阅方只看自己关心的事件类型、各自跑各自的处理循环。

**Source**: share.md §2.4

**Load-bearing for (original)**: 补齐"架构"概念的第二个轴。

**Reusable for**: 讲并行 worker;讲 pub-sub 型 agent 架构;讲事件流订阅模型。

---

## U-035 · metaphor: 上下文架构 = 软件架构

**Content (neutral)**: 上下文架构与软件架构同构:纵向分层决定信息密度,横向分模块决定职责边界。对话式 agent 撑不住的原因在于它是一份没有结构的 god file;事件流架构做的事情就是把它拆成该拆的层和该拆的模块。

**Source**: share.md §2.4

**Load-bearing for (original)**: 全文最抽象、最有复用力的一句结构论断。

**Reusable for**: 任何把"架构思维"从代码扩展到其他领域的场合;讲 agent infra 的哲学开篇。

---

## U-036 · diagram: 分层结构示意(L0 / L1 / L2 ASCII + 封面级 AI 图)

**Content (neutral)**: 图 2.4。底层 L0 是多个并排的对话窗口(短生命、任务结束即销毁);中层 L1 是单个上下文窗口里稀疏排列的结构化事件(任务级积累);顶层 L2 更窄,仅有几条高度抽象的摘要事件(周/月级)。层间有"派发任务 + 投影事件"向下、"结构化完成报告"向上的箭头。右侧辅助注:L0 = 工程师 / L1 = 部门经理 / L2 = 总监。

**Source**: share.md §2.4 图 2.4(AI 图 + ASCII 简化版并存)

**Load-bearing for (original)**: 全书封面级概念图,承载整篇结构命题。

**Reusable for**: 新文章的骨架图;任何分层 agent 方案的顶层视图。

**Notes**: 原文同时提供了 AI 图描述与 ASCII 快速参考。复用时二选一或全留。

---

## U-037 · diagram: 三天时间轴 · L1 持续 / L0 生灭

**Content (neutral)**: 图 2.5。横轴为 Day 1 / Day 2 / Day 3;L1 事件流横贯三天,连续积累[bug]→[功能]→[再排查]→[重构]→[整理 PR] 等事件;L0 在各时间点启动多个短生命周期 worker,执行完销毁。图示核心:L1 持续存在、L0 不断生生灭灭。

**Source**: share.md §2.5 图 2.5

**Load-bearing for (original)**: 把 U-022 的三天场景落到分层结构里,作为分层方案的最终说明。

**Reusable for**: 讲长期 agent 的可视化;做"分层带来的稳定性"直觉展示。

---

## U-038 · claim: 分层解决了上下文膨胀与对话退化的两难

**Content (neutral)**: 分层结构下,L0 是若干短生命周期对话(完成后销毁、只留报告),L1 是长生命周期的事件流(积累全程的任务报告)。第三天执行"整理 PR"任务时,L1 的上下文就是三天的高密度事件流,不需要回忆。于是两个问题同时被解决:上下文不再膨胀(几十条事件 vs 几十万字原始对话),对话质量不再退化(每个 L0 都短、聚焦、新鲜)。

**Source**: share.md §2.5

**Load-bearing for (original)**: 给分层方案下一个结论性的"它解决了什么"。

**Reusable for**: 分层方案的卖点总结;与其他方案对比时的 TL;DR。

---

## U-039 · claim: 现有 harness 让对话同时做两件事所以都做不好

**Content (neutral)**: 当前 harness 让同一条对话同时承担"任务执行"和"长期积累"两件事,两边都被挤压、都不够好。拆到不同层各自承担,两边都回到舒服的工作区间。

**Source**: share.md §2.5

**Load-bearing for (original)**: 一句话收束第二部分。

**Reusable for**: 对比论述;"单一职责"原则在 agent 上下文上的应用。

---

## U-040 · definition: 事件的判断标准

**Content (neutral)**: 事件是一次状态变化的最小可陈述单元。唯一判断标准:这条事件在离开原上下文后是否仍能独立被理解。外部世界(webhook、告警、用户消息)产生的状态变化以同样格式写进事件流。

**Source**: share.md §3 Q1

**Load-bearing for (original)**: 给"事件"下可落地的定义。

**Reusable for**: 实际系统设计;事件溯源模式迁移到 agent 场景时的指导。

---

## U-041 · mechanism: Worker 派发只给目标 + 事件子集

**Content (neutral)**: L1 向 worker 派发任务时给两样东西:一句话明确目标,以及从事件流中裁剪出的相关事件子集——不是整条事件流。Worker 不知道 L1 完整事件流的存在。**记忆的归属在 L1,不在 worker**。

**Source**: share.md §3 Q2

**Load-bearing for (original)**: 防止 worker 越权访问上层记忆,维持分层边界。

**Reusable for**: 讲 agent 权限设计;讲 context injection 的粒度控制;讲"prompt 最小暴露"。

---

## U-042 · mechanism: 压缩是按 schema 抽取,不是摘要

**Content (neutral)**: Worker 完成后,用独立模型按固定 schema 从整段对话里抽取:做了什么、结果、改动文件、遗留风险、未完成事。压缩不是摘要,是按字段抽取。使用独立调用是为了避开 worker 自己的主观色彩——让 worker 总结自己,它会倾向性地美化。

**Source**: share.md §3 Q3

**Load-bearing for (original)**: 给"完成报告"一个可实现的生成机制。

**Reusable for**: 讲结构化输出;讲 agent 自评的偏差问题;讲 schema-driven summarization。

---

## U-043 · metaphor: Worker 自评像工程师写周报会美化

**Content (neutral)**: 让 worker 总结自己做了什么,它会像工程师写周报一样倾向性地美化——省略失败、放大进展、淡化遗留。因此压缩必须由独立模型执行,以避开这种主观偏差。

**Source**: share.md §3 Q3

**Load-bearing for (original)**: 给"独立压缩模型"这一设计的合理性补上直觉锚点。

**Reusable for**: 讲 agent 自评局限;讲评估/执行分离;讲为什么需要第二双眼睛。

---

## U-044 · mechanism: L1 每轮三种动作(不是 if-else)

**Content (neutral)**: L1 的每一轮上下文里,下一步动作有三种:直接响应用户 / 派新 worker / 向上汇报。这不是硬编码的 if-else,而是 L1 基于事件流"预测"出来的行为。若规则写多,L1 就不再是 agent,而是一台以 LLM 当 CPU 的复杂 workflow 引擎。

**Source**: share.md §3 Q4

**Load-bearing for (original)**: 明确 L1 是 agent 不是流程图。

**Reusable for**: 讲 agent 自由度与 workflow 的边界;讨论"规则多到某个阈值就不再是 agent"。

---

## U-045 · mechanism: 防泄漏与防丢失的两项约束

**Content (neutral)**: 两个边界由压缩层承担:
- 防泄漏:worker 完成后的压缩是硬边界,L1 永不读 worker 原始对话。
- 防丢失:压缩 schema 强制包含"遗留风险"与"未完成事"字段;即便 worker 主观认为修完了,只要对话里提过的风险都必须填入这些字段。

**Source**: share.md §3 Q5

**Load-bearing for (original)**: 给事件流机制闭环两项关键安全性质。

**Reusable for**: 讲 agent 层级隔离;讲"强制字段 vs 自由摘要";讲信息不漏且不泄。

---

## U-046 · fact: 最小原型规模(200–500 行)

**Content (neutral)**: 搭建一个可运行的最小原型所需组件:复用现成 L0 runtime(Claude Code / Codex / Agents SDK 等)+ append-only 事件存储(JSONL 或 SQLite)+ L1 主循环 + 独立压缩调用。总体 200–500 行代码可跑通。

**Source**: share.md §3

**Load-bearing for (original)**: 让读者相信"这不是一个需要大团队的重构项目"。

**Reusable for**: 讲可行性;号召实验/原型的场合;说明 harness 的复杂度不在代码量。

---

## U-047 · claim: 真正的复杂度在事件 schema,不在机制

**Content (neutral)**: 分层 harness 的机制是通用的、可复用的;真正困难的是为具体业务设计合适的事件 schema——这要求对业务的深度理解,不能由通用方案替代。

**Source**: share.md §3 / §4.2 / 结语

**Load-bearing for (original)**: 贯穿后半篇,直到结语再强调一次。

**Reusable for**: 讲 agent 落地的工程重点;回应"有了通用 harness 就够了吗";指导团队把精力放在哪里。

---

## U-048 · definition: 业务环境需要满足的两个条件

**Content (neutral)**: 分层 harness 要在具体业务里跑起来,业务环境必须同时满足两个条件:
1. **业务状态对 agent 可读**(如 MCP 协议在做的 tool / resource 标准化)
2. **业务动作对 agent 可写**(每个业务动作封装成 agent 可调 API)

**Source**: share.md §4.1

**Load-bearing for (original)**: 把 agent 落地不力的原因从"模型不行"转到"基础设施不齐"。

**Reusable for**: 企业 agent 可行性评估;MCP 协议的作用说明;基础设施投入的优先级讨论。

---

## U-049 · metaphor: 只读是分析器,只写是傀儡

**Content (neutral)**: 只读不写,agent 只能是分析器,产出观点但改变不了世界;只写不读,agent 则是傀儡,执行动作却不知道状态。两者都非真正意义的自主体。

**Source**: share.md §4.1

**Load-bearing for (original)**: 给两个条件一个直觉性落点。

**Reusable for**: 讲 agent 自主性前提;讲 MCP / tool use 双向缺一不可。

---

## U-050 · claim: Agent 落地失败常因业务基础设施,而非 agent 本身

**Content (neutral)**: 许多公司尝试 agent 效果不佳,根源通常不在 agent 自身,而在业务系统:状态不结构化、关键动作没有 API、每次调用都要 session 认证等——基础设施不齐的情况下,再好的分层 harness 也落不下来。

**Source**: share.md §4.1

**Load-bearing for (original)**: 现实校准——提醒读者 agent 效果不靠模型/prompt 单打独斗。

**Reusable for**: 反驳"agent 没用"的归因;企业咨询视角的诊断清单。

---

## U-051 · claim: "AI 岗位"是常见过大 scope 错误

**Content (neutral)**: 想让 agent "做某个岗位的全部"("AI 客服" / "AI 工程师" / "AI 运维")是常见错误——scope 太大、目标模糊、效果飘忽。

**Source**: share.md §4.2

**Load-bearing for (original)**: 为"工位化"做反面铺垫。

**Reusable for**: 回应市场宣传式 agent 叙事;做"应当怎样拆分"前的对照组。

---

## U-052 · definition: 工位化 — 岗位拆成最小执行单元

**Content (neutral)**: 工位化把岗位拆成一个个工位,每个工位具备三要素:
- 明确的输入事件(工单创建、代码提交、告警触发)
- 明确的输出动作(回工单、改代码、升级告警)
- 明确的完成标准(工单关闭、PR 合并、告警消除)

单个工位不足以成一份岗位,但加起来占据大量人力。

**Source**: share.md §4.2

**Load-bearing for (original)**: 给"agent 该接管什么"一个可落地的切分方式。

**Reusable for**: 企业 agent 落地方法论;工作流拆解;业务流程梳理。

---

## U-053 · claim: 事件 schema 从业务工位自下而上长出来

**Content (neutral)**: 工位定义清楚之后,事件流的结构就自然跟着定下来——事件 schema 不是从架构角度自上而下设计出来的,而是从业务工位自下而上长出来的。

**Source**: share.md §4.2

**Load-bearing for (original)**: 回答"事件 schema 怎么来"。

**Reusable for**: 任何关于 agent schema 设计方法论的讨论;指导团队从业务而非架构出发。

---

## U-054 · example: 客户投诉处理流水线(横向分模块示例)

**Content (neutral)**: 客户投诉处理场景的 agent 流水线可以这样组织:
- 客服工位:订阅"客户消息"→ 产出"工单创建"
- 分类 agent:订阅"工单创建"→ 产出"工单分配"
- 处理工位:订阅"工单分配"→ 产出"工单处理中 / 已解决"
- 客服工位:订阅"工单已解决"→ 产出"客户回复"
- 复盘 agent:每日全扫,生成报告,不写回事件流

五个 agent 之间没有一句对话,完全通过事件流协作;没有中央调度器——事件流本身就是调度。

**Source**: share.md §4.3 图 4.3

**Load-bearing for (original)**: 给"横向分模块"一个具体的业务场景实例。

**Reusable for**: 讲 agent 流水线;讲事件驱动多 agent 架构;讲"没有中央调度"的 pub-sub 协作。

---

## U-055 · claim: 大厂做基础设施,小团队做业务层

**Content (neutral)**: 基础设施层(模型、通用 harness、记忆系统)由大厂推动,会持续变好;真正的价值和竞争在业务层——某个行业的工位如何拆、事件 schema 是什么、敏感度档位如何定、哪些工位适合 agent。这些问题通用方案答不上来,需要行业内的人自己长出来。

**Source**: share.md §4.4

**Load-bearing for (original)**: 给小团队一个清晰的战略定位。

**Reusable for**: agent 创业定位;大厂 vs 行业玩家的分工论述。

---

## U-056 · example: 同一类业务不同场景 schema 不同

**Content (neutral)**: 同样是"客服",SaaS 客服和电商客服需要的事件 schema 不一样;客服行业与 devops 行业需要的工位完全不同。通用方案无法一次性覆盖这些差异。

**Source**: share.md §4.4

**Load-bearing for (original)**: 支撑 U-055 中"需要行业深度理解"的论断。

**Reusable for**: 反驳"做一个通用 agent 产品";讲垂直化价值。

---

## U-057 · claim: 分层 harness 只是容器,决定效果的是装什么

**Content (neutral)**: 分层 harness 本身只是一个承载容器,真正决定效果的是容器里装的内容——业务的工位拆法、事件 schema、各层的过滤规则。通用层交给大厂,业务层由领域内的人自己长出来。

**Source**: share.md §4.4 / 结语

**Load-bearing for (original)**: 把前面所有铺垫收束到"容器 vs 内容"这一对概念上。

**Reusable for**: 收束段;"平台 vs 应用"结构的类比;讨论 agent 生态分工。

---

## U-058 · claim: Agent 方向不是发明新机制,而是把已有零件拼起来

**Content (neutral)**: 所有必要的零件——短生命周期 worker、事件流、schema 化压缩、分层上下文——已经在 Claude Code、Codex、Hermes 等系统里逐块长出来。下一步不是再发明什么,而是把这些零件按业务需要拼起来、真正跑起来,把 agent 从"陪聊助理"变成"长期驻守在工位上的执行者"。

**Source**: share.md §4.4 / 结语

**Load-bearing for (original)**: 全文结语的主张。

**Reusable for**: 任何展望 agent 未来工程化路径的结尾;号召动手而非空想。

---

## 参考资料

**References cited in source**:
Claude Code 2.1.88+ · OpenAI Codex Harness · Nous Research Hermes Agent · OpenAI Agents SDK

**Stored in**: share.md 末尾参考系统列表。作为可验证的系统实例,任何涉及"现有 harness"的新文可复用该组引用。

---

## 未分配 / 未使用单元

(目前为空。Phase 2 reskeleton 时据新文目标勾选需要的 ID,并把未勾选的单元在此归档。)
