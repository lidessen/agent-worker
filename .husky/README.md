# Git Hooks

This directory contains Git hooks managed by Husky.

## Hooks

### pre-commit

- Runs `lint-staged` before each commit
- Automatically formats and lints staged files
- Ensures code quality before committing

### commit-msg

- Validates commit messages using commitlint
- Enforces Conventional Commits specification
- Ensures consistent commit message format

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes
- `revert`: Reverting changes
- `build`: Build system changes
- `ci`: CI configuration changes

### Examples

```
feat: add async component support
fix: resolve JSX type errors in tests
docs: update README with new examples
chore: migrate from tsup to tsdown
```
