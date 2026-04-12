# 装配与策略模型

日期：2026-04-12

## 目标

说明：

1. `lead / worker` 如何通过装配形成
2. 为什么 `policy` 不应只是静态配置字段
3. 为什么这些细节不应该直接暴露成用户配置 DSL
4. `profile resolver` 的职责边界

## 核心判断

这里必须明确区分两层：

- 对外配置层：粗粒度角色配置
- 对内装配层：profile / policy 机制

也就是说：

- 用户配置层只需要能区分“谁是 lead”
- 以及少量必要字段，比如 `runtime / model / instructions / channels / mounts / env`
- 不需要直接暴露 `context policy / session policy / tool profile / skill profile` 这套细粒度 DSL

更贴近当前系统的心智是：

- 默认 agent 都按 worker 处理
- 只需要额外标记哪一个 agent 是 lead

内部实现仍然可以有这些概念，但它们属于装配机制，不是用户主配置面。

## 对外配置层

外部配置层应尽量接近当前 `workspace.yml` 的风格，只暴露少量必要概念。

更合理的方向是：

- agent 的 `runtime`
- agent 的 `model`
- agent 的 `instructions`
- agent 的 `channels`
- agent 的 `mounts`
- agent 的 `env`
- workspace 级 `lead`

例如：

```yaml
lead: maintainer

agents:
  maintainer:
    runtime: codex
    instructions: |
      Coordinate the workspace and report back to the user.

  implementer:
    runtime: claude-code
    instructions: |
      Execute the assigned task and return a structured handoff.
```

如果后面需要继续加配置，优先加粗粒度声明，例如：

- `lead: <agent-name>`
- `session: persistent | task`
- `visibility: all-channels | assigned-only`

而不是一开始就暴露一个细粒度可编程 DSL。

## 对内装配层

内部仍然需要更细粒度的概念，但它们不应该成为用户直接编辑的主配置面。

建议装配层次：

### Runtime

负责执行：

- runtime type
- model
- cwd
- allowedPaths
- env
- runner

### Profile

负责角色行为：

- prompt profile
- tool profile
- skill profile
- context policy
- session policy
- history / rollup policy

### Assignment

负责当前绑定：

- `taskId`
- `attemptId`
- `worktreePath`
- `branch`
- `inputHandoffId`

## Policy 不是静态对象，而是运行期 API

`contextPolicy / sessionPolicy` 不应只是静态字段，例如：

```ts
contextPolicy: "workspace_rolling"
sessionPolicy: { lifetime: "task", resume: "handoff" }
```

这种表达会很快退化成：

- 内置枚举
- 大量 if/else
- policy 无法持有状态
- policy 无法暴露 update / checkpoint / restore / serialize 等行为

更合理的边界是：

- 对外配置层：粗粒度角色声明
- 对内装配层：`policy ref + options`
- 运行层：resolver 绑定出的 `policy handles`

这里要强调：

- `policy ref + options` 也更适合作为内部装配输入
- 而不是用户在 `workspace.yml` 里直接手写的主配置形态

## 推荐的 policy handles

### Context Policy Handle

```ts
type ContextPolicyHandle = {
  id: string;
  snapshot(): Promise<unknown>;
  update(input: unknown): Promise<void> | void;
  restore(state: unknown): Promise<void> | void;
  serialize(): Promise<unknown> | unknown;
  getPromptFragments(): Promise<string[]> | string[];
};
```

### Session Policy Handle

```ts
type SessionPolicyHandle = {
  id: string;
  start(input?: unknown): Promise<unknown>;
  checkpoint(input?: unknown): Promise<void> | void;
  shouldResume(state: unknown): Promise<boolean> | boolean;
  resume(state: unknown): Promise<void> | void;
  beforeStop(input?: unknown): Promise<void> | void;
  serialize(): Promise<unknown> | unknown;
};
```

## Profile Resolver

`profile resolver` 的职责是：

