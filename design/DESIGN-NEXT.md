# Agent-Worker — Next Design

日期：2026-04-25

状态：目标设计草案 / 参考材料。核心方向已通过
`design/decisions/002-adopt-workspace-event-harness-core.md` 采纳，并已推广到
`design/DESIGN.md` 与相关 package docs；本文保留更完整的探索、术语和待定问题，
不再替代当前权威设计。

## 核心理论

LLM 只基于当前输入文本预测下一步。Agent harness 的本质不是“让模型拥有记忆”，而是决定每次把什么文本放到模型眼前。

传统 agent 把长期工作压进一条对话流：user / assistant / tool 不断追加。问题是对话消息同时承担四种职责：

1. 给人看的表达。
2. 工具调用的发起与结果回填。
3. 下一轮预测的输入。
4. 任务状态与长期事实的记录。

这四种职责对文本的粒度和密度要求不同。短任务里可以混在一起；多天、多任务、多 agent 的 workspace 里会失效。对话会膨胀，工具原始输出和礼貌/过程性文本会稀释真正有用的事实，compaction 只能延后问题，不能改变“对话是上下文主体”的结构性缺陷。

下一代 workspace 的核心思想是：**让对话只留在最底层执行，让长期协作依靠几个稳定机制循环起来。**

```text
L2+  Workspace / program memory
     阶段总结、长期约束、跨 track 决策、治理状态
          ▲ roll up / bind
          │
L1   Workspace coordination context
     Event -> Context -> Capability -> Event
     读高密度事实和持续脉络，决定谁接下来能看到什么、能做什么
          ▲ extract report           │ project task packet
          │                          ▼
L0   Task execution context
     Attempt conversation + tools + local files + runtime session
     短生命周期，完成后只向上交结构化报告和 artifact pointer
```

层间只传递适合上一层阅读的文本：

- 向上：不传 worker 原始对话，不传 tool trace，只传结构化 Handoff、WorkspaceEvent、Artifact pointer。
- 向下：不传完整 workspace history，只传 task packet、相关 Track projection、相关 WorkspaceEvent、约束和证据指针。
- 横向：worker 不默认私聊；协作通过 WorkspaceEvent / Track / Handoff 暴露给同层或上层。

这份设计里的所有对象都是为了实现这几个机制，而不是并列堆概念：

1. **事实锚定**：重要变化必须落成可引用、可审计的事实，而不是停留在聊天文本里。
2. **上下文装配**：每次 agent 运行前，系统按目标和权限装配一个有限 context packet。
3. **能力边界**：agent 只能通过被授予的 capability 读写 workspace 或触发外部副作用。
4. **执行回流**：短生命周期 Attempt 结束后，只把 Handoff / Artifact / extracted facts 回流到 workspace。
5. **连续性与注意力**：系统从事实和资源中维护长期关注点，决定什么需要跟进、谁该被唤醒。
6. **委托与治理**：权力可以被委托、投票、撤销、过期，并在 capability boundary 处生效。

## 设计目标

这份目标设计把 workspace 下多 agent 协作重新收敛成一个系统性架构，解决三个重复与混淆：

1. `lead / worker` 不应和权限模型重复。
2. `Task / Attempt / Handoff` 不应和 `Track` 重复。
3. `channel / schedule / webhook / task lifecycle` 不应各自长出一套 intake 和跟进机制。

目标模型不应该先枚举功能对象，而应先找能长期稳定的机制。`Event` 勉强可以算基础原语，因为它是系统对“发生过什么”的持久锚点。其它概念不应和 Event 相提并论，它们更像解释和使用 Event 的坐标：

```text
Principal   谁在说、谁在做、谁被授权
Event       发生过什么，谁声明的，证据在哪
Resource    长内容、证据、产物、原始 trace 的可寻址载体
Context     某个 Principal 在某个时刻实际看到的文本包
Capability  某个 Principal 在某个 Context 中被允许调用的能力边界
```

这里的 Principal / Resource / Context / Capability 不是要求落库成四个同级对象；它们可以是字段、引用、构造器、校验器或运行时边界。重点是它们解释 Event 如何被读取、被使用、并继续产生后果。

一句话：**workspace 的核心循环是：把发生的事锚定为 Event，把 Event/Resource 装配成 Context，把 Context 绑定到 Capability，再让 Capability 调用产生新的 Event/Resource。**

这些名字是领域层，不是内核层：

