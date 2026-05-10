(() => {
  const TX = {
    1: {
      0: [
        { role: '[system]', cls: 'sys', body: 'You are a helpful assistant.' },
        { role: '[user]', cls: 'user', body: '我有个 React 项目,LoginForm 的 Submit 按钮点了偶尔没反应。' },
      ],
      1: [
        { role: '[system]', cls: 'sys', body: 'You are a helpful assistant.' },
        { role: '[user]', cls: 'user', body: '我有个 React 项目,LoginForm 的 Submit 按钮点了偶尔没反应。相关代码:' },
        {
          role: '',
          cls: 'user',
          body: '// LoginForm.tsx\nfunction LoginForm() {\n  const [email, setEmail] = useState(\'\');\n  const [pwd, setPwd]     = useState(\'\');\n\n  const onSubmit = useCallback(() => {\n    api.login({ email, pwd });\n  }, []); // ← deps 漏了\n\n  return (\n    <form onSubmit={onSubmit}>\n      <input value={email} onChange={e => setEmail(e.target.value)} />\n      <input value={pwd}   onChange={e => setPwd(e.target.value)} />\n      <button type="submit">Log in</button>\n    </form>\n  );\n}',
          bodyClass: 'code',
        },
        { role: '[assistant]', cls: 'asst', body: 'useCallback 的依赖数组空了,onSubmit 捕获的是首次渲染的 email / pwd——你输入的最新值它看不到。把 deps 改成 [email, pwd]。' },
      ],
    },
    2: {
      0: [
        { role: '[system]', cls: 'sys', body: 'You are a coding assistant. Use the provided tools.' },
        { role: '[tools]', cls: 'tools', body: 'read_file · edit_file · run_shell' },
        { role: '[user]', cls: 'user', body: '帮我看看 LoginForm 为什么 Submit 偶尔没反应。' },
        { role: '[assistant]', cls: 'asst', body: '我先打开 LoginForm 看看。' },
        { role: '<tool_use>', cls: 'tool', body: 'read_file path="src/components/LoginForm.tsx"' },
        { role: '[tool_result]', cls: 'res', body: '(38 行,useCallback deps 为空)', bodyClass: 'dim' },
      ],
      1: [
        { role: '[system]', cls: 'sys', body: 'You are a coding assistant. Use the provided tools.' },
        { role: '[tools]', cls: 'tools', body: 'read_file · edit_file · run_shell' },
        { role: '[user]', cls: 'user', body: '帮我看看 LoginForm 为什么 Submit 偶尔没反应。' },
        { role: '[assistant]', cls: 'asst', body: '我先打开 LoginForm 看看。' },
        { role: '<tool_use>', cls: 'tool', body: 'read_file path="src/components/LoginForm.tsx"' },
        { role: '[tool_result]', cls: 'res', body: '(38 行,useCallback deps 为空)', bodyClass: 'dim' },
        { role: '[assistant]', cls: 'asst', body: 'deps 空了导致 stale closure。我改一下。' },
        { role: '<tool_use>', cls: 'tool', body: 'edit_file path="src/components/LoginForm.tsx" diff="..."' },
        { role: '[tool_result]', cls: 'res', body: 'applied · eslint-react-hooks/exhaustive-deps pass' },
        { role: '[assistant]', cls: 'asst', body: '跑一下单测。' },
        { role: '<tool_use>', cls: 'tool', body: 'run_shell cmd="pnpm test LoginForm"' },
        { role: '[tool_result]', cls: 'res', body: '✓ 6 passed' },
      ],
    },
  };

  const GEN3_BASE = [
    {
      head: 'SYSTEM',
      lines: [
        { role: '[system]', cls: 'sys', body: 'You are Claude Code, Anthropic\'s official CLI...\n(约 4000 字)', bodyClass: 'dim' },
      ],
    },
    {
      head: 'PROJECT · CLAUDE.md',
      lines: [
        { role: '[project]', cls: 'proj', body: 'React 18 · Vite · TypeScript · Tailwind\npnpm dev / pnpm test · 组件放 src/components', bodyClass: 'dim' },
      ],
    },
    {
      head: 'MEMORY · auto-loaded',
      lines: [
        { role: '[memory]', cls: 'mem', body: '• user_role.md — 用户是前端工程师\n• feedback_testing.md — 单测用 vitest + RTL\n• project_redesign.md — 正在推 v2 设计系统' },
      ],
    },
    {
      head: 'SKILLS · catalog only',
      lines: [
        { role: '[skills]', cls: 'skill', body: '• design-driven · code-review · claude-api\n…十几条,每条一行' },
      ],
    },
    {
      head: 'TOOLS',
      lines: [
        { role: '[tools]', cls: 'tools', body: 'Read · Edit · Write · Bash · Glob · Grep · Agent · ToolSearch · …' },
      ],
    },
  ];

  const GEN3_STEPS = {
    0: [
      ...GEN3_BASE,
      {
        head: 'CONVERSATION',
        lines: [
          { role: '[user]', cls: 'user', body: '帮我看看 LoginForm 的 Submit 为什么偶尔没反应。' },
        ],
      },
    ],
    1: [
      ...GEN3_BASE,
      {
        head: 'CONVERSATION',
        lines: [
          { role: '[user]', cls: 'user', body: '帮我看看 LoginForm 的 Submit 为什么偶尔没反应。' },
          { role: '<tool_use>', cls: 'tool', body: 'Grep pattern="LoginForm"' },
          { role: '[result]', cls: 'res', body: 'src/components/LoginForm.tsx:1' },
        ],
      },
    ],
    2: [
      ...GEN3_BASE,
      {
        head: 'COMPACTED · 前 20 轮摘要',
        compacted: true,
        lines: [
          { role: '[summary]', cls: 'compact', body: 'LoginForm 卡住: useCallback deps 漏了导致 stale closure; 已补 [email, pwd]。后续切到商品列表虚拟滚动。' },
        ],
      },
      {
        head: 'CONVERSATION · current',
        lines: [
          { role: '[user]', cls: 'user', body: '那下一个: 商品列表滚动卡,加个虚拟滚动。' },
          { role: '[assistant]', cls: 'asst', body: '好的,我先看一下 ProductList 现在怎么渲染的。' },
        ],
      },
    ],
    3: [
      ...GEN3_BASE,
      {
        head: 'COMPACTED · 前 20 轮摘要',
        compacted: true,
        lines: [
          { role: '[summary]', cls: 'compact', body: 'LoginForm 卡住: deps 漏了导致 stale closure; 已补。后续切到虚拟滚动。', bodyClass: 'dim' },
        ],
      },
      {
        head: 'CONVERSATION · current',
        lines: [
          { role: '[user]', cls: 'user', body: '那下一个: 商品列表滚动卡,加个虚拟滚动。' },
          { role: '<tool_use>', cls: 'tool', body: 'Read src/components/ProductList.tsx' },
          { role: '[result]', cls: 'res', body: '(180 行)' },
          { role: '[user]', cls: 'user', body: '对了前面 LoginForm 改完后还是有人说偶尔点不动。' },
          { role: '[assistant]', cls: 'asst', body: '让我翻一下之前的上下文...\n(compaction 已把细节压掉)', bodyClass: 'dim' },
        ],
      },
    ],
  };

  const GEN4_EVENTS = [
    { t: 't01', role: '[session]', cls: 'event', body: 'run_001 · topic=login-form-stuck · turns=6 · tools=[read,grep,edit]' },
    { t: 't02', role: 'report', cls: 'worker', body: 'run_001 · done\n- useCallback deps 补 [email, pwd]\n- 本地 repro 消失\n- risk: 其它表单可能同样漏 deps' },
    { t: 't03', role: '[session]', cls: 'event', body: 'run_002 · topic=login-form-stuck · turns=9 · tools=[read,edit,test]' },
    { t: 't04', role: 'report', cls: 'worker', body: 'run_002 · done\n- 加 eslint react-hooks/exhaustive-deps\n- CI 扫出另外 3 处同样问题\n- 全修; 单测 0 错误' },
    { t: 't05', role: '[session]', cls: 'event', body: 'run_003 · topic=product-list-virtual · turns=4' },
    { t: 't06', role: 'report', cls: 'worker', body: 'run_003 · done · risk: 图片懒加载未适配' },
    { t: 't07', role: '[signal]', cls: 'event', body: 'RUM · /products LCP 1.8s → 3.1s · regression' },
    { t: 't08', role: '[session]', cls: 'event', body: 'run_004 · active · ctx=[t05..t07]' },
  ];

  const GEN4_L2 = [
    { role: '[module]', cls: 'compact', body: 'forms-stability · 已解决 · 2 runs · 合并入 release-notes' },
    { role: '[module]', cls: 'compact', body: 'product-list-perf · 进行中 · 1 done + 1 active · risk open' },
  ];

  const GEN4_SESSION = [
    { role: 'user', cls: 'user', body: 'LoginForm 改完好像还有人反馈偶尔点不动,你确认一下?' },
    { role: 'assistant', cls: 'asst', body: '好,先全局扫一下其它用了 useCallback 的表单。' },
    { role: 'tool_use', cls: 'tool', body: 'grep "useCallback" src/components/**' },
    { role: 'tool_result', cls: 'res', body: '命中 12 处 · 其中 3 处 deps 数组为空' },
    { role: 'assistant', cls: 'asst', body: '长期防御我加一条 eslint 规则,CI 就能拦住。' },
    { role: 'tool_use', cls: 'tool', body: 'edit_file · .eslintrc · react-hooks/exhaustive-deps: error' },
    { role: 'tool_result', cls: 'res', body: 'applied · 另外 3 处已补全 deps' },
    { role: 'user', cls: 'user', body: '👌 收工' },
  ];

  const GEN4_ASIDE = {
    tag: '可选 · sub-agent',
    body: '另一种 L0 run:少交互、只执行任务——比如 "跑一轮 Lighthouse 并回报分数"。不是默认形态。',
  };

  const GEN5_PARTITIONS = [
    {
      key: 'workspace',
      head: 'WORKSPACE · 持久事实',
      lines: [
        { role: 'taskboard', cls: 'event', body: 'task://login-form-stuck · open · 2 sub-runs' },
        { role: 'docstore', cls: 'proj', body: 'doc://adr-042 · doc://rum-0420 · doc://design-v2 · …' },
        { role: 'activitylog', cls: 'worker', body: '24 entries 跨 3 sessions' },
        { role: 'memory', cls: 'mem', body: '1312 facts · 84 active' },
      ],
    },
    {
      key: 'packet',
      head: 'WORKER PACKET · 每次 run 重建',
      lines: [
        { role: 'goal', cls: 'asst', body: '修 LoginForm 偶发失效 + 全项目扫一遍相似 bug' },
        { role: 'constraints', cls: 'sys', body: '保持向后兼容 · 单测不能变红' },
        { role: 'latestSummary', cls: 'compact', body: 'run_002 · eslint 规则已加 · 3 处空 deps 已补' },
        { role: 'facts', cls: 'mem', body: '[3 条 · 均为 { url, summary } 指针]' },
        { role: 'openQuestions', cls: 'event', body: '图片懒加载适配?' },
      ],
    },
    {
      key: 'pointer',
      head: 'FACTS · 指针而非原文',
      lines: [
        { role: '✓', cls: 'asst', body: '{ url: doc://adr-042, summary: "改用 outbox 替直推" }' },
        { role: '✓', cls: 'asst', body: '{ url: doc://rum-0420, summary: "/products LCP 1.8s → 3.1s" }' },
        { role: '✗', cls: 'tool', body: '{ text: "## ADR-042: ... (4000 字 ADR 原文) ..." }' },
      ],
    },
    {
      key: 'report',
      head: 'REPORT · 独立模型按 schema 抽',
      lines: [
        { role: 'schema', cls: 'sys', body: 'done · files · risks · open  (required)' },
        { role: 'done', cls: 'asst', body: '加 eslint react-hooks/exhaustive-deps' },
        { role: 'files', cls: 'worker', body: '.eslintrc · LoginForm.tsx · SignupForm.tsx · ProfileForm.tsx' },
        { role: 'risks', cls: 'tool', body: '未触及的老组件仍可能漏 deps' },
        { role: 'open', cls: 'event', body: '(none — 全部修完)' },
      ],
    },
    {
      key: 'memory',
      head: 'MEMORY · 按 kind 衰减',
      lines: [
        { role: 'identity', cls: 'asst', body: '0.95/h · ~13h 半衰 · "Alice is a PM on Platform"' },
        { role: 'decision', cls: 'mem', body: '0.90/h · ~6.6h · "我们选 outbox,不直推"' },
        { role: 'state', cls: 'compact', body: '0.75/h · ~2.4h · "deploy 进行中"' },
        { role: 'event', cls: 'worker', body: '0.60/h · ~1.4h · "build #42 在 3pm 挂了"' },
        { role: 'casual', cls: 'res', body: '0.40/h · ~0.8h · "Alice 偏好 vitest"' },
      ],
    },
    {
      key: 'budget',
      head: 'BUDGET · 分级压缩',
      lines: [
        { role: 'used', cls: 'compact', body: '[████████████░░░░] 142k / 200k · 当前 micro' },
        { role: 'micro', cls: 'sys', body: '裁 task / agent 细节' },
        { role: 'aggressive', cls: 'tool', body: '压缩消息预览' },
        { role: 'full', cls: 'event', body: '丢整段热窗口' },
      ],
    },
  ];

  const GEN5_STEP_TO_KEY = ['workspace', 'packet', 'pointer', 'report', 'memory', 'budget'];

  window.AGENT_EVOLUTION_DATA = {
    TX,
    GEN3_STEPS,
    GEN4_EVENTS,
    GEN4_L2,
    GEN4_SESSION,
    GEN4_ASIDE,
    GEN5_PARTITIONS,
    GEN5_STEP_TO_KEY,
  };
})();
