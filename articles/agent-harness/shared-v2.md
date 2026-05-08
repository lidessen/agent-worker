# 从上下文演化看Agent Harness

这几年模型本身一直在变——更长的窗口、跨轮的 thinking、更细的 tool use 协议。但在模型能力之外，还有一条常被低估的主线：工具、记忆、多轮对话、跨 session 状态，最终都要被组织成模型能消费的上下文。Agent 之间的体验差异，很大程度上就来自 harness 怎么组织、裁剪和跨轮传递这些上下文。

这篇文章只聊这条线：喂给模型的这段文本，是怎么被组织起来的——塞进什么，裁掉什么，压成什么，分成几层。

下面用同一个例子来看：“LoginForm 的 Submit 按钮偶尔点了没反应。”

同一个问题，会把同一份上下文长成四种不同的样子。前面三种是已经出现过的形态；最后一种，更准确地说，是我基于现有系统往前推的一个方向。

---

## 第一代 · 纯对话（2022）

第一代的形态很简单，就是两个人的对白。

```text
[system]
You are a helpful assistant.

[user]
我有个 React 项目，LoginForm 的 Submit 按钮点了偶尔没反应。

[assistant]
请贴一下相关代码，我来看看。
```

GPT 刚出来的时候，ChatGPT 做的事情也很简单：把 LLM 包成聊天界面。模型眼前的上下文里，只有两类消息：`user` 和 `assistant`。每一轮都把全部历史重新喂给模型，让它预测下一条。

对话这种形态，其实不是纯粹的交互设计选择。它更像是这套机制下自然长出来的样子。

API 层面，模型默认不跨请求保留状态。每一次调用要带什么信息，都得自己先拼好再喂进去。任务又是连续的：一个问题往往要多轮来回、多次判断、多次补充事实才能走到头。要让刚发生的新信息在下一次预测时还能被看到，最直接的办法就是接在已有文本后面，把整段再喂回去。

所以第一代的限制也很直接：事实要靠人一条一条手动复制进去。

```text
[user]
我有个 React 项目，LoginForm 的 Submit 按钮点了偶尔没反应。相关代码：

// LoginForm.tsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd]     = useState('');

  const onSubmit = useCallback(() => {
    api.login({ email, pwd });
  }, []); // deps 漏了

  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input value={pwd}   onChange={e => setPwd(e.target.value)} />
      <button type="submit">Log in</button>
    </form>
  );
}

[assistant]
useCallback 的依赖数组空了，onSubmit 捕获的是首次渲染的 email / pwd。
把 deps 改成 [email, pwd]。
```

模型读不了文件，也执行不了命令，看不到磁盘。要它分析哪段代码、哪段日志、哪个报错，都得自己先复制、再粘贴到对话框里。

这一代的状态一句话就能说清楚：上下文只有人的话和模型的话，事实从外部世界到模型，中间全靠人来中转。

---

## 第二代 · 工具接入（2023）

第二代开始，机器也接入到这条流里。

Function calling 出现之后，上下文里多了一种新消息：模型可以发起动作，动作的结果再以消息的形式追加回来。

```text
[system]
You are a coding assistant. Use the provided tools.

[tools]
read_file · edit_file · run_shell

[user]
帮我看看 LoginForm 为什么 Submit 偶尔没反应。

[assistant]
我先打开 LoginForm 看看。

<tool_use>
read_file path="src/components/LoginForm.tsx"

[tool_result]
(38 行，useCallback deps 为空)
```

这件事最值得注意的地方是：它第一次把"和外部世界交互"放进了同一条文本时间线上。

做法其实不复杂：约定一种消息格式，比如"调用工具 X，参数是 Y"。模型输出这样一段文本时，harness 认出来，执行工具，再把结果作为新消息接回上下文，然后整段继续喂给模型。

同一条时间线上于是出现了两条循环：

- 外循环：`user ↔ assistant`，人和模型的对话
- 内循环：`assistant ↔ tool`，模型自己产生、自己消费的动作和结果

