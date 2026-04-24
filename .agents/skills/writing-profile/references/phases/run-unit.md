# run-unit — Run one dimension unit (first-time / resume / retest)

本文件由 `/writing-profile <WN>`（例如 `/writing-profile W3`）触发，或被 `commands/dispatch.md` 内部调用。

每次调用只跑一个维度，context 保持窄。

## 起手判断：该维度的当前状态

读 `~/.claude/writing-profile/state.md` 中指定 W# 的状态：

| 状态 | 处理 |
|------|------|
| `[ ] not started` | **首次测**路径 |
| `[~] in-progress` | **继续**路径（从 session 未答位置接着跑） |
| `[x] completed` | **Retest** 路径——先二次确认再跑 |
| `[?] low-confidence` | 当 completed 处理，默认建议重测但仍需确认 |
| `[-] skipped` | **Skipped-override** 路径（仅条件维度可能命中，几乎总是 W7） |

### Skipped-override 路径（`[-] skipped`）

当用户显式 `/writing-profile W7` 而 W7 在 plan 阶段已被判定暴露度不足、标为 `[-] skipped`：

1. 告知用户当前 skip 原因："W7 在 plan 阶段因古典暴露度低被跳过（`classical_exposure: low`）。profile 里 C_V 记为 null、副字按 V 侧取。"
2. 询问是否确认 override（需显式"是/继续"）：

   > 你是否想推翻这个判断、现在跑 W7？
   > - 若古典接触度**确实**提升了（例如最近读了很多古典），可以跑
   > - 若只是好奇想看看，**不建议**——W7 在暴露不足时测到的可能只是"没感觉"，不构成稳定偏好

3. 用户确认 override：
   - state.md 里 W7 从 `[-] skipped` 改为 `[~] in-progress`
   - state.md 里 `classical_exposure` 升级为 `medium`（因为用户主动认为够了）
   - 若 profile.md 存在，标 `profile_stale: true`
   - 走 W7 路径 C（degraded 6 题）或路径 A（视用户补充的暴露度自陈）
4. 用户不确认：保留 `[-] skipped` 不动，退出，不动任何文件。

**默认姿态是拒绝而非允许**——用户已经在 plan 阶段自陈暴露度低；直接跑 W7 极可能只是测到噪声。

如果 `~/.claude/writing-profile/state.md` 本身不存在，说明用户还没跑过 plan——此时告诉用户 "建议用 `/writing-profile`（不带参数）从头开始，系统会自动走 plan → 跑维度 → 合成画像"。**不要**自己单独跑 plan。

## Retest 的显式确认流程

当用户显式 `/writing-profile W3` 而 W3 已是 `[x] completed`：

1. 展示当前 W3 的结果摘要（例如 "W3 之前测得 I (-5, high confidence)"）
2. 明确提示：

   > ⚠️ Retest W3 将覆盖旧结果。若 profile.md 已 finalize，会被标记为 stale——需要重测完后自动重新 finalize。确定要重测吗？

3. 用户确认后：
   - 归档旧 unit 文件到 `units/W3-<timestamp>.md.bak`
   - 清空 `units/W3.md` 内容，重开 session
   - state.md 里 W3 改为 `[~] in-progress (retest)`
   - 若 profile.md 存在，在 state.md 里加 `profile_stale: true`
4. 进入正常的**首次测**流程（12 题）
5. 完成后回到 dispatch 层。dispatch 看到 `profile_stale: true` 就走路径 F 自动重 finalize

用户不确认 → 取消，提示"保留现有 W3 结果，无操作"。

## 一、首次测 / 继续测 的具体流程

### 1. 加载方法论与 session

- 读 `references/dimensions/<WN>-*.md` — 该维度方法论
- 读 `~/.claude/writing-profile/state.md` — 确认 calibration flags
- 读 / 创建 `~/.claude/writing-profile/units/<WN>.md`（不存在则用 `assets/unit-template.md` 模板）

**不加载其他维度的方法论文件。** 保持 context 窄。

### 2. Brief intro

新单元起跑时告诉用户：
- 这是哪个维度（名字，不讲理论）
- 大约多少题（~12，可能提前停）
- "跳过"任一题记弱信号，"够了"可随时停

Resume 时更短：直接说"接着 W3 第 N 题"。

### 3. 出题与答题

- 按该维度方法论生成题目：**不用固定题库**，按 `references/excerpt-strategy.md` 的策略即兴选段
- 每题匿名先评再揭作者（防声望偏差）
- A/B 对比题必须强制选择，不接受"都不错"
- 1-5 评分题允许中间分（3 = 无感，有效数据）
- 一次只问一题，不批量
- 每题记录 verbatim 到 `units/<WN>.md`：

  ```
  ### Q<n>
  Type: ...
  Generated from: ...
  Asked: ...
  Attribution revealed: ...
  Answer: ...
  Signal: ... 
  Running score: ...
  ```

### 4. 每题后查停止条件

按 `references/signal-interpretation.md`：
- **User stop**："够了"/"stop" → 保存 in-progress，退出，不 finalize
- **High confidence early stop**：|score| ≥ 6 + reverse-key 一致 + 连续 3 题同向 → 停
- **Flexible-type stop**：10+ 题 + 分数在 ±2 震荡 → 标 flexible 停
- **Hard cap**：15 题必停

### 5. 单元完成

在 `units/<WN>.md` 末尾追加 Result 块：

```
## Result
Status: completed
Final score: <dim>=<value>
Direction: <letter>
Confidence: high | medium | low
Reverse-key check: passed | ...
Strongest signals: Q#, Q#, Q#
Note: ...
```

更新 `state.md`：
- 该维度标 `[x] completed` + 分数摘要
- Last updated 时间戳
- **若是 retest 且 profile.md 存在：标 `profile_stale: true`**

展示给用户：
- 该维度结果 + 1 行解读
- 若被 dispatch 调用：dispatch 会自动接下一维度或 finalize
- 若用户直接 `/writing-profile W3` 调用：
  - 首次测完：提示"下一维度 `/writing-profile` 继续"
  - Retest 完：提示"将自动重新 finalize，执行 `/writing-profile`"

## 二、继续进行中

和首次测基本一样，但：
- 读 session.md，从最后一个 Q 开始递增
- 开场只说 "接着 W3 第 N 题" 不做完整介绍
- 沿用同一 session 的 running score

## 需要避免的

- **Retest 不做确认直接覆盖**——必须二次确认
- **发表前泄露作者身份**——会污染评分
- **向用户展示 running score**——会偏置后续答案
- **一次跑多个维度**——每次调用一个维度就好，dispatch 负责串联
- **忘记更新 profile_stale**——retest 后不标这个，dispatch 走不到 F 路径
- **单独跑 plan**——plan 是子阶段，只由 dispatch 在首次启动时调用

## 用户中途打断

session 文件是真相。下次 `/writing-profile`（通过 dispatch 找进行中的 W#）或 `/writing-profile W<N>`（直接指定）就会接着从未记录的 Q 开始。不要重问已答过的题。
