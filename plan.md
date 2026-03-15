# Workspace Config & Data Directory Redesign

## 设计目标

统一 workspace 的配置和数据管理，支持所有场景：global、全局命名、本地文件、远程 URL、内联 YAML。

## 核心规则

1. **config.yml 可以在任何地方**——本地文件、`~/.agent-worker/workspaces/` 下、GitHub URL、内联 YAML
2. **数据默认放 `~/.agent-worker/workspace-data/<name>[--<tag>]/`**
3. **YAML 里可用 `data_dir` 字段指定自定义数据目录**（如项目本地 `./.aw`）

## 目录结构

```
~/.agent-worker/
├── daemon.json                     # daemon 进程信息
├── event-log.jsonl                 # 全局事件日志
├── secrets.json                    # 凭据
├── connections/                    # 平台连接
│   └── telegram.json
│
├── workspaces/                     # 全局 workspace 配置文件
│   ├── _global.yml                 # global workspace 配置（可选，不存在用默认值）
│   ├── monitor.yml                 # 用户创建的全局命名 workspace
│   └── ...
│
└── workspace-data/                 # 所有 workspace 运行时数据（默认位置）
    ├── _global/
    │   ├── status.json
    │   ├── channels/
    │   ├── inbox/
    │   └── docs/
    ├── monitor/
    │   └── ...
    ├── review/
    │   └── ...
    └── review--pr-123/
        └── ...
```

## 各场景对照

| 场景 | 命令 | 配置来源 | 数据目录 |
|------|------|---------|---------|
| Global workspace | daemon 启动 | `workspaces/_global.yml`（不存在用内置默认值） | `workspace-data/_global/` |
| 全局命名 | `aw create monitor` | `workspaces/monitor.yml` | `workspace-data/monitor/` |
| 本地文件 | `aw run ./review.yml` | `./review.yml` | `workspace-data/review/` |
| 本地 + tag | `aw run ./review.yml --tag pr-123` | `./review.yml` | `workspace-data/review--pr-123/` |
| 远程 URL | `aw run https://.../review.yml` | 运行时 fetch | `workspace-data/review/` |
| API 内联 | POST /workspaces | 请求体 YAML | `workspace-data/<name>/` |
| 项目级 | `aw run ./review.yml`（YAML 里 `data_dir: ./.aw`） | `./review.yml` | `./.aw/` |

## Name 推导规则

优先级从高到低：
1. YAML 内容里的 `name` 字段
2. 文件名：`review.yml` → `review`，`_global.yml` → `_global`
3. `opts.name` fallback
4. 兜底 `"global"`

## 数据目录推导规则

1. YAML 里有 `data_dir` → 用它（支持相对路径，相对于 config 文件所在目录）
2. 否则 → `~/.agent-worker/workspace-data/<name>[--<tag>]/`

## YAML Schema 变更

```yaml
# 旧字段
storage_dir: ./data        # 重命名
storage: file              # 保留

# 新字段
data_dir: ./.aw            # 替代 storage_dir，语义更清晰
```

`WorkspaceDef` 类型变更：
- `storage_dir` → `data_dir`

## 实现步骤

### Step 1: 类型和 loader 变更

**`packages/workspace/src/config/types.ts`**
- `storage_dir` 重命名为 `data_dir`
- `name` 改为可选（`name?: string`）

**`packages/workspace/src/config/loader.ts`**
- `parseWorkspaceDef`: name 不再必填
- `loadWorkspaceDef`: name 推导逻辑（YAML → 文件名 → opts.name → "global"）
- `toWorkspaceConfig`: `def.storage_dir` → `def.data_dir`

### Step 2: workspace-registry 变更

**`packages/agent-worker/src/workspace-registry.ts`**
- `ensureDefault()`:
  - 从 `~/.agent-worker/workspaces/_global.yml` 读配置
  - 数据目录: `~/.agent-worker/workspace-data/_global/`
  - 不存在则用内置默认值（`agents: { default: {} }`）
  - 发现失败降级到空 agents
- `workspaceDir()`: 路径改为 `workspace-data/<key>`
- `create()`: `storage_dir` → `data_dir`

### Step 3: CLI 变更

**`packages/agent-worker/src/cli/commands/create.ts`**
- 支持 `aw create <name>`：从 `~/.agent-worker/workspaces/<name>.yml` 查找

### Step 4: 更新测试

- `config.test.ts`: name 可选测试、`data_dir` 字段测试
- `workspace.test.ts`: 确认不破坏

### Step 5: 更新 DESIGN.md

- agent-worker/DESIGN.md 中 `storage_dir` → `data_dir` 的描述