完整跑起来就是这样一个 runtime：

1. 用户发出请求
2. harness 组装当前上下文并调用模型
3. 模型输出文本，或者输出一个 tool call
4. 如果是 tool call，就执行工具，把结果追加回上下文
5. 再次调用模型，直到模型不再调工具
6. 最终回复返回给用户

循环本身不复杂，几十行代码就能做出一个能跑的原型。不过从这一代开始，一件事变得明显：让 agent 跑起来的，不再只是"写一句好 prompt"，而是模型、工具、消息格式、结果回填、循环控制这一整套机制。也就是说，它更像是一个 runtime 工程，而不是一段 prompt。

这一代比较明显的变化是：事实不再由人手动粘进来，而是由模型自己通过工具去取；内循环第一次进入了时间线。

---

## 第三代 · 现代 harness（2024–2025）

到了第三代，Claude Code、Codex、Cursor Agent 这些现代 coding agent，把"对话 + 工具"这套继续做深。

它们做的事情，不是让模型多出什么新能力，而是把上下文组装本身做成了一套工程。

一次新会话开始，模型眼前看到的往往不只是对话本身，而是一个分过区的上下文：

```text
[system]
You are Claude Code, Anthropic's official CLI...
(约 4000 字)

[project / CLAUDE.md]
React 18 · Vite · TypeScript · Tailwind
pnpm dev / pnpm test · 组件放 src/components

[memory / auto-loaded]
• user_role.md — 用户是前端工程师
• feedback_testing.md — 单测用 vitest + RTL
• project_redesign.md — 正在推 v2 设计系统

[skills / catalog only]
• design-driven · code-review · claude-api
…十几条，每条一行

[tools]
Read · Edit · Write · Bash · Glob · Grep · Agent · ToolSearch · …

[user]
帮我看看 LoginForm 的 Submit 为什么偶尔没反应。
```

真正喂给模型的上下文，已经变成了这几块：

- 系统指令
- 项目常驻指令
- 跨会话记忆
- skill 目录描述
- 工具定义
- 当前对话

到了这一步，harness 的职责也就清楚了：每次调用模型之前，决定什么该常驻、什么该懒加载、什么该裁剪、什么该压缩、什么该外包。

第三代常见的几个机制，大多都在做这件事：

- CLAUDE.md：项目级的常驻指令，每次开场注入
- Auto memory：跨会话积累用户偏好、工作事实和反馈经验
- Skill 描述常驻 / 正文懒加载：几十个 skill 只放名字和一句描述，正文等触发时再展开
- Subagent：把中间步骤多的脏活交给独立上下文，只把结论回传
- Compaction：对话接近窗口上限时，把早期内容压成摘要

把这些机制放在一起看，它们其实在干两件事：裁剪上下文，以及把不同类型的信息分开。

memory 把跨会话积累提前到开场；skill 把目录和正文拆开；subagent 把过程和结论拆开；compaction 把旧细节和当前任务拆开。做法各不相同，但方向一致：不是把所有东西都塞进主对话，而是不断决定什么留下、什么折走、什么挪出去。

这些机制有一个共同的前提：对话还是主体。主会话仍然是那条主时间线，其他机制都是围着它做裁剪、压缩、分离和外包。

所以第三代的问题，不在"有没有 memory"，也不在"compaction 够不够好"，而在更深一层：

同一条消息同时要承担几种不同的用途。

1. 给用户看的表达
2. 下一轮预测的输入
3. 工具调用的发起
4. 任务状态的记录

这几件事对文本的要求本来就不一样，却被挤在同一段里。

短任务里，这种挤压还不明显。但到了长周期、多轮、工具密集的 coding agent 场景——比如要跨几天跨多个子任务持续跑——问题就出来了。30 轮之后，对后续真正有用的事实没几条。但上下文里已经塞满了文件内容、工具原始输出、解释性回复、礼貌措辞、"好的我来看看""让我再检查一下"这类过程性文本。