- `Signal` 是外部输入 adapter。
- `Track` 是围绕一组 Event/Resource 形成的长期连续性视图。
- `Task / Attempt / Handoff / Artifact` 是执行 Context、runtime trace 和 Resource pointer 的领域模型。
- `DelegationContract` 是 capability delegation 的可审计记录。
- `Action` 是 capability invocation 的领域命名，不是独立调度宇宙。

设计纪律：

- 不把领域名词上升为内核原语，除非它无法用 Event 与这几个坐标解释。
- 不用封闭枚举定义业务能力；kind/type 只用于路由和展示，语义由 evidence、projection、capability rule 和 reducer 决定。
- 每新增一个对象都要回答：它是在标识 Principal、记录 Event、引用 Resource、构造 Context，还是约束 Capability？如果都不是，通常不该新增。
- 系统的强制性来自 Capability boundary 和 tool/store boundary，不来自 prompt、角色名或对象字段本身。

## 不变量

这些不变量比具体对象名更重要；后续实现如果违反它们，就是走偏。

1. 对话不是 workspace 的长期上下文主体。
2. 原始 tool output、runtime trace、channel transcript 默认不进入 L1/L2 上下文。
3. 每条 WorkspaceEvent 离开原始对话也必须独立可理解。
4. Track / Task / Contract 都不是基础原语；它们是 Context/Capability 的领域组织方式。
5. 长期脉络和短期执行必须分层：Track 维持脉络，Attempt 承载 L0 执行。
6. Attempt 结束后必须通过 Handoff / Artifact / extractor 向上投影为 WorkspaceEvent。
7. 权限不属于角色名；受保护能力调用必须通过 capability boundary / AuthorityResolver 生效。
8. schedule、webhook、channel 都只是 Signal source；internal lifecycle 由 reducer 直接产生 WorkspaceEvent，不各自拥有 orchestration 体系。
9. 读原始历史是 audit 行为，不是默认 prompt 组装策略。

## 概念归一

### AgentSpec 不是角色

`AgentSpec` 是配置里的长期成员模板。

它描述：

- runtime / model
- instructions
- env / mounts / allowed paths
- default tools
- default channels
- capability profile

它不等于一次运行中的 `worker`，也不天然拥有永久 `lead` 权力。

### Role 是上下文层次脉络，不是身份本体

agent 的角色分工本质上不是组织头衔，而是它当前被放进哪一层上下文脉络。

同一个 `AgentSpec` 可以在不同上下文层次里呈现不同工作模式：

- `workspace coordination context`：读取 Track / WorkspaceEvent / Task ledger，选择下一次 capability invocation。现有 `lead` 是这个脉络的默认装配。
- `task execution context`：围绕一个 Task Attempt 执行，读局部 task packet、文件、工具和 runtime session。现有 `worker` 是这个脉络的默认装配。
- `governance / review context`：围绕一个 DelegationContract、proposal、vote 或 acceptance decision 阅读证据并产出结构化判断。
- `observation context`：订阅 Signal / WorkspaceEvent / external source，只产生事实或告警，不直接执行工作。

因此，`coordinator / executor / reviewer / observer` 不是新的固定角色枚举，而是 context layer profile。它们由当前脉络决定：同一个 agent 可以上午在 execution context 中实现任务，下午在 review context 中投票，晚上在 coordination context 中汇总 Track。

这个设计避免把 `lead / worker` 固化成永久身份。`lead` 更准确地说是默认协调脉络的承载者；`worker` 更准确地说是一次任务执行脉络中的 agent。

### Authority 不属于 lead/worker，属于 AuthorityResolver

`lead` 是默认协调入口，但权力不应该硬编码在 lead 身上。

谁能创建 Task、派发 Attempt、批准完成、关闭 Track、代表用户做决定，应由：

```text
AuthorityResolver(direct authority + DelegationContract + workspace policy)
```

共同决定。

`DelegationContract` 不是唯一权限来源。它只是把“委托、投票、集体决策”变成可审计、可撤销、可过期的权限来源。直接权限来自 human instruction、本地 workspace policy、以及系统拥有的确定性 lifecycle reducers。

这让系统可以表达：

- human 授权 @lead 处理某个 release track
- @lead 委托某个 agent 进入 review context 批准某类 patch
- 多个 agent 投票形成 binding decision
- 授权过期或被撤销后工具调用失效

## 机制图

