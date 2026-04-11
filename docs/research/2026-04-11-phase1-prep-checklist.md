# Phase 1 前置准备清单

日期：2026-04-11

这份清单只关注 `workspace state / handoff / event taxonomy` 落地之前必须先收口的基础问题。
目标不是继续扩功能，而是减少下一阶段改动时的结构性返工。

## 已完成的正骨

- 失败路径不再被成功路径吞掉，失败时不会错误 `ack` inbox。
- `paused / stopped` 状态不会再被统一写回 `idle` 覆盖。
- workspace 恢复顺序已经改成先 `load` 持久化状态，再注册 agent。
- daemon 事件日志不再在启动时清空。
- task workspace 的完成判定已经从“loop 停止”改成“工作耗尽”。
- loop 启动时会重新排回 `seen -> pending`，恢复未完成工作。
- daemon overview event 已去掉 prompt/tool 级 debug 细节。
- per-run log 默认不再落完整 prompt，只保留摘要元数据。

## 进入 Phase 1 之前仍建议先收的债

### 1. Prompt 装载仍然是 `history / inbox / todo` 驱动

当前 `packages/agent/src/context-engine.ts` 仍然默认把：

- `inbox`
- `todos`
- `notes`
- `history`

当成主上下文来源。

这本身没错，但意味着一旦开始引入 `work item / handoff / artifact`，
prompt 装载层会马上面临一次边界重排。

建议：

- 先定义一个新的“工作状态切片”输入接口
- 不急着替换实现，只先把读取边界从 `history-first` 改成可插拔

### 2. workspace 级结构化状态目前不可直接检查

现在能直接看的主要是：

- channel
- inbox
- timeline
- chronicle

但后续一旦引入 `work item / attempt / handoff`，如果没有统一读接口，
调试和测试会很痛苦。

建议：

- 先约定 workspace-state 的存储目录和命名
- 先约定最小 read API / test helper
- 不急着暴露给 agent tools

### 3. daemon event、workspace timeline、chronicle 仍有语义重叠

当前系统里至少有三层“日志”：

- daemon event log
- per-agent timeline
- chronicle

但这三层各自承担什么，边界还不够硬。

当前已收口到：

- daemon bus：保留 workspace/agent 级概览事件
- timeline：保留 agent/runtime 事实
- chronicle：仍是人类叙事层
- `WorkspaceOverviewEventType` 已在实现中显式列出 daemon bus 白名单

但 taxonomy 还没有正式写成统一约束。

建议：

- 在 Phase 1 前先固定 taxonomy 归属
- `workspace state event` 不要再混进 daemon overview event
- chronicle 明确保持“人类叙事层”

### 4. per-run log 仍会保存完整 prompt

这个问题已经收口为默认只保留 prompt 摘要元数据，
不再直接落完整 prompt。

后续还要决定的是：

- 是否需要显式 debug 模式重新开启完整 prompt trace
- 该模式的权限和保留周期如何定义

### 5. 设计文档与恢复实现必须继续保持同步

这次已经修正了 `markRunStart()` 的设计描述，
但这类 drift 以后还会频繁出现。

建议：

- 每次改恢复/状态语义时，同步更新 `packages/workspace/DESIGN.md`
- 不要等到 Phase 1 开始后再回补基础文档

## 建议顺序

1. 固定 state storage/read 边界
2. 收敛日志分层
3. 处理 per-run prompt logging 策略
4. 再进入 `WorkItem / WorkAttempt / Handoff` 落地

## 判断

如果这些准备工作不先做，Phase 1 很容易变成：

- 一边加对象
- 一边改 prompt
- 一边修调试接口
- 一边补日志语义

那就不是“workspace-first state model 落地”，而是一次并行重构。

先收这批债，下一步再引入结构化工作状态，风险会低很多。