- 接收粗粒度 lead 标记与 agent 定义
- 选择对应的内部 profile / policy 组合
- 合并 runtime config 与 assignment 约束
- 产出可执行的 agent 装配结果

它不负责：

- loop 执行
- task 调度
- handoff 生成
- lead rollup 生成

## 推荐输入

```ts
type ResolveProfileInput = {
  workspace: {
    name: string;
    lead?: string;
    topology?: unknown;
    defaults?: Record<string, unknown>;
  };
  agent: {
    name: string;
    runtime: string;
    model?: string;
    instructions?: string;
    cwd?: string;
    allowedPaths?: string[];
    env?: Record<string, string>;
  };
  internalProfiles: Record<
    string,
    {
      prompt?: Record<string, unknown>;
      tools?: Record<string, unknown>;
      skills?: string[];
      context?: {
        policy: string;
        options?: Record<string, unknown>;
      };
      session?: {
        policy: string;
        options?: Record<string, unknown>;
      };
      runtimePolicy?: Record<string, unknown>;
    }
  >;
  assignment?: {
    taskId?: string;
    attemptId?: string;
    worktreePath?: string;
    branch?: string;
    inputHandoffId?: string;
  };
};
```

## 推荐输出

```ts
type ResolvedAgentAssembly = {
  runtime: {
    type: string;
    model?: string;
    cwd?: string;
    allowedPaths?: string[];
    env?: Record<string, string>;
    runner?: "host" | "sandbox";
    runtimeOptions?: Record<string, unknown>;
  };
  role: {
    name: "lead" | "worker" | string;
    resolvedProfileId: string;
  };
  policies: {
    context: ContextPolicyHandle;
    session: SessionPolicyHandle;
  };
  taskBinding?: {
    taskId?: string;
    attemptId?: string;
    inputHandoffId?: string;
  };
  promptAssembly: {
    instructions: string;
    fragments: string[];
  };
  toolAssembly: {
    allow: string[];
    deny?: string[];
    includeBuiltins: boolean;
  };
  skills: string[];
};
```

## 推荐的用户配置形状

```yaml
lead: lead-1

agents:
  lead-1:
    runtime: codex

  worker-a:
    runtime: claude-code
```

## 推荐的内部装配形状

这个层次可以继续保留细粒度 profile / policy 概念，但它属于内部实现，不是用户主配置。

例如：

- `lead -> workspace_rolling + long_lived_lead + coordination/review skill set`
- `worker -> task_session + task_scoped_worker + implementation/debugging skill set`

这里的 `lead / worker` 判定来源应优先保持简单：

- `agent.name === workspace.lead` -> `lead`
- 其余默认 -> `worker`

## 对当前代码的直接含义

可以保留的部分：

- [packages/agent/src/types.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/types.ts)
  `AgentLoop`、`LoopCapability`、`LoopInput`
- [packages/agent/src/agent.ts](/Users/lidessen/workspaces/agent-worker/packages/agent/src/agent.ts)
  `Agent` 作为通用 lifecycle shell
- [packages/agent-worker/src/loop-factory.ts](/Users/lidessen/workspaces/agent-worker/packages/agent-worker/src/loop-factory.ts)
  runtime 选择逻辑
- [packages/workspace/src/context/mcp/server.ts](/Users/lidessen/workspaces/agent-worker/packages/workspace/src/context/mcp/server.ts)
  共享工具原语

需要外移到 profile / policy 的部分：

- `instructions`
- `toolkit`
- `ContextConfig`
- `ContextSourceProvider` 选择
- memory 注入策略
- `maxRuns`
- `on_demand`
- 唤醒/恢复/退避策略
- aggressive runtime defaults
  - `permissionMode: "bypassPermissions"`
  - `fullAuto: true`

## 当前设计判断

更准确的表述应该是：

- 对外：`lead-marked config with default workers`
- 对内：`profile/policy-based assembly`

这两层不能混在一起。