在这类场景里，经常出现的局面是几千 token 换几行有效事实。

第三代的边界也就在这里。

这里还得补一点：问题不只是写法，还有窗口本身的硬限制。规格这些年一直在涨。到 2026 年 4 月，OpenAI 的 GPT-5.4 约 1.05M，mini/nano 为 400K；Anthropic 的 Claude Opus 4.7 / 4.6、Sonnet 4.6 都是 1M，Sonnet 4.5 等仍是 200K；Google Gemini 也提供 1M 及以上的窗口。[^anthropic-context] [^openai-context] [^gemini-context]

但窗口涨了，"把历史全塞进去"并没有因此成为通用答案。随着 token 数增长，检索精度会下降（即所谓 context rot），无关信息的稀释也越明显——Anthropic 自己的文档里就专门讨论这一点。[^anthropic-context]

在一次会话内把一个复杂任务做完，这一代已经做得不错。但一旦把问题换成：

> 能不能跨三天、跨多个话题、跨多次 session 持续运行？

瓶颈就很明显了。对话流会快速膨胀，而膨胀出来的大部分不是高密度的状态信息。模型要在里面找到关键事实，会越来越吃力。

总体来说，第三代把"对话 + 工具"在工程上做到了一个相当成熟的位置，但一直没有换掉"对话是上下文主体"这个前提。

---

## 第四种方向 · 上下文分层（个人探索）

这部分不适合写成"业界已经在探索的第四代"，至少按目前能查到的公开资料，下不了这个结论。

公开资料里能看到一些相邻的零件：Claude Code 的 subagent 在独立 context window 中运行，只把摘要回传主会话，也支持持久 memory；OpenAI Agents SDK 也已经把 session 持久化和 conversation compaction 做成了显式能力。[^anthropic-subagents] [^anthropic-memory] [^openai-sessions]

但至少在这些公开文档里，我没看到哪家把"L1 事件流 + L0 对话"明确写成默认的主架构。所以下面这部分更准确的说法是：一个个人探索的方向。

这个方向想换掉的，正是前面那个前提。

这里不用另造一套架构。Claude Code 用久了，自然就会想把项目里那几条一直在走的脉络先看清楚，再顺着它们把上下文拆开。

跟写代码抽函数差不多：先想清楚这一层管什么、不管什么，剩下的细节就往下沉。

### 识别项目脉络

不用一上来就分 `L0 / L1`。

项目里反复出现的就那几条线：登录稳不稳、商品列表卡不卡、hooks 用得规不规范、上线有没有风险。层次不是提前画出来的，是顺着这些线长出来的。

在这种视角下，上层看到的不再是完整的对话，而是一条条沿着项目脉络排开的结构化事件：

```text
t01 · [session] run_001 · topic=login-form-stuck · turns=6 · tools=[read,grep,edit]
t02 · report    run_001 · done
                 - useCallback deps 补 [email, pwd]
                 - 本地 repro 消失
                 - risk: 其它表单可能同样漏 deps

t03 · [session] run_002 · topic=login-form-stuck · turns=9 · tools=[read,edit,test]
t04 · report    run_002 · done
                 - 加 eslint react-hooks/exhaustive-deps
                 - CI 扫出另外 3 处同样问题
                 - 全修；单测 0 错误

t05 · [session] run_003 · topic=product-list-virtual · turns=4
t06 · report    run_003 · done · risk: 图片懒加载未适配

t07 · [signal]  RUM · /products LCP 1.8s → 3.1s · regression
t08 · [session] run_004 · active · ctx=[t05..t07]
```

重点不在"格式更结构化"，而在这里：看问题的角度已经从"对话流"变成了"项目脉络"。

`LoginForm` 这一条线，上层关心的是这次 run 落下了什么结论、修了哪些地方、还有什么风险，而不是中间来回说了几句"我先看一下"。

### 确定分层

脉络识别出来之后，才轮到分层。