```text
Workspace
  ├─ Event log                 # durable facts
  ├─ Resource store             # addressable evidence, artifacts, traces, documents
  ├─ Context builder            # bounded input packets for each run
  ├─ Capability boundary        # allowed reads/writes/effects for that context
  ├─ Reducers / projectors      # deterministic state transitions and views
  └─ Runtime dispatch           # launches L0 attempts from accepted work
```

领域对象都只是这些机制的组合：

- `Signal`：raw source -> Event 的输入适配。
- `WorkspaceEvent`：可被上层长期消费的语义 Event。
- `Track`：从 Event/Resource 投影出的 continuity view。
- `Task / Attempt / Handoff / Artifact`：执行上下文、运行 trace、回流报告和资源指针。
- `DelegationContract / Vote`：capability delegation 的治理视图。
- `Action`：capability invocation 的领域名字；可以被持久化用于审计，但不是内核必须枚举的功能集合。

## Core Objects

### Signal

`Signal` 是所有输入面的统一入口。

来源包括：

- channel message
- schedule tick
- webhook / CI / monitoring
- API call
- human correction

Signal 保存相对 raw 的事实：

- `id`
- `source`
- `actor`
- `receivedAt`
- `payloadPreview`
- `rawRef`
- `candidateCorrelationKeys`
- `securityContext`

Input surface 只负责产生 Signal，不直接创建 Task、不直接唤醒特定 agent 跑业务逻辑。

内部确定性状态变化不必伪装成 Signal。Attempt terminal、contract expired、schedule due、daemon recovery 这类 runtime/lifecycle 事实可以由 reducer 直接产生 WorkspaceEvent。Signal 是外部/边界输入；WorkspaceEvent 是统一事实层。

### WorkspaceEvent

`WorkspaceEvent` 是可长期读取的事实流。

它不是 daemon `BusEvent`，也不是 tool trace。它是工作区语义层事实：

- 用户报告了某问题复发
- CI 在某 branch 失败
- 某 Task 被派入 task execution context
- 某 Attempt 完成并留下风险
- 某 watch condition 到期
- 某 DelegationContract 达成 binding decision

最小字段：

- `id`
- `kind`
- `summary`
- `createdAt`
- `actor`
- `signalRefs[]`
- `trackRefs[]`
- `taskRefs[]`
- `attemptRefs[]`
- `artifactRefs[]`
- `contractRefs[]`
- `evidenceRefs[]`

要求：离开原始上下文后仍能独立理解。长内容只放引用。

### Track

`Track` 是长期脉络的投影，不是执行单位，也不是策略容器。

适合表达：

- incident
- investigation
- feature thread
- release lane
- customer issue
- monitoring watch
- design migration

最小字段：

- `id`
- `title`
- `status`
- `owner`
- `purpose`
- `currentState`
- `openQuestions[]`
- `risks[]`
- `watchConditions[]`
- `linkedEventIds[]`
- `linkedTaskIds[]`
- `artifactRefs[]`
- `delegationRefs[]`
- `updatedByEventId`

Track 是 WorkspaceEvent 的 projection。Track 更新必须能指回导致更新的 event。

Track 只保存连续性状态和投影结果。约束不应该作为一个独立“功能对象”膨胀出来；更底层地说，capability boundary 在验证调用时可以读取 Track projection、workspace policy、contract projection 和当前事实事件。

如果某个 Track 需要 completion condition、watch rule、blocked invocation rule，它们应作为 capability / reducer 规则引用 Track，而不是让 Track 自己变成 workflow engine。

Track 对 agent 的约束力不来自“把 Track 写进 prompt，希望模型遵守”。约束力来自 workspace 的系统边界：

1. 调度边界：只有基于 Track projection 通过 capability / reducer 校验的调用会进入队列或被唤醒。
2. 上下文边界：agent 进入某层 context 时，只拿到与当前 Track / invocation 相关的投影。
3. 工具边界：受保护 mutation 必须携带 `trackId` / `taskId` / `contractId`，由 tool boundary 校验。
4. 完成边界：Attempt 结束必须经过 Handoff / Artifact / extractor；不满足 Track 的 completion condition 就不能关闭 Track 或 Task。
5. 权限边界：违反 capability 规则或缺少 AuthorityResolver 授权的副作用 fail closed。

因此 Track 是“驱动源”，不是“建议”。它通过 context packet、capability boundary、tool schema、状态转移校验和 authority enforcement 驱动 agent。

### Capability Invocation / Action

