# @semajsx/configs

Shared TypeScript configurations for the SemaJSX monorepo.

## Available Configurations

### `tsconfig.base.json`

Base TypeScript configuration with strict type checking rules. All other configurations extend from this.

**Features:**

- ES2020 target
- Strict mode enabled
- Additional safety checks (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- Code quality rules (no unused locals/parameters, no fallthrough cases)

### `tsconfig.lib.json`

Configuration for library packages that will be published to npm.

**Features:**

- Extends `tsconfig.base.json`
- Composite project setup for incremental builds
- JSX support with `react-jsx`
- Declaration file generation
- Source maps

**Usage in library packages:**

```json
{
  "extends": "@semajsx/configs/tsconfig.lib.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `tsconfig.app.json`

Configuration for application packages (like docs site).

**Features:**

- Extends `tsconfig.base.json`
- No emit (applications typically use bundlers)
- JSX support with `react-jsx`
- DOM type definitions

**Usage in applications:**

```json
{
  "extends": "@semajsx/configs/tsconfig.app.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `tsconfig.test.json`

Configuration for test files with relaxed rules.

**Features:**

- Extends `tsconfig.base.json`
- Includes test and example files
- Allows unused locals/parameters (common in tests)
- No emit (tests are not compiled)

**Usage for type checking all files:**

```json
{
  "extends": "@semajsx/configs/tsconfig.test.json"
}
```

## Package-Specific Customization

Each package can extend these base configurations and add package-specific settings:

```json
{
  "extends": "@semajsx/configs/tsconfig.lib.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@semajsx/signal": ["../signal/src/index.ts"],
      "@/*": ["./src/*"]
    }
  }
}
```

## Why Shared Configs?

1. **Consistency**: All packages use the same TypeScript rules
2. **Maintainability**: Update rules in one place
3. **DRY**: Don't repeat configuration across packages
4. **Type Safety**: Enforce strict type checking across the monorepo