原则很简单：单次任务里能消化完的，就留在当前层；跨多次 run 还要反复看到的，才往上提一层。

这时候 L0 和 L1 的边界自然就出来了：

- L0 负责把事情做完
- L1 负责给这条项目脉络留下能追回去的记录

L0 不神秘，它不是某种全新的 agent 形态。说白了，L0 就是今天已经在用的那种 session run。

里面照样有 `user`、`assistant`、工具调用、来回澄清：

```text
[user]
LoginForm 改完好像还有人反馈偶尔点不动，你确认一下？

[assistant]
好，先全局扫一下其它用了 useCallback 的表单。

<tool_use>
grep "useCallback" src/components/**

[tool_result]
命中 12 处，其中 3 处 deps 数组为空

[assistant]
长期防御我加一条 eslint 规则，CI 就能拦住。

<tool_use>
edit_file · .eslintrc · react-hooks/exhaustive-deps: error

[tool_result]
applied · 另外 3 处已补全 deps
```

这段 L0 对话本身，和第二代、第三代没什么本质区别。唯一的变化是：它不再承担长期积累的职责。

跑完之后，整段 run 会被折叠成一条事件，写回上一层。L1 的某一行展开，背后对应的才是一整次完整的 L0。

从这个角度看，sub-agent 其实只是 L0 的一种特殊形态：少交互、以执行任务为主，但仍然属于同一层。

### 层间留结论，不留过程

这一步跟代码做抽象很像。关键不在多加一层叫法，而是把职责边界画清楚。

L1 只管这条项目脉络在一次 run 之后发生了什么变化；L0 才管这件事具体是怎么做出来的。

所以一条事件不是随手写一句摘要，而是一次能独立陈述的状态变化。比如：

- "用户反馈 LoginForm 仍有偶发错误"
- "run_002 完成，新增 `react-hooks/exhaustive-deps`，顺手修掉另外 3 处空 deps"
- "监控信号：`/products` 的 LCP 从 1.8s 退到 3.1s"

而下面这些就不该进 L1：

- "让我先看一下代码"
- "好的，我来处理"
- `<tool_use: read_file ...>`

它们不是状态变化，只是过程、礼貌或者中间动作。

判断标准其实就一条：离开原始上下文，这条记录还能不能独立被理解？不能的话，它就不是事件，只是对话残片。

### 按职责边界裁剪

边界清楚之后，往下派任务和往上收结果其实都是在裁剪。

L1 派给 worker 的，不是完整的事件流，而是一段投影：只裁出当前任务直接相关的那一小段背景。

比如排查 `product-list` 的性能回退时，给 worker 的不是整条项目历史，而是：

- 上一次 `product-list-virtual` 相关 run 的结论
- 涉及的文件
- 遗留的风险
- 当前监控信号

worker 结束时也一样，不把整段对话倒回来，而是由独立模型按固定 schema 抽字段：做了什么、改了哪些文件、还剩什么坑、哪些事没做完。

这一步最好和 worker 本身分开。worker 自己写总结，难免带主观色彩，也更容易遗漏风险，或者把结果说得太好看。

同一道边界，前后会各用一次：往下派时裁背景，往上收时裁结果。这里实际上是两条防线：

- 防泄漏：只有结构化报告进 L1，原始对话不进
- 防丢失：schema 强制包含 `risk`、`status`、`files` 等关键字段

这样上层拿到的是高密度的状态，而不是一整坨低密度的对话残片。

### 规模大了就再加一层

再往上还能继续叠一层。

这不是额外的需求，是工程规模变大以后自然会出现的事。

当项目从一个页面 bug，变成多个模块、多个负责人、多个版本同时演进时，关心的东西已经不是某一次 run，而是某条系统线在更长时间里的变化。

这时候才有必要把 L1 之上的内容再压成 L2：它看的不是单次 session，而是模块级、系统级、阶段性的长期状态。

