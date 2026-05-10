# HTML 入口构建方案

## 概述

将 SSG 构建改为以 HTML 为 Vite 入口，使 CSS 能完整走 Vite 管道，支持 Tailwind、PostCSS 等工具。

## 动机

当前架构中，服务端组件直接从 VNode 转 HTML，CSS 用 lightningcss 单独处理，绕过了 Vite 的 CSS 管道。这导致：

- 无法使用 Tailwind（需要 PostCSS 处理 `@tailwind` 指令）
- 无法使用 CSS Modules
- 无法使用其他 PostCSS 插件

## 整体流程

```
Phase 1: SSR 渲染          Phase 2: Vite 构建
┌─────────────────┐       ┌─────────────────┐
│ VNode → HTML    │       │ HTML 入口       │
│ (带资源引用)     │  →    │ Vite 处理       │  →  最终输出
│ 输出到 .temp/   │       │ CSS/JS/Assets   │
└─────────────────┘       └─────────────────┘
```

## 详细设计

### Phase 1: 服务端渲染

渲染所有路由生成 HTML 文件，包含原始资源引用：

```html
<!-- .temp/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./components/Button.css" />
  </head>
  <body>
    <div id="app"><!-- SSR content --></div>

    <!-- Island 入口 -->
    <script type="module" src="./islands/counter-0.ts"></script>
  </body>
</html>
```

### Phase 2: Vite 构建

以所有 HTML 文件为入口，Vite 处理所有资源：

```typescript
// 动态生成的 Vite 配置
export default {
  root: ".temp",
  build: {
    outDir: "../dist",
    rollupOptions: {
      input: {
        index: ".temp/index.html",
        about: ".temp/about.html",
        "blog/post-1": ".temp/blog/post-1.html",
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
};
```

## 目录结构

### 临时目录 (Phase 1 输出)

```
.temp/
├── index.html
├── about.html
├── blog/
│   └── post-1.html
├── styles.css            # 源 CSS (复制)
├── components/
│   └── Button.css
└── islands/              # Island 入口
    ├── counter-0.ts
    └── counter-1.ts
```

### 最终输出 (Phase 2 输出)

```
dist/
├── index.html
├── about.html
├── blog/
│   └── post-1.html
└── assets/
    ├── index-[hash].css  # Vite 处理后的 CSS
    └── counter-[hash].js # Vite 打包后的 JS
```

## 实现要点

### 1. HTML 生成

```typescript
private generateBuildHTML(result: RenderResult, options: {
  css: string[];
  scripts: string[];
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.title || 'Page'}</title>
  ${options.css.map(href => `<link rel="stylesheet" href="${href}">`).join('\n  ')}
</head>
<body>
  ${result.html}
  ${options.scripts.join('\n  ')}
</body>
</html>`;
}
```

### 2. CSS 路径处理

CSS 路径需要从绝对路径转换为相对于 HTML 的路径：

```typescript
private toRelativePath(absolutePath: string, htmlPath: string): string {
  const htmlDir = dirname(join(this.config.root, htmlPath));
  return relative(htmlDir, absolutePath);
}
```

### 3. Island 入口生成

```typescript
private generateIslandEntry(island: IslandMetadata): string {
  return `
import { hydrateIsland, markIslandHydrated } from '@semajsx/ssr/client';
import * as ComponentModule from '${island.path}';

const Component = ComponentModule.default ||
  Object.values(ComponentModule).find(exp => typeof exp === 'function');

if (Component) {
  hydrateIsland('${island.id}', Component, markIslandHydrated);
}
`;
}
```

### 4. 构建主流程

```typescript
async build(options: BuildOptions = {}): Promise<BuildResult> {
  const { outDir = 'dist' } = options;
  const tempDir = join(outDir, '.temp');

  // Phase 1: 渲染 HTML
  const htmlEntries = await this.renderAllPages(tempDir);

  // 复制源文件到临时目录
  await this.copySourceFiles(tempDir);

  // 生成 island 入口
  await this.generateIslandEntries(tempDir);

  // Phase 2: Vite 构建
  await viteBuild({
    root: tempDir,
    build: {
      outDir: resolve(outDir),
      emptyOutDir: true,
      rollupOptions: {
        input: htmlEntries,
      }
    },
    ...this.config.vite,
  });

  // 清理
  await rm(tempDir, { recursive: true });
}
```

## 用户使用

```typescript
const app = createApp({
  root: import.meta.dir,

  // Vite 配置支持 Tailwind
  vite: {
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
  },
});

app.route("/", () => (
  <div class="bg-blue-500 p-4">
    {" "}
    {/* Tailwind 类名 */}
    <Style href="./styles.css" />
    <h1>Hello</h1>
  </div>
));
```

## 优势

1. **完整的 Vite CSS 管道** - Tailwind、PostCSS、CSS Modules 都能工作
2. **统一的资源处理** - 哈希、压缩、tree-shaking 由 Vite 统一处理
3. **更好的代码分割** - Vite 自动分析依赖关系
4. **标准工具链** - 用户熟悉的 Vite 配置方式

## 注意事项

1. **构建速度** - 两阶段构建可能较慢，可考虑并行优化
2. **临时文件** - 需要正确处理路径映射和清理
3. **Source Map** - 需要正确关联到源文件
4. **开发模式** - 需要单独处理 dev server 场景

## 兼容性

此方案需要修改现有的 `build()` 方法，但保持 API 兼容：

- `createApp()` 配置不变
- `app.route()` 使用不变
- `app.build()` 返回类型不变

现有的 `buildCSS()` 和 `buildAssets()` 可以移除或作为可选的后处理步骤。
