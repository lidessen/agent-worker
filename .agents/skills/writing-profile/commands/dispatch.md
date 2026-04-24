# dispatch — Smart no-argument entry point

`/writing-profile`（无参数）时触发本文件。根据 `~/.claude/writing-profile/` 下的状态决定做什么，让用户反复敲同一命令就能把整个流程走完。

## 核心行为

读 `~/.claude/writing-profile/state.md`（若无则状态 = 未开始），根据当前状态分派到下一动作。**不问用户选什么**——除非是需要显式确认的地方（retest 覆盖）。

## 决策表

| 当前状态 | 动作 |
|---------|------|
| state.md 不存在 | 走 A：**首次启动** |
| state.md 存在，某单元 `[~] in-progress` | 走 B：**接着跑那个单元** |
| state.md 存在，有 `[ ] not started` 的单元 | 走 C：**跑下一个未跑的** |
| 所有单元状态都是 `[x] completed` 或 `[-] skipped` 但 profile.md 不存在 | 走 D：**自动 finalize** |
| profile.md 存在且最新 | 走 E：**显示画像** |
| profile.md 存在但某单元后被 retest 导致失效 | 走 F：**重新 finalize** |

**关键**：`[-] skipped`（通常是 W7 因古典暴露度不足）计入"已处理"，不再出现在 C 路径的候选里，也满足 D 路径的 finalize 触发条件。比如用户被 plan 判定为低暴露，state.md 初始就是 6 个 `[ ]` + 1 个 `[-]`；全部跑完 6 个后直接进 D 自动 finalize，不会卡住。

## 各路径执行

### A. 首次启动

1. 告诉用户："开始建画像。先问 5 个元问题（约 3 分钟），再测 7 个维度（每个 ~12 题，约 30 分钟）。你可以随时中断，后续再 `/writing-profile` 就接着来。"
2. 创建目录 `~/.claude/writing-profile/` 和 `~/.claude/writing-profile/units/`
3. 读取并遵循 `references/phases/plan.md` 走 meta-intake + 生成 state.md
4. plan 完成后**不提问**直接开始 W1：读取并遵循 `references/phases/run-unit.md`（参数=W1）
5. W1 完成后，调用自己（dispatch 再判断）：展示该单元结果 + "继续下一个维度？这次 `/writing-profile` 再发就接着跑 W2"

不要在 plan → W1 之间再问用户"要不要开始"。plan 完成直接进 W1 是首次启动的应有体感。

### B. 接着跑进行中的单元

1. 识别进行中的 W#，读取 `references/phases/run-unit.md`（参数=该 W#）
2. run-unit 内部会读 session 文件从上次停止处继续
3. 单元完成后，回到本 dispatch 再判断（走 C 或 D）

### C. 跑下一个未跑的单元

1. 读 state.md 确定下一个 `[ ] not started` 的 W#（默认顺序 W1→W7）
2. 读取 `references/phases/run-unit.md`（参数=该 W#）
3. 完成后回到 dispatch

### D. 自动 finalize

1. 所有单元状态都是 `[x] completed` 或 `[-] skipped`（两者计入完成），且 profile.md 不存在
2. 读取并遵循 `references/phases/finalize.md`
3. 完成后展示类型标签与核心画像摘要，并说明完整 profile.md 已写入

**典型触发场景**：
- 高暴露用户：7 个全 `[x]` → 进 D
- 低暴露用户：6 个 `[x]` + W7 `[-]` → 进 D（不会因缺 W7 卡住）

### E. 显示画像

已有有效 profile.md，触发 `/writing-profile`：
1. 提示"画像已完成"
2. 简要展示：type 标签 + 作家谱系 + 2-3 行关键坐标
3. 提示下一步选项：`/writing-profile show` 看完整画像并解读 / `/writing-profile W<N>` 重测某维度 / `/writing-profile review <path>` 用画像审一篇文档

不要默认重跑或重 finalize。

### F. 重新 finalize（retest 后）

state.md 的某单元时间戳晚于 profile.md，或有单元标记为 `[x] completed-pending-refinalize`：

1. 提示用户："W3 已重测，需要重新合成画像"
2. 读取并遵循 `references/phases/finalize.md`（会覆盖旧 profile.md，先归档 bak）
3. 展示新画像 + 指出哪几维改变了

## 不做什么

- 不单独展示 status——那是 `show` 的事
- 不单独跑 plan 或 finalize——它们是子阶段
- 不询问用户 "要不要继续" 除非是 retest 覆盖这种破坏性操作
- 首次启动时不要先等用户确认再启 plan（用户已通过输入命令表达意愿）
- 不要在流程中自作主张调整顺序（如跳过 W4 直接跑 W5）——除非用户显式指定

## 语气

保持让用户"越简单越好"——每次 `/writing-profile` 他们知道系统会帮他们接着走。只有 `show` / `retest` / `review` 是需要显式命令的操作。