需要提一下的是，L2 不是默认就该有。只有当工程规模真的上来，需要更长的时间跨度、更慢的积累速度、更高的信息密度时，才有必要继续往上叠。

这和写代码是同一个原则：函数上头是模块，模块上头是系统。规模一上来，抽象就得跟着长。每升一层，看到的细节更少，时间跨度更长，抽象密度更高。

所以它不是一张固定的架构图，只是一条原则：每一层只关心这一层该关心的东西。

机制是通用的，schema 是领域的。

---

## 第五章 · 从原则到做法

前面讲的都是原则。把这套思路落到代码上，还有几件具体的事要定。

### 长期事实放在工作区

需要长期保留的东西，都放到独立的存储里：任务表管任务，文档库管长文档，事件日志管事件，长期记忆库管跨会话事实。

会话本身会中断，会被压缩，也可能换一台机器或者换一个模型来跑。每次开新一轮，就去工作区重新拼一份上下文，不去继承上一次的对话历史。

换句话说：会话承担的是一次任务的过程，工作区承担的是跨会话的长期事实。

### 输入按需组装，不继承会话

工作区里放着两样东西：

- 一份结构化的 prompt：`goal` · `constraints` · `latestSummary` · `facts` · `artifacts` · `openQuestions`
- 一份工作日志：冗长的过程和 tool 原始输出在落日志的时候就已经被剥掉了，留下来的基本都是可陈述的结论

worker 每次拿到的，是这份 prompt 加上按需从日志里取出的片段：要参考之前某个任务的执行记录，才把那段日志拉进来，不相关的不带。

因为日志在写回工作区时就已经是去过噪的，新一轮不需要从完整会话恢复。worker 跑到步数上限就退出，把这次的结论写回日志；下一次再起一个新循环，再按需取相关段。

所以这里说的"继续"，和通常理解的 session resume 不一样。它不是把旧会话接回来，而是从工作区里按需取相关日志段，拼成新一轮的上下文。

### 长内容只放指针

事实里不直接塞长文本，统一写成 `{ url, summary }`：摘要直接给模型看，原文放在文档库里，要看细节再沿 url 展开。

设计决策文档、调研报告、长日志、监控快照都走这套。同一份原文可以被多条事实引用，不用重复占窗口。

```text
✓ { url: doc://adr-042, summary: "outbox 替直推" }
✗ 4000 字原文直接塞进事件流
```

### 总结换一个人写

worker 自己写总结容易带主观色彩，容易漏风险，也容易把结果说得比实际漂亮。所以换一个独立的模型按固定 schema 抽字段：

```text
{ done, files, risks, open }
```

`risks` 和 `open` 不允许为空，没填就卡住，不进 L1。

这里其实是两道防线：一方面，只有结构化报告进 L1，原始对话不进；另一方面，schema 强制带上风险和未完成项，避免被漏掉。

### 记忆按相关性衰减

每条事实都带一个类型标签，按不同速率衰减：

| 类型 | 含义 | 每小时衰减 |
|---|---|---|
| `identity` | 身份类事实 | 0.95（最慢） |
| `decision` | 决策 | 0.90 |
| `state` | 临时状态 | 0.75 |
| `event` | 事件 | 0.60 |
| `casual` | 随口提到 | 0.40 |

每被用到一次，就刷新一下上次活跃时间。频繁用到的一直活着，长期没人提起的自然就冷掉了。

这样判断一条事实要不要留，看的是"最近还有没有被用到"，而不是"存进来多久了"。身份、决策这类事实衰减得慢；临时状态和边角信息衰减快。

### 按 token 预算分级退让

每一轮都有固定的 token 预算。挤不下的时候不硬塞，也不一刀切裁，而是按级别降级：

- **轻度**：只裁掉任务和子 agent 的明细
- **中度**：再压缩近窗消息
- **重度**：连整段近窗消息一起丢掉

每一级放弃的东西不一样：先砍明细，再压近窗，最后才动到整段热窗口。