`Action` 是领域语言里对“下一步调用”的称呼。内核不需要把它设计成一套枚举式功能系统。

底层只有一个问题：当前 principal 在当前 context 下，是否拥有调用某个 capability 的权力。

调用可以来自 agent、planner、reducer、schedule 或外部 hook。它在被执行前必须绑定：

- `principal`
- `contextRef`
- `capability`
- `reasonEventRefs[]`
- `resourceRefs[]`
- `targetRefs[]`
- `preconditions[]`

如果一次调用进入验证、阻塞、等待投票或执行中，它应该被持久化为可审计 invocation record；但这只是 capability boundary 的执行记录，不是额外的核心对象模型。

常见调用包括创建 task、派发 attempt、回复 channel、安排 follow-up、更新投影、发起治理、投票、请求人工、只读调查、或 no-op。这个集合必须保持开放，不能成为内核枚举。

调用生效前必须经过 capability validation 和 authority check。

验证记录至少包含：

- `id`
- `status`
- `kind`
- `trackRefs[]` 必须指向触发它的 Track 或说明无需 Track。
- `reasonEventRefs[]` 必须指向导致它被提出的 WorkspaceEvent。
- `requiredAuthority` 必须能由 AuthorityResolver 满足。
- `declaredWrites[]` / `declaredSideEffects[]` 必须声明它会读写哪些对象或触发哪些外部副作用。
- `preconditions[]` 必须由当前 workspace state 验证。
- `blockedReason?`
- `nextUnblock?`
- `createdBy`
- `assignee?`
- `dueAt?`

未通过验证的调用不进入 runtime、不改 workspace state，只能变成 blocked / request human / governance review / readonly investigation / no-op 这类可审计结果。

受保护副作用的第一批例子：

- workspace state mutation
- task / attempt dispatch
- user-visible commitment or external reply
- external side effect
- resource / security change
- governance / contract change

read-only 和 audit-read 不进入 contract ceremony。

### Task

`Task` 是可执行工作项。

它回答：“下一步要完成什么？”

Task 不负责长期记忆，不负责 watch，不负责投票，不负责授权。它可以属于一个或多个 Track。

Task 自身仍需要足够生成 task packet 的 durable 字段：

- `goal`
- `scope`
- `acceptanceCriteria`
- `sourceEventRefs[]`
- `trackRefs[]`
- `inputHandoffRefs[]`
- `requestedArtifacts[]`
- `constraints[]`

Track 的 completion condition 管长期脉络是否可关闭；Task 的 acceptance criteria 管这一件执行工作是否完成。

### Attempt

`Attempt` 是某个 agent 进入 task execution context 后，对某个 Task 的一次执行。

它绑定：

- task
- agent spec / runtime
- worktree / cwd
- runtime session
- tool profile
- lifecycle resources

Attempt 结束后必须产生 terminal state。executor/runtime 关闭时产出 HandoffRecord 和 ArtifactRef；extractor 是唯一把执行层报告转成 semantic WorkspaceEvent 并更新 Track projection 的组件。

### Handoff

`Handoff` 是 Attempt 结束或中途交接时的结构化执行报告。

它回答：“这次执行实际做了什么，还剩什么？”

Handoff 不等于 WorkspaceEvent；它是执行层报告。Handoff 不能直接更新 Track 的最终状态；extractor 读取 Handoff、ArtifactRef、必要的 runtime trace，并输出 WorkspaceEvent / Track projection update。

### Artifact

`Artifact` 是产物引用。

它只保存指针，不承载正文：

- file
- commit
- patch
- URL
- document
- resource
- metric snapshot

### DelegationContract

`DelegationContract` 是治理对象。

它回答：“谁被委托参与或触发某类 capability invocation 的授权？”

最小字段：

- `id`
- `grantor`
- `grantees[]`
- `scope`
- `allowedCapabilities[]`
- `constraints[]`
- `decisionRule`
- `redelegation`
- `expiresAt?`
- `revokedAt?`
- `evidenceRefs[]`
- `voteRefs[]`
- `resultingEventRefs[]`

它不替代 Track 或 Task，也不直接执行 workflow。AuthorityResolver 读取 direct authority、workspace policy、DelegationContract、Vote 和 revocation/expiry event 后，给 capability validation 一个 allow/deny/needs-vote/needs-human 结果。

`Vote` 是 contract execution record：

