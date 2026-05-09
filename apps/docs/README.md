# SemaJSX Documentation Site

Official documentation site for SemaJSX, built with `semajsx/ssg`.

## Structure

```
apps/docs/
├── content/              # Documentation content
│   ├── reference/       # API reference pages
│   └── guides/          # Tutorial guides
├── build.tsx            # Build script
└── package.json
```

This directory contains **user-facing documentation** for SemaJSX - tutorials, guides, and API references published to the documentation website.

**Note**: For internal development documentation (RFCs, design docs, ADRs), see the [design/](../../design/) directory in the project root.

## Development

### Install Dependencies

From the repository root:

```bash
bun install
```

### Build the Site

```bash
cd apps/docs
bun run build
```

This generates static HTML in the `dist/` directory.

### Preview the Site

```bash
bun run serve
```

Open `http://localhost:4173` to preview the built site.

## Adding Documentation

### Add a Reference Page

Create a Markdown file in `content/reference/`:

```markdown
---
title: Your Title
description: Short description
order: 10
category: Category Name
---

# Your Title

Content goes here...
```

### Add a Guide

Create a Markdown file in `content/guides/`:

```markdown
---
title: Guide Title
description: What you'll learn
order: 1
difficulty: beginner
---

# Guide Title

Step-by-step instructions...
```

## MDX Components

You can use these components in your Markdown files:

### Callout

```markdown
<Callout type="info" title="Note">
Important information here
</Callout>
```

Types: `info`, `warning`, `success`, `error`, `tip`

### Tabs

```markdown
<Tabs defaultValue="bun">
<TabList>
<Tab value="bun">Bun</Tab>
<Tab value="npm">npm</Tab>
</TabList>
<TabPanel value="bun">bun add semajsx</TabPanel>
<TabPanel value="npm">npm install semajsx</TabPanel>
</Tabs>
```

### Steps

```markdown
<Steps>
<Step title="Install" number={1}>Run bun add semajsx</Step>
<Step title="Create" number={2}>Write your first component</Step>
</Steps>
```

### CodeBlock

Code blocks are automatically styled. Just use standard Markdown fenced code blocks:

````markdown
```tsx
function Example() {
  return <div>Hello!</div>;
}
```
````

## Features

- **Collections** - Type-safe content management with schema validation
- **MDX Support** - Write docs in MDX with custom components (Callout, Tabs, Steps, CodeBlock)
- **Static Generation** - Fast, SEO-friendly static HTML
- **Hot Reload** - Auto-rebuild on content changes (in watch mode)
- **Island Architecture** - Add interactive components that hydrate on the client

## Build Output

The build generates:

- Static HTML pages for all routes
- Optimized CSS and JavaScript bundles
- Island bundles for interactive components (if any)

```
dist/
├── index.html
├── reference/
│   ├── index.html
│   ├── getting-started/
│   ├── signals/
│   ├── components/
│   ├── dom-rendering/
│   ├── styling/
│   ├── tailwind/
│   ├── ssr/
│   ├── terminal/
│   ├── context/
│   └── ssg/
├── guides/
│   └── index.html
└── _assets/
```

## Deployment

Deploy the `dist/` directory to any static hosting service:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

## License

MIT