就算窗口再大，也没必要全部塞进去。这一层该看什么就留什么，其它东西折到工作区或者下一层去。

---

## 四代对比

| 代次 / 方向 | 上下文形态 | 新增成分 | 事实来源 | 核心做法 |
|---|---|---|---|---|
| 第一代 | 纯对话 | `user` / `assistant` | 人手动粘贴 | 人把事实搬给模型看 |
| 第二代 | 对话 + 工具循环 | `tool_use` / `tool_result` | 模型自取 | 内循环进入时间线 |
| 第三代 | 对话 + 工程化分区 | `CLAUDE.md` / memory / skill / subagent / compaction | 跨会话积累 + 项目常驻 + 自取 | 围绕对话流做信息管理 |
| 第四种方向（本文探索） | 分层：L0 对话 + L1 事件流 | 事件 schema / 层间投影 / 结构化抽取 | 对话执行 + 事件积累 | 不再把对话当作唯一主体 |

从第一代到第三代，再到这里提出的第四种方向，模型能力本身也在同步变化——更长窗口、跨轮 thinking、更细的 tool 协议。这里只看另一个维度：每次喂给模型的那段文本，每一代都是怎么拼出来的。

第一代的文本是两个人的对白。第二代多了机器和工具之间的往返。第三代开始，机器把这段文本切成常驻、懒加载、压缩、外包几个分区。第四种方向再往前推一步：把文本本身分成几层，每一层只装这一层该看的粒度。

---

## 结语

把前三代和这条新方向放在一起看，结论其实挺简单：Agent 这几年的演化，大部分不是模型能力的变化，而是上下文组织方式在变。

第一代解决的是怎么和模型说话；第二代解决的是怎么让模型通过文本去动手；第三代解决的是怎么让对话式的上下文在工程上撑得更久；第四种方向开始尝试回答一个更底层的问题：

> 既然对话天然低密度，那为什么还要让它承担长期积累？

事件流不是什么新发明，它只是把原本稀释在对话里的状态信息抽出来，重新排一下。

真正难的从来不是"做一个能压缩对话的模型调用"。难的是：

- 你的业务里，什么算一条事件？
- 哪些字段必须保留？
- 什么该折叠，什么不能折叠？
- 什么风险必须跨层上传？

机制是通用的，schema 要对着领域去做。这篇文章没有说模型能力不重要——它当然在涨，而且会继续涨。想说的只是：在 agent 的实际体验里，还有一条常被低估的工程主线，那就是我们喂给模型的这段文本怎么组织。

---

*参考系统：Claude Code 2.1 · Codex Harness · Hermes Agent · Agents SDK*

[^anthropic-subagents]: Anthropic Claude Code 文档：subagent 使用独立 context window，并“returns only the summary”。https://code.claude.com/docs/en/sub-agents
[^anthropic-memory]: Anthropic Claude Code 文档：CLAUDE.md / auto memory / subagent memory 提供跨会话记忆。https://code.claude.com/docs/en/memory ；https://code.claude.com/docs/en/sub-agents
[^openai-sessions]: OpenAI Agents SDK 文档：session 会持久化历史，并可用 compaction 自动压缩 conversation history。https://openai.github.io/openai-agents-js/guides/sessions/
[^anthropic-context]: Anthropic 官方文档：Claude Opus 4.7 / 4.6、Sonnet 4.6 为 1M context window，Sonnet 4.5 等仍为 200K；同一页面还讨论 context rot（token 增长带来的检索精度下降）及 server-side compaction、context editing 等管理策略。https://platform.claude.com/docs/en/build-with-claude/context-windows
[^openai-context]: OpenAI 官方模型对比文档：GPT-5.4 为 1,050,000 context window，GPT-5.4 mini / nano 为 400,000 context window。https://developers.openai.com/api/docs/models/compare
[^gemini-context]: Google Gemini 官方文档：many Gemini models come with 1 million or more tokens 的 long context window。https://ai.google.dev/gemini-api/docs/long-context