- `id`
- `contractId`
- `voter`
- `value: approve | reject | abstain | veto`
- `evidenceRefs[]`
- `decisionSnapshotRef`
- `createdAt`

重复 vote、过期 vote、无资格 vote 都由 reducer 判定；只有 contract tools 写入的 vote 计入规则。

## 主流程

### 1. Intake

```text
channel / schedule / webhook / API
  -> Signal
  -> normalize
  -> WorkspaceEvent
  -> correlate to Track or create Track
  -> proposed capability invocation
  -> capability boundary
  -> validation + authority check
  -> execute or blocked event
```

入口不再各自分叉。channel、schedule、webhook 和 API 只是 Signal source。Internal lifecycle 事件走 reducer，直接产生 WorkspaceEvent。

### 2. Work Dispatch

```text
Track projection / planner
  -> invoke capability(create_task)
  -> capability boundary
  -> Task
  -> invoke capability(dispatch_attempt)
  -> capability boundary
  -> Attempt
  -> task execution context
  -> runtime
```

Task 创建和 dispatch 是不同动作。二者都可以受 DelegationContract 约束。

### 3. Execution Return

```text
Attempt runtime trace
  -> Handoff + Artifact
  -> extractor
  -> WorkspaceEvent
  -> Track projection update
  -> next context / capability invocation
```

task execution context 不直接更新 Track 的最终状态。它产出 Handoff / Artifact；workspace 用 extractor 更新事实层和 continuity 层。

### 4. Governance

```text
proposed protected capability invocation
  -> AuthorityResolver
  -> direct authority? yes -> execute
  -> valid DelegationContract? yes -> execute
  -> contract requires vote? collect votes
  -> decision rule satisfied -> binding WorkspaceEvent -> execute
  -> otherwise request_human / blocked
```

投票是 contract execution，不是 channel consensus。

## Prompt / Context 策略

### Workspace Coordination Context

agent 进入 workspace coordination context 时，默认读取：

- active / watching Tracks
- pending WorkspaceEvents
- pending/blocked capability invocations and Task ledger
- pending contracts / votes / Governance Inbox
- agent roster and status
- relevant artifact index

默认不读：

- raw channel history
- full daemon event stream
- tool call trace
- full worker transcript

这些只能作为 audit/read tools 按需展开。

### Task Execution Context

agent 进入 task execution context 时，默认读取 task packet：

- goal
- constraints
- acceptance criteria
- relevant Track projection
- relevant WorkspaceEvents
- input Handoff
- artifact/doc pointers
- worktree/cwd/tool profile

task execution context 不读取完整 workspace history。

### Governance / Review Context

agent 进入 governance / review context 时，默认读取：

- proposed capability invocation
- contract scope and decision rule
- evidence refs
- relevant Track / Task state
- prior votes and blockers

governance / review context 的输出必须是 structured vote / review record，不是普通 channel reply。

### ContextPacketBuilder

上下文包由系统生成，不由 agent 手写。`ContextPacketBuilder` 读取事件流、资源索引、投影视图、待处理 capability invocation、Task 和 Contract，按 context layer 生成 packet，再交给 prompt renderer。

`assemblePrompt` 的职责应逐步收敛为渲染 packet，而不是自己决定长期 workspace state 的语义。

## Enforcement Boundaries

Workspace kernel 负责存储：

- Signals
- WorkspaceEvents
- Tracks
- Tasks
- Attempts
- Handoffs
- Artifacts
- DelegationContracts

Capability boundary 负责 validation 与调用边界：

- 接收 MCP tools、reducers、agent planner 提交的 capability invocation
- 记录进入 validation 的 invocation record
- 校验 evidence refs / projection state / state preconditions / authority
- 调用 reducers 应用合法状态变化，或调用 runtime dispatch / external adapter
- 把 blocked/failed/completed 结果写成 WorkspaceEvent

Workspace MCP/tool boundary 负责 enforcement：

- protected mutations require authority check
- contract votes must be written through contract tools
- expired/revoked contracts fail closed
- redelegation cannot expand scope
- mutating tools submit typed capability invocation instead of writing stores directly

Tools declare risk, not feature semantics:

- read-only tools do not need a persisted invocation record.
- audit reads of rawRef / transcript / trace must leave audit evidence.
- low-risk local mutations may bind to Track/Task without contract ceremony.
- protected mutations and external side effects must pass capability validation.
- routine status replies can be low-risk; commitments, artifact disclosure, user-decision representation, and external notifications are protected.

