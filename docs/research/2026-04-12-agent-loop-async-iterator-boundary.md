# Agent Loop 异步迭代器边界判断

日期：2026-04-12  
范围：`packages/loop`、`packages/agent`、`packages/agent-worker` 当前接口边界

## 结论摘要

`agent-worker` 不需要“把 agent loop 切换到异步迭代器模型”，因为最关键的一层其实已经是这个模型了。

当前正确的边界应该是：

- `loop.run()`：**是异步迭代器模型**
- `agent / run coordinator`：**不是异步迭代器模型，而是长期状态机**
- `daemon / event bus / SSE / WebClient stream`：**适合异步迭代器模型**

所以真正的问题不是“要不要切”，而是“异步迭代器应该停在哪一层”。

## 一、当前状态

### 1. Loop 层已经是正确的异步迭代器接口

当前 `LoopRun` 的定义已经是：

- `AsyncIterable<LoopEvent>`
- 外加 `result: Promise<LoopResult>`

见 [packages/loop/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/types.ts)。

这意味着单次 run 的语义已经明确拆成了两部分：

- 中途事件流
- 最终汇总结果

这正好匹配当前 runtime 的实际行为：

- `text`
- `thinking`
- `tool_call_start`
- `tool_call_end`
- `hook`
- 最后才有 `usage / duration / all events`

### 2. Agent 层已经按异步迭代器消费 run

`RunCoordinator` 现在的消费方式是：

1. `const run = loop.run(...)`
2. `for await (const event of run) { ... }`
3. `const loopResult = await run.result`

见 [packages/agent/src/run-coordinator.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/run-coordinator.ts)。

这说明：

- `run` 级别的流式消费路径已经建立
- `memory checkpoint`
- `live turns`
- `tool event folding`
- `history persistence`

都已经建立在异步迭代器契约上

因此，`loop` 这一层不需要再做“大改造”，当前方向是正确的。

## 二、为什么 Loop 层应该是异步迭代器

`loop` 本质上就是一个“实时事件源”。

它天然具备以下特征：

- provider 会逐步产出内容
- 中间结果对上层有价值
- 结束后还需要一个最终汇总
- provider 之间的中间事件形态并不完全一致

这种场景用 `AsyncIterable` 的优势很直接：

1. 上层可以实时消费，不必等 run 完成
2. UI、日志、memory 抽取可以边跑边更新
3. 不需要回调注册/注销风格
4. 易于适配 SSE、CLI stdout、SDK stream
5. 可以统一 Claude/Codex/Cursor/AI SDK 四类 runtime

因此：

- `LoopRun = AsyncIterable + result Promise`

应该继续保持，不建议退回事件发射器或 callback-only 接口。

## 三、为什么 Agent 层不应该整体改成 async generator

这里需要明确区分两个概念：

- `single run`
- `always-on agent lifecycle`

`Agent` 和 `RunCoordinator` 处理的不是一条简单的流，而是一个长期状态机。

当前它们承担的职责包括：

- inbox wake-up
- debounce
- shouldContinue 决策
- todo continuation
- reminder resume
- interrupt
- pause / resume
- stop / fail
- run-count / hard-cap 管理

这些都不是“顺序产出事件”可以自然表达的东西。

如果强行把整个 agent 主循环改成：

```ts
async function* agentLoop() { ... }
```

通常会带来几个问题：

1. 生命周期状态机会被流式语义混淆
2. `pause/resume/interrupt/stop` 的控制面会变复杂
3. `idle/waiting/processing/error/stopped` 这类明确状态边界会被削弱
4. 恢复逻辑和 run 级逻辑更容易缠绕

所以更合理的结构是：

- `run` 是流
- `agent` 是状态机
- `orchestrator` 是调度器

这三层不应该被统一成一个 async iterator 抽象。

## 四、现在真正需要改的不是“是否异步迭代器”，而是边界纪律

当前实现整体方向是对的，但后续仍建议收紧几条纪律。

### 1. 继续把 provider 差异封装在 Loop 层

例如：

- 哪些 provider 有 `tool_call_end`
- 哪些 provider 有 `callId`
- 哪些 provider 支持 `interrupt`
- 哪些 provider 支持 `hooks`

这些差异应该停留在：

- [packages/loop/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/loop/src/types.ts)
- 各 runtime loop 实现

不要继续泄漏到更高层语义。

### 2. 上层尽量消费 `LoopRun`，而不是扩散 callback 风格

当前 `RunCoordinator` 已经是 `for await` 风格，这很好。

后续建议：

- 新增的 run 消费逻辑尽量直接建立在 `LoopRun`
- 避免重新引入一套 `onChunk / onTool / onDone` callback API
- `onEvent` 可以保留在协调层，但不应变成主接口

### 3. 区分“流式事件”和“持久化事实”

异步迭代器适合表达运行中的事件，但不是所有事件都应该原样持久化。

建议继续保持：

- `LoopRun` 表达 provider 流
- `ManagedAgent / daemon / timeline / chronicle` 再决定如何落盘和抽象

不要让持久化模型反过来污染运行时流模型。

## 五、判断

如果问题是：

- “当前 agent-worker 是否应该把单次 loop 执行设计成异步迭代器模型？”

答案是：

- **是，而且现在基本已经这样做了。**

如果问题是：

- “是否应该把整个 agent 主循环、workspace orchestrator 也统一改写成 async iterator 风格？”

答案是：

- **不应该。**

更准确的架构判断是：

- `Loop` 负责流
- `Agent` 负责状态机
- `Orchestrator` 负责调度
- `Bus / SSE / Client stream` 负责传播流

这个边界比“全都变成异步迭代器”更稳，也更适合当前项目的 workspace-first 方向。
