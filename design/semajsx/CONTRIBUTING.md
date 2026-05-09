# Contributing to SemaJSX

Thank you for your interest in contributing to SemaJSX! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.2
- Node.js >= 18 (for some tooling)
- Git

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/semajsx.git
   cd semajsx
   ```

2. **Install Dependencies**

   ```bash
   bun install
   ```

3. **Build the Project**

   ```bash
   bun run build
   ```

4. **Run Tests**

   ```bash
   # Run all tests
   bun run test

   # Run unit tests only
   bun run test:unit

   # Run with coverage
   bun run test:coverage
   ```

## Development Workflow

### Project Structure

```
semajsx/
├── packages/        # Monorepo packages
│   ├── signal/      # Signal reactivity system
│   ├── core/        # Core runtime (VNode, helpers)
│   ├── dom/         # DOM rendering
│   ├── terminal/    # Terminal rendering
│   ├── server/      # SSR and Island architecture
│   ├── logger/      # Logging utilities
│   ├── utils/       # Shared utilities
│   ├── semajsx/     # Main umbrella package
│   └── configs/     # Shared TypeScript configurations
├── apps/            # Applications
│   └── docs/        # Documentation and design documents
└── package.json     # Root workspace configuration
```

### Running Examples

```bash
# Vite counter (DOM)
bun run example:dev

# Bun server
bun run example:bun

# Performance test
bun run example:perf

# Terminal counter
bun run example:terminal
```

### Type Checking

```bash
bun run typecheck
```

### Code Style

We use:

- **oxfmt** for formatting (30x faster than Prettier)
- **oxlint** for linting
- **TypeScript** for type safety
- **Conventional Commits** for commit messages

Code is automatically formatted on commit via Husky hooks.

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, concise code
- Follow existing code style
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run tests
bun run test:unit

# Type check
bun run typecheck

# Lint
bun run lint

# Format (automatic on commit)
bun run format
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>

# Examples:
git commit -m "feat(signal): add batch update support"
git commit -m "fix(dom): handle null children properly"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(signal): add computed signal tests"
git commit -m "refactor(runtime): simplify vnode creation"
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:

- Clear title and description
- Reference any related issues
- Screenshots/demos if applicable
- Test results

## Coding Guidelines

### TypeScript

- **Type everything** - Avoid `any`, use proper types
- **Use type inference** when obvious
- **Export types** that users may need
- **Document complex types** with JSDoc comments

### Code Organization

- **Pure functions** - Prefer pure, side-effect-free functions
- **Single responsibility** - Each module should have one clear purpose
- **Small modules** - Keep files focused and concise
- **Dependency injection** - Isolate side effects (DOM, I/O)

### Signals and Reactivity

- **Fine-grained updates** - Update only what changed
- **Automatic tracking** - Let signals track dependencies
- **Batching** - Use `batch()` for multiple updates
- **Avoid over-subscribing** - Don't create unnecessary effects

### Testing

- **Unit tests** for signal system and runtime
- **Integration tests** for rendering
- **Example apps** to verify real-world usage
- **Browser tests** for DOM-specific behavior

### Documentation

- **JSDoc comments** for public APIs
- **README updates** for new features
- **Example code** to demonstrate usage
- **CHANGELOG entries** for user-facing changes

## Pull Request Process

1. **Ensure all tests pass** and code is formatted
2. **Update documentation** if you're changing APIs
3. **Add tests** for new functionality
4. **Keep PRs focused** - one feature/fix per PR
5. **Respond to feedback** from reviewers
6. **Squash commits** if requested

## Reporting Issues

### Bug Reports

Include:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Bun version, browser)
- Code sample or repository link

### Feature Requests

Include:

- Clear use case description
- Proposed API or implementation approach
- Examples of similar features in other libraries
- Why this feature benefits SemaJSX users

## Development Tips

### Watching for Changes

```bash
# Watch build
bun run dev

# Watch tests
bun run test:unit -- --watch
```

### Debugging

- Use `console.log` with descriptive labels
- Run examples with `bun --inspect`
- Use browser DevTools for DOM debugging
- Check test output for stack traces

### Performance

- Profile with browser DevTools
- Run performance examples (`bun run example:perf`)
- Compare before/after with benchmarks
- Consider bundle size impact

## Questions?

- **Issues**: Open an issue for bugs or features
- **Discussions**: Use GitHub Discussions for questions
- **Code**: Read existing code for patterns and style

## License

By contributing to SemaJSX, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to SemaJSX! 🚀