Orchestrator 负责 active loop：

- feed SignalStore / pending invocations into reducers and planners
- assemble context packets
- dispatch attempts
- call extractors
- submit state-changing proposals through capability boundary

Runtime loops 只执行：

- prompt in
- tool calls
- event stream out
- usage/session local details

## 稳定性机制

稳定性目标：agent 可以推理和建议，但 workspace state 的推进必须由可验证机制约束。

### 1. Event-sourced Track projection

Track 不是 agent 任意改写的自由摘要。Track 是 WorkspaceEvent 流上的 projection。

每次 Track 更新都必须记录：

- `updatedByEventId`
- `previousStateRef`
- `projectionReason`
- `changedFields[]`
- `evidenceRefs[]`

如果 Track 状态和事件证据冲突，以事件流为准，Track 可以重算或回滚。

### 2. Deterministic reducers before LLM judgment

能确定的状态变化先由 reducer 处理，不交给模型判断：

- Attempt terminal -> append completion event
- schedule due -> append due event
- contract expired -> mark invalid
- revoked contract -> block future protected invocations
- missing completion condition -> reject close invocation

Reducers 位于 store 之上。Store 只持久化被接受的状态；合法性由 reducer / capability boundary 持有。

LLM 负责处理模糊判断：归因、拆解、下一步建议、证据解释。确定性边界由代码持有。

### 3. Capability validation

所有会改变 workspace state 的 capability invocation 都经过 validation：

- 是否引用了 Track / Event / Task 证据
- 是否满足相关 projection / workspace policy / contract constraints
- 是否违反 blocked invocation rules
- 是否满足 preconditions
- 是否拥有 authority
- 是否会把对象推进到允许的状态

失败时不执行副作用。失败结果本身可以成为 WorkspaceEvent，供后续处理。

每个 blocked protected invocation 必须给出一个解锁路径：

- `request_human`
- `governance_review`
- `readonly_investigation`
- `no_action`

并记录 reason code 与缺失的 authority/evidence/precondition。

### 4. Context packets are generated, not handwritten

agent 不自己拼关键上下文。系统从 EventLog、ResourceStore、projections、pending invocations、Task 和 Contract 生成 context packet。

这保证：

- executor 不会看到完整 workspace history 后自作主张
- reviewer 不会绕过 contract scope
- coordination context 不会退回读 channel transcript
- 每次运行都有同样的事实来源和裁剪规则

### 5. Tool schemas carry binding ids

受约束工具必须显式携带绑定 id：

- `trackId`
- `taskId`
- `attemptId`
- `invocationId`
- `contractId`

缺少绑定 id 时，工具不能靠 prompt 里的自然语言自行推断。系统可以提供 helper 做候选匹配，但最终 mutation 必须写明绑定对象。

对于 protected/external tools，缺少 invocation binding 时默认拒绝。对于 read/audit-read tools，可以不需要 invocation record，但 audit-read 必须记录 raw evidence 使用。

### 6. Fail closed on ambiguity

当系统无法判断 invocation 是否被 Track/Contract 允许时，默认不执行：

- 生成 `blocked` WorkspaceEvent
- 请求更具体的证据
- 请求 human / governance review
- 或派发只读 investigation Attempt

不要在不确定时让模型“先做了再说”。

### 7. Auditable raw history, non-default raw history

原始 channel、tool trace、runtime transcript 必须保留为审计材料，但默认不进入上层上下文。

当 agent 需要展开原文时，必须通过 audit/read tool，读出的内容应被重新抽取成 WorkspaceEvent 或 evidenceRef，而不是长期停留在 prompt 里。

## 操作界面原则

主界面应该是 Track-centered Workspace Console，而不是 chat-first UI 或 raw event log。

建议信息架构：

- 左侧：Track lanes，按 `active / watching / blocked / resolved` 展示 owner、next action、blocker、stale age。
- 中央：选中 Track 的 detail projection：headline state、why now、open questions、risks、completion conditions、linked tasks、pending/blocked invocations。
- 右侧：context drawers：channel thread、governance/votes、evidence、raw audit source。
- 顶部：Needs operator attention：blocked invocations、pending votes、failed validation、requested human input。

每条 channel message 都应显示 extraction path：

```text
Signal -> WorkspaceEvent -> Track / invocation
```

以及当前状态：ignored、correlated、replied、needs clarification、blocked。

