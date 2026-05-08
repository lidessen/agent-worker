# Part1

下面这版我尽量把 Claude Code 拆成“真实运行机制”而不是产品介绍。结论先放前面：

**Claude Code 本质上不是“一个 agent”，而是一个把 Claude 包装成可执行编码代理的 harness。**

官方现在已经明确，Claude Agent SDK 复用了 Claude Code 的 **tools、agent loop、context management**；而社区围绕 `@anthropic-ai/claude-code@2.1.88` sourcemap 暴露源码所做的分析，补上了很多官方文档没有展开的实现细节。换句话说，官方文档给你抽象层，社区分析给你机械结构。([Claude API Docs](https://docs.anthropic.com/en/docs/claude-code/sdk))

---

## 1. Claude Code 的核心抽象：不是“回答器”，而是“循环执行器”

从官方视角，Claude Code / Agent SDK 的基本 loop 很标准：

1. 收到 prompt
2. 模型评估当前状态
3. 产出文本和 / 或 tool call
4. 执行工具
5. 将工具结果回灌给模型
6. 重复，直到没有 tool call 为止
7. 返回最终结果和 usage / cost / session 信息。([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

但社区对 2.1.88 的分析认为，**这个 loop 只是骨架，真正的工程价值在 loop 外围的脚手架**。他们把 Claude Code 总结成一套“生产级 agent harness”：启动时的 fast path、延迟加载、system prompt 组装、流式工具执行、上下文压缩、权限判定、遥测、故障恢复等。也就是说，Claude Code 的难点不是“会不会 while(tool_call)”，而是“如何让这个 while 在真实世界里不炸锅”。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

---

## 2. agent loop 的关键不是循环本身，而是“流式中途插刀”

官方文档已经说明，Claude Code 的输出和 tool call 都支持 **streaming**。tool call 会以增量事件流的方式出现，例如 `content_block_start`、`content_block_delta`、`content_block_stop`，你可以在输出流里实时观察工具输入是怎么一点点生成的。([Claude](https://code.claude.com/docs/en/agent-sdk/streaming-output))

社区对 2.1.88 的一个最重要观察是：**Claude Code 并不是“等整段回答完整生成后再统一解析 tool call”，而是 mid-stream tool execution**。他们提到 `StreamingToolExecutor` 会在工具调用边界一出现时就触发执行，而不是等整轮 assistant response 完结后再处理。这个设计的意义很大：

- 交互体感更快
- 模型和工具执行可以更流水线化
- 长链任务不会被“完整生成再执行”的串行延迟拖死。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

这点很像把 agent loop 从“批处理”做成了“边说边做”的装配线。很多 demo agent 还是厨房里先把菜单写完再开火，Claude Code 更像厨师一边报菜名一边下锅。

---

## 3. tool execution 不是简单串行，而是带并发策略和预算控制的

官方文档确认，Claude Code / SDK 内部有完整的 tool execution 机制，包括 built-in tools、权限模式、hooks，以及并行工具执行。它会在一个 turn 内执行工具，再把结果回传给 Claude 继续下一轮推理。([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

社区分析进一步指出，在 2.1.88 里，工具不是一把梭哈全并发，而是带 **concurrency safety** 判断。社区提到类似 `isConcurrencySafe()` 的策略，允许读类工具并发、写类工具串行，避免多个编辑 / shell side effect 互相打架。并且工具结果还会经过预算裁剪，防止一次 tool output 把上下文直接灌爆。这个判断很符合 Claude Code 的产品定位：它不是学术 agent，而是要在真实 repo 上读文件、改文件、跑命令。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

你可以把它理解成：

**LLM 是大脑，tool executor 是调度器，真正维持秩序的是交通灯。**

---

## 4. 上下文管理才是 Claude Code 的真正中轴

官方文档对这一点说得很直白：**context window 是 Claude 在会话中“知道的一切”**，它不会在 turn 之间自动清空，而是持续积累 system prompt、tool definitions、conversation history、tool inputs、tool outputs 等内容。接近上限时，会自动进行 compaction，用摘要替换旧历史；发生 compaction 时，SDK 还会发出 `compact_boundary` 事件。([Claude](https://code.claude.com/docs/en/context-window))

官方还给了更细的 context 分层：

- 会话开始前就加载：`CLAUDE.md`、auto memory、MCP tool names、skill descriptions
- 会话过程中增长：文件读取内容、路径规则、工具结果
- `/compact` 之后：旧对话被结构化摘要替换，但不少启动内容会重新加载。([Claude](https://code.claude.com/docs/en/context-window))

社区分析则把这套东西讲得更“工程”一些。他们认为 2.1.88 不把上下文当成被动容器，而是当成一种 **有限资源管理系统**。社区提到它存在多种压缩策略，按优先级逐步触发，例如裁剪重复 system message、微压缩近期 tool result、折叠长文件读取、最终再做整体总结。虽然这些压缩细节主要来自社区解读，不像官方文档那样是正式规范，但和官方公开的 compaction 机制是对得上的。([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

这也是 Claude Code 和很多“能跑就行” agent 最大的差别之一：

**它不是假装上下文无限大，而是承认上下文很贵，然后围绕这件事造了一整套节流阀。**

---

## 5. 跨会话记忆不是“历史全带上”，而是分层 memory

官方现在把记忆拆成两类：

- `CLAUDE.md`: 你写的、持久规则和项目说明
- auto memory: Claude 自己从纠正和偏好中沉淀的笔记。([Claude](https://code.claude.com/docs/en/memory))

这两类记忆都会在每次会话开始时重新加载，但它们只是 **context**，不是硬约束。Claude 仍然可能不完全遵守，所以官方强调内容要具体、简洁、结构化。`CLAUDE.md` 还支持多层级加载、按目录发现、`@path` 导入、规则文件 `.claude/rules/` 按路径按需加载。([Claude](https://code.claude.com/docs/en/memory))

几个很值得注意的点：

- 会话本身是 fresh context 开始的，不是“把上次整个对话历史原封不动带上”
- 跨会话延续靠 memory 文件和自动摘要，而不是靠无限历史
- auto memory 是每个 working tree 范围内的
- subagent 甚至可以维护自己的 auto memory。([Claude](https://code.claude.com/docs/en/memory))

这个设计挺克制。它没有把“记忆”做成神秘黑箱，而是尽量文件化、可审计、可编辑。某种意义上，这不是人在记忆，更像 repo 在长脑子。

---

## 6. skills、subagents、hooks、MCP 是四种不同层级的扩展点

官方文档把 Claude Code 的扩展点切得很清楚：

- **Skills**: prompt-based 的能力包 / 工作流
- **Subagents**: 隔离上下文的子代理
- **Hooks**: 生命周期外部的确定性逻辑
- **MCP**: 外部工具 / 数据源接入。([Claude API Docs](https://docs.anthropic.com/en/docs/claude-code/skills))

### Skills

官方说 skills 会在 session start 时只加载描述，完整内容在使用时按需加载。Claude Code 自带 `/simplify`、`/batch`、`/debug`、`/loop`、`/claude-api` 等 bundled skills。它们不是内建命令式逻辑，而是把一份 playbook 交给 Claude，让 Claude 用工具自己编排执行。([Claude API Docs](https://docs.anthropic.com/en/docs/claude-code/skills))

### Hooks

官方把 hooks 定义为 shell commands、HTTP endpoints、LLM prompts，在特定生命周期事件触发。关键是它们 **运行在 agent context 之外**，所以不吃上下文预算，而且能做 deterministic control，比如拦截、修改、阻止 tool call。([Claude](https://code.claude.com/docs/en/hooks))

### MCP

官方把 MCP 当成连接外部服务和工具的开放协议。Claude Code 可以通过 MCP 连接 Slack、GitHub、数据库等，而且 channel 机制本身也是基于 MCP server 做的。([Claude](https://code.claude.com/docs/en/agent-sdk/mcp?utm_source=chatgpt.com))

从架构上看，这四者分别对应四个层级：

- skill 改“行为模板”
- subagent 改“任务切分”
- hook 改“执行控制”
- MCP 改“外部感官和四肢”

---

## 7. subagent 的本质是“上下文隔离 worker”，不是迷你版主线程

官方对 subagent 的描述非常明确：它是 **独立 context window、独立 system prompt、特定 tool access、独立 permissions** 的专职 worker。适合把会污染主线程上下文的搜索、日志分析、review 等任务丢出去，让它做完只返回摘要。([Claude](https://code.claude.com/docs/en/sub-agents))

官方还强调两点：

- subagent 在单个 session 内工作
- subagent 完成后只把总结带回主会话，不把全部探索轨迹塞回主上下文。([Claude](https://code.claude.com/docs/en/sub-agents))

这意味着 subagent 的价值不是“多线程”本身，而是 **context firewall**。你让它去翻一百个日志文件，主线程只收到一段结论，不会被日志泥石流淹掉。官方甚至直接说，这正是它能缓解长会话上下文膨胀的原因。([Claude](https://code.claude.com/docs/en/how-claude-code-works))

社区对 2.1.88 的解读更激进一些。他们认为 Claude Code 的多代理并不依赖华丽的 graph framework，而是更接近 **进程 + 文件 / 消息传递** 的朴素工程实现，强调 cache 继承和低成本上下文复用。这个说法主要来自社区研究，不是官方保证，但它很好解释了为什么 Claude Code 的子任务体系更像“操作系统里的 worker process”，而不是“论文里的 multi-agent society”。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

---

## 8. agent teams 才是它真正的“团队管理”机制

如果说 subagent 是“会话内临时工”，那 **agent teams** 就是正式编制。官方文档把它定义为：多个 Claude Code 实例组成团队，一个 lead 负责协调、分派和综合，teammate 各自在独立 context 中工作，还能彼此直接通信。它是实验特性，默认关闭。([Claude](https://code.claude.com/docs/en/agent-teams))

官方对比 subagents 和 teams 时，给了很清楚的分界：

- subagent：单 session 内，汇总回主代理，适合只关心结果的 focused task
- agent team：跨独立 session，有共享任务列表，队友之间可直接发消息，适合需要讨论、挑战、协作的复杂任务。([Claude](https://code.claude.com/docs/en/agent-teams))

从团队管理角度看，Claude Code teams 有几块关键积木：

### 8.1 lead / teammate 结构

一名 lead 负责创建团队、分派工作、综合结果；每个 teammate 是一个独立 Claude 实例，各自持有自己的 context window。([Claude](https://code.claude.com/docs/en/agent-teams))

### 8.2 shared task list

官方直接说，team 通过 **shared task list** 协调。任务有 pending / in progress / completed 状态，还可以带依赖，不能在前置任务未完成时 claim。([Claude](https://code.claude.com/docs/en/agent-teams))

### 8.3 direct messaging

官方明确写了 teammates 可以 **message each other directly**，而不是所有通信都必须经过 lead 中转。这个设计非常关键，它意味着团队不是单纯“主控 + 工人”，而是带局部自治和横向沟通。([Claude](https://code.claude.com/docs/en/agent-teams))

### 8.4 成本和规模控制

官方提醒 teams 的 token 成本很高，因为每个 teammate 都是独立 Claude 实例，有自己的 context window。成本页甚至给出一个量级提示：某些模式下大约会到普通 session 的 7 倍左右。建议用 Sonnet、保持小团队、控制 spawn prompt、任务做小做独立。([Claude](https://code.claude.com/docs/en/costs))

所以从工程观感来说，agent teams 更像一个轻量分布式系统：

有 leader、worker、任务队列、消息通道、资源成本。

不是“几个 prompt 拼一起”，而是已经有了组织学的骨架。

---

## 9. 通信机制分两层：内部 agent-to-agent，外部 session-to-world

### 9.1 内部通信：team messaging

内部通信主要是 agent team 的 direct messaging。官方工具列表里已经出现了 `TeamCreate`、`TeamDelete`、`SendMessage`、`TaskCreate`、`TaskGet`、`TaskList`、`TaskUpdate` 等工具。尤其 `SendMessage` 的定义很说明问题：它既可以给 teammate 发消息，也可以按 agent ID 恢复 subagent。([Claude](https://code.claude.com/docs/en/tools-reference))

这说明在 Claude Code 内部，团队通信已经被工具化了，而不是 UI 层玩具。通信和任务调度都被抽象成 runtime capability。

### 9.2 外部通信：channels

外部通信靠 **channels**。官方定义 channel 是一个 MCP server，向 Claude Code session 推送外部事件。它可以是一条单向告警通道，也可以是双向聊天桥。Claude Code 会把 channel server 作为子进程启动，并通过 stdio 通信。([Claude](https://code.claude.com/docs/en/channels-reference))

这个机制很漂亮，因为它把“外部世界”收编成了 session 的事件源：

- 单向：webhook、CI、monitoring 告警推送给 Claude
- 双向：Telegram / Discord / iMessage 这类桥接，Claude 还能用 reply tool 回消息
- 还可以通过 trusted sender path 做权限转发，让你在远端批准 / 拒绝工具调用。([Claude](https://code.claude.com/docs/en/channels-reference))

如果把 Claude Code 想成一个正在终端里工作的开发者，channels 就像它的耳机和对讲机。

---

## 10. 权限系统不是单一确认框，而是多层安全闸门

官方公开的权限模式包括：

- default
- acceptEdits
- auto
- bypassPermissions。([Claude](https://code.claude.com/docs/en/how-claude-code-works))

同时官方 hooks 允许在 `PreToolUse`、`PostToolUse` 等节点拦截工具，甚至修改或阻止执行。([Claude](https://code.claude.com/docs/en/hooks))

社区对 2.1.88 的一个很亮眼的说法是 **permission racing**。他们认为 Claude Code 在做工具权限决策时，不是一个单线程同步审批，而是同时启动 hooks、AI classifier、用户确认三条路径，谁先给出安全可执行结论，谁先决定走向。这个说法来自社区源码考古，不属于官方承诺，但它解释了为什么 Claude Code 在大量常见操作上体感并不迟钝。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

这套思路挺像浏览器安全模型和 CI policy 的混血：

不是“相信模型”，而是“让模型、规则、用户确认三方赛跑”。

---

## 11. Claude Code 的一个隐藏设计哲学：把“昂贵能力”做成按需加载

官方多处都在强调按需加载：

- skills 描述先加载，正文触发时再进 context
- path-scoped rules 只在命中路径时加载
- subagent 用独立 context 吃掉脏活
- compaction 在高水位时自动触发。([Claude](https://code.claude.com/docs/en/context-window))

社区对 2.1.88 进一步提出了一个判断：Claude Code 的整体设计是围绕 **prompt / context economics** 展开的，很多模块的目的不是增加能力，而是减少“无意义进入主上下文”的内容，比如 deferred tools、mid-stream execution、tool result truncation、compression pipeline。这个判断和官方公开的 context cost / token management 逻辑是相当一致的。([Claude](https://code.claude.com/docs/en/costs))

所以 Claude Code 的设计不是一味堆功能，而是像一艘潜艇控制压载舱：

**每放进来一点能力，就要想办法别让它把主舱灌满。**

---

## 12. 如果把它抽象成一张架构图，大概是这样

我给你一个尽量贴近实物的抽象：

**A. 前台层**

CLI / IDE / Desktop / Web 只是交互表皮。真正逻辑不在 UI。([Claude API Docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview))

**B. 主会话 runtime**

负责 system prompt 组装、message lifecycle、tool registry、permission handling、checkpoint、cost / usage、streaming output。([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

**C. context engine**

负责加载 `CLAUDE.md`、auto memory、rules、skills 元信息、tool definitions、history；在高水位时 compaction。([Claude](https://code.claude.com/docs/en/context-window))

**D. execution plane**

built-in tools、MCP tools、hooks、Bash、LSP、WebSearch / WebFetch 等。部分可并发，部分受权限和 side effect 约束。([Claude](https://code.claude.com/docs/en/tools-reference))

**E. worker plane**

subagents 作为 isolated worker；agent teams 作为多会话协作系统。([Claude](https://code.claude.com/docs/en/sub-agents))

**F. event plane**

channels 把外部 webhook / chat / monitoring 推入 session，reply tool 和 permission relay 让 session 能反向出声。([Claude](https://code.claude.com/docs/en/channels-reference))

---

## 13. 对 2.1.88 社区版本，我认为最值得学的不是某个 feature，而是三条工程原则

### 第一条：agent 不是 prompt，agent 是 runtime

官方说 SDK 复用了 Claude Code 的 loop 和 context management；社区看完 2.1.88 源码后，几乎一致把重点放在 runtime scaffolding，而不是 prompt engineering。([Claude API Docs](https://docs.anthropic.com/en/docs/claude-code/sdk))

### 第二条：上下文不是“越大越好”，而是“越可控越强”

官方的 memory、rules、skills、subagents、compaction 都在做同一件事：让有价值的信息以合适粒度进入上下文。([Claude](https://code.claude.com/docs/en/context-window))

### 第三条：多代理不是“多开几个 LLM”，而是“引入组织机制”

agent team 的 lead、task list、direct messaging、成本管理，说明 Claude Code 正在从“单代理工具使用”走向“多会话协作系统”。([Claude](https://code.claude.com/docs/en/agent-teams))

---

## 14. 我对 Claude Code 核心机制的归纳

如果只用一句话总结：

**Claude Code 的核心设计，不是让 Claude 更会写代码，而是让 Claude 在有限上下文、真实工具、副作用、长任务和多人协作里，仍然能持续工作。** ([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

再压缩一点，就是四个关键词：

- **流式 loop**
- **上下文经济学**
- **隔离式 worker**
- **任务化协作 / 通信**

---

## 15. 需要保留的谨慎点

有几部分我建议明确区分“官方确认”和“社区推断”：

**官方确认的**

agent loop、context accumulation / compaction、skills / hooks / MCP / subagents / agent teams、channels、tool / task / team 相关公开接口。([Claude](https://code.claude.com/docs/en/agent-sdk/agent-loop))

**社区分析但未被官方正式写死的**

`StreamingToolExecutor` 的精确执行时机、具体 compression pipeline 的层级、permission racing 的内部实现、以及一些未发布 feature 的完整度。这些都很有参考价值，但更适合看作“高可信解读”，不是稳定 API 契约。([GitHub](https://github.com/ringmast4r/674019130-learn-real-claude-code?utm_source=chatgpt.com))

---

# Part2

先给一句总判断：

**Claude Code 和 Codex 更像“为 coding 场景特化的 agent harness”，OpenAI Agents SDK 更像“通用编排框架”，Hermes Agent 更像“带长期学习回路的个人代理系统”。** 这四者都能跑 agent loop，但它们想解决的问题不一样。Claude Code 和 Codex 更在意“怎么在代码仓库里持续做事”，OpenAI Agents SDK 更在意“怎么让你搭出自己的多代理系统”，Hermes Agent 更在意“代理如何跨会话积累技能和用户模型”。 ([Claude](https://code.claude.com/docs/en/overview))

---

## 1. 先看最底层：它们都是什么类型的东西

### Claude Code

Claude Code 是 Anthropic 的 agentic coding system，能读代码库、改文件、跑命令，并且它的官方文档已经把很多内部机制产品化了，比如 subagents、agent teams、channels、hooks、memory、skills。它不是单纯 SDK，而是一个已经成型的 coding runtime。 ([Claude](https://code.claude.com/docs/en/overview))

### Codex

Codex 现在官方明确把自己描述为一个 **harness**，其 CLI / Cloud / VS Code 体验背后共享一套核心 agent loop 和执行逻辑。OpenAI 还专门发了一篇技术文章讲 Codex harness 如何围绕 Responses API 组织 prompt、tools、context 和循环执行。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

OpenAI Agents SDK 不是一个现成的 coding agent，而是一个通用 agent framework。官方定义里，它负责让 agent 使用上下文和工具、进行 handoff、流式输出，并保留完整 trace。它是拿来“搭系统”的，不是直接交付一个像 Claude Code / Codex 那样完整的 coding 工具。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes Agent

Hermes Agent 来自 Nous Research，官方自述核心卖点是 **self-improving** 和 **built-in learning loop**。它强调从经验中创建和改进 skills、促使自己持久化知识、搜索过去会话，并构建对用户的持续模型。开发者文档还明确写了它的 agent loop 会处理 prompt 组装、provider 路由、压缩、重试、fallback model switching、父子 agent iteration budget 等。 ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

---

## 2. agent loop：四家都在转圈，但转法不一样

### Claude Code 的 loop

Claude Code 官方对外暴露的是典型工具循环：模型生成内容和 tool calls，工具执行后结果回灌，再继续，直到 assistant message 结束一轮。官方还强调它有 streaming output、context compaction、subagent / team 协作这些配套机制，所以 Claude Code 的 loop 不是孤立 while-loop，而是一个带上下文治理和扩展层的 runtime。 ([Claude](https://code.claude.com/docs/en/how-claude-code-works?utm_source=chatgpt.com))

### Codex 的 loop

Codex 的 loop 官方讲得最“源码味”。OpenAI 文章直接说 agent loop 是 Codex harness 的核心，负责协调用户、模型和工具之间的交互。更关键的是，它把 **context window management** 明确列为 harness 的责任之一，而且 Codex 通过 Responses API 来驱动整个循环。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK 的 loop

Agents SDK 的 loop 更抽象。它不替你预设 coding-specific 玩法，而是提供单代理 / 多代理编排基础件，包括 tools、handoffs、streaming、tracing。也就是说，它给的是齿轮箱，不是整车。你要不要做 coding harness、research harness、support harness，取决于你如何装配。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes 的 loop

Hermes 的开发者文档把 loop 的职责写得很具体：组装 system prompt 和 tool schemas、选择 provider / API mode、做可中断调用、执行串行或并发工具、维护消息历史、做压缩 / 重试 / fallback、追踪 parent-child agent 的 iteration budgets。这个 loop 比 Claude Code / Codex 更像一个“可切换后端的通用代理内核”，而且自带长期学习野心。 ([GitHub](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/agent-loop.md))

**一句话对比：**

- Claude Code：loop 已经和 coding 工作流深度焊死
- Codex：loop 也是 coding harness，但更明显建立在 Responses API 抽象上
- Agents SDK：loop 是你自己拼
- Hermes：loop 更像“可自我生长的代理内核” ([Claude](https://code.claude.com/docs/en/overview))

---

## 3. 上下文管理：Claude Code 最“制度化”，Codex 最“显式”，Hermes 最“成长型”

### Claude Code

Claude Code 公开了非常成体系的上下文管理：

- context window 会积累 conversation、文件内容、命令输出、`CLAUDE.md`、auto memory、skills、system instructions
- 接近上限会自动 compaction
- `CLAUDE.md` 和 auto memory 在 session 开始时重新加载
- subagents 可以把探索隔离到独立上下文里，只带摘要回来。 ([Claude](https://code.claude.com/docs/en/how-claude-code-works?utm_source=chatgpt.com))

这意味着 Claude Code 的上下文管理已经不是“尽量少塞点文本”，而是完整制度：启动上下文、路径规则、记忆文件、压缩、隔离 worker、状态可视化。 ([Claude](https://code.claude.com/docs/en/context-window?utm_source=chatgpt.com))

### Codex

Codex 官方文章把 prompt 构造和 context management 讲得很明确。它通过 Responses API 的 `instructions`、`tools`、`input` 形成初始 prompt，模型说明可以来自配置文件或内置 prompt 文件；而且随着对话增长，prompt 变长，harness 必须负责管理 context window。Codex 的表述更“显式编排”，像是在告诉你这台机器每根传动轴怎么接。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

Agents SDK 本身不预设 Claude Code 那种 memory 文件体系。它强调 additional context、handoffs、trace、tool use，但更偏向运行时 orchestration 和 observability，而不是替你规定一套跨会话 project memory 文化。换句话说，它提供容器，不替你设计仓储制度。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes

Hermes 这里味道最不同。它主打的不是“压缩上下文而已”，而是**从经验中持续生成 skills 和知识**，还能搜索自己的过去会话，形成对用户的不断加深的模型。再结合开发者文档里的 compression、history maintenance、iteration budget、child agents，可以看出 Hermes 的上下文策略更偏“长期人格化 / 长期能力积累”。 ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

**所以如果只看 context philosophy：**

- **Claude Code**: 把 context 当成稀缺工程资源来治理
- **Codex**: 把 context 当成 harness 必须明确操盘的输入面板
- **Agents SDK**: 把 context 留给你自己设计
- **Hermes**: 把 context 延伸成长期学习和用户建模系统 ([Claude](https://code.claude.com/docs/en/context-window?utm_source=chatgpt.com))

---

## 4. 子代理 / 团队管理：Claude Code 走得最远，Agents SDK 最灵活，Hermes 有父子预算，Codex目前更偏单 harness

### Claude Code

Claude Code 在这块是最完整、最“组织学”的。

它有两层：

1. **subagents**
    
    独立 context，用于隔离探索，最后回主线程摘要。适合研究、审查、日志排查这类会污染主上下文的任务。 ([Claude](https://code.claude.com/docs/en/sub-agents?utm_source=chatgpt.com))
    
2. **agent teams**
    
    独立 session 组成团队，有 lead、teammates、shared task list、inter-agent messaging、centralized management，而且 teammates 之间可以直接通信。官方还明确 teams 是实验特性，v2.1.32+ 可用，并提醒存在 session resumption、coordination、shutdown 限制。 ([Claude](https://code.claude.com/docs/en/agent-teams))
    

这已经很像微型组织系统了，不只是“子任务函数调用”。

### Codex

从目前公开材料看，Codex 官方文章重点仍放在 harness 和 agent loop 本身，还没有像 Claude Code 那样把 team orchestration 产品化公开成一套 lead / teammate / task list / messaging 机制。它当然可以通过工具和外部系统做更复杂编排，但官方目前公开强调的是 loop、Responses API、prompt construction、context management。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

Agents SDK 官方在 orchestration 里提供两种很重要的范式：

- **agents as tools**，也就是 manager-style workflow
- **handoffs**，把控制权交给其他 specialized agents。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents/orchestration?utm_source=chatgpt.com))

这比 Claude Code 更“框架化”。Claude Code 把团队模型做成现成机制，Agents SDK 则给你 handoff 和组合原语，让你自己定义团队形态。你可以做 leader-worker，也可以做 peer-to-peer，也可以做 router-agent。它更自由，但你得自己搭梁架柱。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes

Hermes 开发者文档里提到 **tracking iteration budgets across parent and child agents**，说明它至少有父子 agent 层级和预算管理概念。再结合它的长期学习定位，Hermes 更像“主代理带派生 worker”的成长型代理系统。不过就官方公开形态看，它没有像 Claude Code 那样把“团队任务列表 + teammate 直连通信”产品化讲得那么细。 ([GitHub](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/agent-loop.md))

**一句话：**

- 团队管理最成体系的是 Claude Code
- 最可编程的是 Agents SDK
- 最偏学习型父子架构的是 Hermes
- Codex 当前公开材料还更聚焦单 harness 的执行质量和安全性 ([Claude](https://code.claude.com/docs/en/agent-teams))

---

## 5. 通信机制：Claude Code 最像“有总线”，Agents SDK 最像“有协议”，Hermes 更像“内循环成长”，Codex 更像“本地执行中枢”

### Claude Code

Claude Code 的通信层做得最有意思，因为它不只有内部通信，还有**外部事件注入**。

- **内部**: team mates 直接 messaging，任务通过 shared task list 协调。 ([Claude](https://code.claude.com/docs/en/agent-teams))
- **外部**: **channels**。官方把 channel 定义成 MCP server，把外部事件推入运行中的 session。它可以是单向 alert / webhook，也可以是双向 chat bridge，还能通过 trusted sender path 远程 relay permission prompts。channels 目前是 research preview，需要 v2.1.80+ 且要求 claude.ai login。 ([Claude](https://code.claude.com/docs/en/channels-reference?utm_source=chatgpt.com))

Claude Code 在这里的感觉像是：

**agent 不只是坐在终端等你敲字，它还能被外部世界戳醒。**

### Codex

Codex 当前官方公开重点不是 channel-style 通信，而是把本地 agent loop 建立在 Responses API 上。它是一个本地 software agent，通过不同 endpoint 跑 inference，包括 ChatGPT login、OpenAI API、甚至本地 `--oss` 模式下的本地 Responses API 实现。它更像执行中枢，不像 Claude Code 那样把外部事件总线包装成一项显式产品能力。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

Agents SDK 的通信不是“现成 channel 产品”，而是**handoffs + traces + tools + MCP** 这一层协议化组合。它更强在可观察性，官方直接把 tracing 当成调试 agent workflow 的基础设施，trace 会记录模型调用、tool calls、guardrails、handoffs。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes

Hermes 更强调自身成长回路，而不是像 Claude Code 那样突出外部事件桥接。它确实支持多 provider、工具调用、父子 agent 预算和历史搜索，但它公开定位里的通信核心不是 “event bus”，而是“从经验与对话里继续生长”。同时它的官网明确提到可以从 Telegram 与云端运行中的代理交互，这说明它适合长期在线代理形态。 ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

---

## 6. 工具协议和开放性：Codex / OpenAI 走 Responses API 生态，Claude Code 走 MCP + 内建 runtime，Hermes 走多 provider 适配

### Claude Code

Claude Code 有 built-in tools，也能接 MCP。skills、hooks、plugins、channels、subagents 都是围绕 Claude Code runtime 自己组织起来的扩展层。它很完整，但生态中心仍然是 Claude Code 本身。 ([Claude](https://code.claude.com/docs/en/features-overview?utm_source=chatgpt.com))

### Codex

Codex 是 Responses API client。它的工具定义符合 Responses API schema，还支持用户通过 MCP servers 增加工具。官方也明确 endpoint 是可配置的，所以既能打 OpenAI hosted，也能打兼容 Responses API 的其他实现。这个方向非常“协议中心化”。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

Agents SDK 和 Responses API / tools / hosted tools 紧密配合，官方还明确提到 built-in tools 包括 web search、file search、computer use。它是做 agent orchestration 的标准件层。 ([OpenAI](https://openai.com/index/new-tools-for-building-agents/))

### Hermes

Hermes 在开发者文档里非常直接地写了 provider/API mode 选择，包括 `chat_completions`、`codex_responses`、`anthropic_messages`。这说明 Hermes 的核心诉求之一是**后端可替换**，它更像一个可以横跨多家模型接口的 agent engine。 ([GitHub](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/agent-loop.md))

---

## 7. 如果你最关心“团队管理 / 多代理通信”，它们的差异可以压成这样

### Claude Code

这是四者里最像“已经长出组织器官”的。

有 lead、teammates、shared task list、dependency-aware task claiming、direct messaging，还有 channels 把外部世界接进来。你甚至可以把它看成“终端里的小型协作 OS”。 ([Claude](https://code.claude.com/docs/en/agent-teams))

### Codex

公开重点仍是高质量单 harness 和 coding safety。它很强，但当前对外信息里，多代理团队管理不是它最亮的牌。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK

不是现成团队产品，但 orchestration primitive 最清晰。

你能自己做 router、manager、specialists、handoff graphs，还能用 tracing 看整条工作流。它像一套乐高 Technic，轮子、轴承、变速箱都给你，车身你自己焊。 ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes

更像长期在线 personal / autonomous agent，重心在 learning loop、skills 演化、跨会话记忆和父子预算，而不是把多人团队协作显式做成产品界面。 ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

---

## 8. 一个更尖锐的判断：它们各自最擅长解决哪种“痛”

### Claude Code 最擅长的痛

**长代码任务里，上下文会脏、任务会分叉、外部世界会打断。**

它的答案是 subagents、teams、channels、memory、skills、hooks。 ([Claude](https://code.claude.com/docs/en/sub-agents?utm_source=chatgpt.com))

### Codex 最擅长的痛

**如何把 coding harness 做得稳定、清晰、可解释、围绕 Responses API 一致运作。**

它对 loop、prompt construction、context management 的公开说明最透明。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### OpenAI Agents SDK 最擅长的痛

**你不想被某个现成产品的工作流绑死，而是想自己设计 agent topology、tool surface、handoff 方式和 tracing。** ([OpenAI开发者](https://developers.openai.com/api/docs/guides/agents-sdk))

### Hermes 最擅长的痛

**你不满足于“会话内会做事”，而是想让代理跨会话越来越懂你、会自己长技能、形成长期记忆和自我改进回路。** ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

---

## 9. 结合你前一条想问的“核心机制”，我给一个最终归纳

如果用一句偏架构的话来说：

- **Claude Code** 是把 **agent runtime + context governance + worker isolation + event ingress** 打包成现成 coding 系统
- **Codex** 是把 **agent loop + Responses API + coding harness discipline** 讲清楚并工程化
- **OpenAI Agents SDK** 是把 **tools / handoffs / traces / orchestration primitives** 交给开发者自己组装
- **Hermes Agent** 是把 **agent loop + long-term learning loop + skill evolution + user modeling** 融成一体。 ([Claude](https://code.claude.com/docs/en/overview))

---

## 10. 如果你是想做自己的 harness，我的建议会是这样

### 想做“Claude Code 那一路”

优先研究：

- context budget / compaction
- subagent isolation
- team task model
- external event channels
- memory file layering。 ([Claude](https://code.claude.com/docs/en/context-window?utm_source=chatgpt.com))

### 想做“Codex / OpenAI 这一路”

优先研究：

- Responses API 输入面板
- agent loop termination conditions
- tools schema
- handoffs / agents-as-tools
- tracing-first evaluation。 ([OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/))

### 想做“Hermes 那一路”

优先研究：

- learning loop
- skill synthesis and refinement
- cross-session memory retrieval
- parent-child iteration budgets
- provider abstraction / fallback。 ([Hermes Agent](https://hermes-agent.nousresearch.com/docs/))

---

# Part3

Let我先搜索 Hermes agent 的相关信息。信息已经足够充分了。以下是 Hermes Agent 核心机制的深入分析。

---

## Agent Loop

Hermes 的核心编排引擎是 `run_agent.py` 中的 `AIAgent` 类，约 9,200 行代码，负责从 prompt 组装到 tool 分发到 provider failover 的全部流程。它是一个同步编排引擎，单循环驱动一切。

**入口与执行模式。** `chat()` 是 `run_conversation()` 的薄包装，后者返回包含 `final_response`、消息列表、元数据和 usage 统计的字典。Hermes 支持三种 API 执行模式：`chat_completions`（OpenAI 兼容端点）、`codex_responses`（OpenAI Responses API）、`anthropic_messages`（Anthropic 原生 API）。三种模式在内部统一转换为 OpenAI 风格的 `role/content/tool_calls` 消息格式。

**Turn 生命周期。** 每一轮迭代的执行顺序是：生成 task_id → 追加用户消息 → 构建或复用缓存的 system prompt → preflight 压缩检查（上下文超过 50%）→ 构建 API 消息 → 注入临时 prompt 层（budget 警告、上下文压力）→ 应用 Anthropic prompt caching 标记 → 发起可中断的 API 调用 → 解析响应。如果模型返回 tool_calls，执行后追加结果，循环回到 API 调用步骤；如果返回文本，持久化 session 并返回。这是一个 ReAct 风格的 tool-calling 循环，直到 LLM 返回文本内容或迭代预算耗尽为止。

**可中断调用。** API 请求在后台线程中执行，主线程同时监听 response ready、interrupt event 和 timeout 三个信号。被中断时，API 线程的响应被丢弃，不会有部分响应注入对话历史。这使得用户可以随时用 Ctrl+C 打断 agent 并重定向。

**Tool 执行。** 单个 tool call 在主线程执行；多个 tool call 通过 `ThreadPoolExecutor` 并发执行，结果按原始调用顺序重新插入。标记为交互式的工具（如 `clarify`）强制串行执行。某些工具——`todo`、`memory`、`session_search`、`delegate_task`——被 `run_agent.py` 在到达 `handle_function_call()` 之前拦截，因为它们直接修改 agent 状态。

**Iteration Budget。** 默认 90 次迭代，在父子 agent 之间共享。70% 用量时注入 caution 提示，90% 时注入 warning 要求立即给出最终响应，100% 时 agent 停止并返回工作摘要。

**Fallback。** 当主模型因 429、5xx 或 401/403 失败时，按顺序尝试 `fallback_providers` 列表。辅助任务（vision、compression、web extraction、session search）各自有独立的 fallback 链。

---

## 多 Agent 协作

Hermes 当前的多 agent 能力以 **subagent delegation** 为核心，通过 `delegate_task` 工具实现。

**隔离模型。** 子 agent 以完全空白的对话开始，对父 agent 的对话历史、先前 tool 调用或任何之前讨论的内容一无所知。子 agent 的唯一上下文来自 `goal` 和 `context` 字段。每个子 agent 获得独立的对话线程、独立的终端会话，只有最终摘要进入父 agent 的上下文窗口。

**限制与安全。** 最多 3 个并行子 agent；不允许嵌套（子 agent 不能调用 `delegate_task`、`clarify`、`memory`、`send_message` 或 `execute_code`）；最大递归深度为 2（父 → 子 → 孙被拒绝）。默认每个子 agent 50 次迭代上限，可以按任务需要调低。子 agent 可以配置不同模型，将简单任务路由到更便宜的模型（如 Gemini Flash）以降低成本。

**当前阶段与演进方向。** Hermes 团队明确将当前能力定义为"delegation, not multi-agent"——子 agent 独立工作、不能互相通信、不能共享状态。真正的多 agent 意味着专门化角色、DAG 式任务分解、agent 间协作和崩溃恢复。这些能力在 GitHub issue #344 中作为未来路线图讨论，包括 checkpointing（子 agent 每次 tool call 后持久化状态）、stuck detection、跨平台协调等。

**`execute_code` 与 delegation 的分工。** `execute_code` 让 agent 编写 Python 脚本，通过 Unix domain socket RPC 调用 Hermes 工具，将多步骤工作流折叠到单次 LLM turn 中。中间 tool 结果不进入对话历史，只有脚本的 `print()` 输出返回给 LLM。经验法则：需要推理和判断的用 `delegate_task`，机械数据处理用 `execute_code`。

---

## Task 管理

Hermes 的 task 管理分布在几个层次上。

**todo 工具。** 内置的 `todo` 工具提供 agent 本地的任务状态管理，被 `run_agent.py` 直接拦截处理。它以 agent-level 的工作项列表形式存在，跟踪任务进度、阻塞项和下一步。

**Cron 调度。** Hermes 将定时任务作为一等 agent 任务处理。调度指令用自然语言描述，解析后存储在 `cron/` 目录中，到达调度时间时 agent loop 以完整的 memory 和 skills 访问权限运行任务，然后通过 gateway 路由输出。它和交互式 session 走同一条管线，只是触发方式从消息变成了时钟。

**Skills 系统作为程序性记忆。** Skills 遵循渐进披露模式：Level 0 只加载名称和描述（约 3,000 tokens），Level 1 按需加载完整内容，Level 2 加载 skill 中的特定引用文件。这本质上是一种 task 知识管理——将"如何做某事"的经验固化为可复用的程序性文档，下次类似任务时自动参考。学习闭环通过三个机制实现：skill 创建（复杂任务后自动组织）、memory 持久化（周期性更新 MEMORY.md 和 USER.md）、heartbeat trigger（定期维护 prompt）。

---

## 通信机制

**Gateway 架构。** Gateway 是一个常驻后台服务，连接 CLI、Telegram、Discord、Slack、WhatsApp、Signal 等 15+ 平台。每个平台有独立的 adapter，但共享同一个 session 路由层。在 Telegram 上开始的对话可以在终端继续，因为 session 绑定的是 ID 而非平台。

**Tool Registry 模式。** 工具系统采用集中式注册模式，每个工具在导入时自注册。注册链路是：`tools/registry.py`（无依赖）← `tools/*.py`（导入时调用 `registry.register()`）← `model_tools.py`（触发工具发现）← 各入口文件。工具按逻辑分组为 40 个 toolset，平台 preset 控制不同入口启用哪些 toolset。

**MCP 集成。** MCP 实现使用专用后台事件循环在守护线程中管理异步连接。连接后，外部工具被发现并转换为 agent 内部工具 schema，名称加 `mcp_{server_name}_` 前缀以避免冲突。

**Callback 表面。** agent 通过一组 callback 接口（`tool_progress_callback`、`thinking_callback`、`reasoning_callback`、`clarify_callback`、`step_callback`、`stream_delta_callback` 等）向不同前端（CLI、gateway、ACP）推送实时进度。每个 callback 在不同平台有不同的渲染行为。

**execute_code 的 RPC 通信。** agent 编写 Python 脚本后，Hermes 生成 `hermes_tools.py` stub 模块（包含 RPC 函数），打开 Unix domain socket 并启动 RPC listener 线程。脚本在子进程中运行，tool 调用经 socket 回到父进程。API keys 和凭证默认被剥离，脚本只能通过 RPC 通道访问工具。

---

## 上下文管理

Hermes 的上下文管理是整个系统中工程密度最高的部分。

**可插拔 Context Engine。** 上下文管理建立在 `ContextEngine` ABC 之上，内置的 `ContextCompressor` 是默认实现，但插件可以替换为其他引擎（如 Lossless Context Management）。引擎通过 `config.yaml` 中的 `context.engine` 字段选择。

**双层压缩系统。** 两层独立运行：

1. **Gateway Session Hygiene**（85% 阈值）——安全网，在 agent 处理消息之前运行，防止 session 在 turn 之间增长过大（如 Telegram/Discord 中的隔夜积累）导致 API 失败。
2. **Agent ContextCompressor**（50% 阈值，可配置）——主压缩系统，在 agent 的 tool loop 内运行，使用精确的 API 报告 token 数。

**压缩算法（四阶段）。**

Phase 1：裁剪旧 tool 结果（>200 字符的替换为占位符，无 LLM 调用）。Phase 2：确定边界——保护头部（system prompt + 首次交互）和尾部（按 token 预算向后走，默认至少保护最后 20 条消息），中间部分标记为待摘要。边界对齐确保不会拆分 tool_call/tool_result 消息对。Phase 3：用辅助 LLM 将中间部分生成结构化摘要（包含 Goal、Progress、Key Decisions、Relevant Files、Next Steps 等段落）。Phase 4：组装压缩后的消息列表。

**迭代式再压缩。** 后续压缩时，前一次的摘要会传递给 LLM，指示更新而非从头摘要。这样信息在多次压缩中得以保留——项目从"In Progress"移到"Done"，新进展被添加，过时信息被移除。

**Prompt Caching。** 针对 Anthropic 后端，系统在 prompt 中设置 cache breakpoints 实现前缀缓存。memory 采用冻结快照模式——session 启动时注入一次，整个 session 期间不变，确保 LLM 前缀缓存不失效。写入操作立即持久化到磁盘，但要到下一个 session 才会反映在 system prompt 中。

**Memory 四层体系。**

Hermes 实际上有四层 memory：MEMORY.md（约 2,200 字符，持久化环境事实、项目惯例、经验教训）、USER.md（约 1,375 字符，用户偏好和通信风格）、SQLite session 存档（FTS5 全文检索 + LLM 摘要）、以及可选的外部 memory provider。

MEMORY.md 和 USER.md 是 agent-curated 的——agent 用 `memory` 工具的 add/replace/remove 动作管理，有字符上限，满时需要合并或替换条目。没有 read 动作，内容自动注入 system prompt。

Session search 通过 SQLite FTS5 全文检索查找，搜索结果经 Gemini Flash 摘要后注入当前上下文。这是按需的跨 session 回忆能力，用于"上周我们讨论过 X 吗"这类查询。

外部 memory provider 方面，Hermes 内置 8 个插件（Honcho、OpenViking、Mem0、Hindsight、Holographic、RetainDB、ByteRover、Supermemory），同一时间只能激活一个，与内置 memory 并行运行。每个 provider 提供不同的能力组合：Honcho 做辩证式用户建模，Hindsight 做跨 memory 合成，Mem0 做服务端自动提取。

**压缩前的 memory flush。** Hermes 在压缩长对话之前会运行一个专门的 memory flush——一次独立的模型调用，只开放 memory 工具。未在此阶段被标记的事实不会在压缩后存活。这是 agent-curated memory 在上下文压力下的已知局限。

---

总体来看，Hermes Agent 的架构特征是：单 agent 核心 + 隔离式子 agent delegation，而非对等多 agent 通信；同步编排循环，tool 并发但 turn 串行；上下文管理重投入（双层压缩 + 可插拔引擎 + prompt caching），memory 走"小而精"路线而非无限增长。当前的多 agent 能力还停留在 delegation 阶段，距离 DAG 式工作流和 agent 间状态共享有明确的差距，但路线图上已经有清晰的分层规划。