每个 WorkspaceEvent / Track / invocation record 都应能打开 source drawer：

- rawRef
- extracted summary
- evidence refs
- extractor/version
- correction history
- promote/correct as WorkspaceEvent workflow

坏的抽取不能直接修改旧事实。修正应生成 correction WorkspaceEvent，由 reducer 更新 Track projection。

## 讨论待定问题

这些问题还不应急着实现，应该继续设计压测：

1. invocation record 的持久化边界：调用何时需要持久化？只要进入 validation 就持久化，还是只有 protected/external invocation 持久化？
2. `reply_channel` 的保护等级：普通状态回复可以 low-risk；承诺、披露 artifact、代表用户做决定、通知外部系统应是 protected。
3. `Vote` 的归属：Vote 是 DelegationContract 的子记录，还是 WorkspaceEvent 触发的 contract reducer projection？倾向：Vote 是 contract execution record，同时产生 WorkspaceEvent。
4. `Chronicle` 的去留：长期应降级为 audit/evidence surface，还是并入 WorkspaceEvent？倾向：Chronicle 不再承担 semantic state，只作为 legacy/evidence source。
5. trackless Task 是否允许：迁移期可以允许，但必须有 `tracklessReason`；目标态新 Task 应绑定 Track 或由 system reducer 明确声明无需 Track。
6. bad extraction 的修正模型：修正应追加 correction WorkspaceEvent，不应原地改历史事实；Track projection 可由 correction event 重算。
7. UI 主入口：日常操作以 Track Console 为主，还是 Invocation Inbox 为主？倾向：Track Console 为主，Needs attention / Invocation Inbox 作为全局队列。
8. Scenario walkthrough 需要补三条：channel bug report、CI failure webhook、protected release approval。

## 去重后的职责表

| Concept | Owns | Does not own |
| --- | --- | --- |
| Channel | visible communication and raw human-facing transcript | canonical work state |
| Signal | normalized intake from any source | long-term follow-up |
| WorkspaceEvent | durable semantic fact | execution details or raw logs |
| Track | continuity, watch, open questions, risks | executable work or policy by itself |
| Context packet | bounded input for one agent run | long-term memory |
| Capability boundary | authority, preconditions, and allowed side effects | business workflow by itself |
| Invocation record | validated/blocked/executing capability call | long-term continuity |
| Task | executable unit | long-running concern |
| Attempt | one runtime execution | cross-task memory |
| Handoff | structured execution report | authority or final truth by itself |
| Artifact | output pointer | content duplication |
| DelegationContract | delegated/collective authority and vote rules | task execution or all authority |
| AuthorityResolver | allow/deny/needs-vote decision for protected invocations | workspace state mutation itself |
| AgentSpec | capability template | runtime role or permanent authority |
| Workspace coordination context | chooses/proposes next invocations | inherent unlimited power |
| Task execution context | performs attempts | workspace-wide memory |
| Governance / review context | evaluates evidence and votes | task execution by default |

## Migration Shape

This target should replace the older mental model, not layer indefinitely on top of it.

Order:

1. Introduce `WorkspaceEvent` as the semantic event stream.
2. Introduce context packets so coordination, execution, governance, and observation runs stop reading raw history by default.
3. Introduce the capability boundary between tools/planners/reducers and stores/runtime dispatch.
4. Convert channel/schedule/webhook into Signal sources; emit internal lifecycle WorkspaceEvents directly through reducers.
5. Introduce `Track` as projection over events and resources; keep enforceable rules in capability/reducer boundaries, not in Track.
6. Add extractor from Attempt/Handoff/Artifact to WorkspaceEvent + Track update; do not depend on model self-terminalization alone.
7. Add DelegationContract only around protected invocations, not every action.
8. Split current `lead/worker` prompts into context-layer profiles: workspace coordination, task execution, governance/review, and observation.
9. Build the Track-centered console and Governance Inbox after invocation records exist.

Later adoption note: ADR 003 changes the broader agent model from
workspace-vs-standalone paths to `HarnessEnvironment -> AgentRuntime`.
Workspace remains the first mature harness implementation, but runtime actors
should not own long-term context/tools/policy themselves.

## Non-goals

- No blockchain or external consensus layer.
- No universal workflow engine with all decisions encoded as rules.
- No direct worker-to-worker private coordination as the main path.
- No raw transcript as default long-term context.
- No contract ceremony for low-risk local actions.
- No assumption that every future harness must be implemented as a workspace.
