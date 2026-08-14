---
name: husky
description: Enterprise Husky 9.x Git hooks with pre-commit, commit-msg, pre-push, and custom hooks. Use when setting up Git hooks, running pre-commit checks, or automating Git workflows.
metadata:
  stack: husky-9
  scope: code-quality
---

# Husky Enterprise Git Hooks

## Overview

Husky is a Git hooks manager that makes it easy to configure Git hooks for your team. It runs scripts automatically when Git events occur.

**When to Use:**
- Enforcing code quality before commits
- Running tests before pushes
- Validating commit messages
- Automating Git workflows
- Team collaboration on code standards

**When NOT to Use:**
- Solo projects without Git hooks needs
- Projects with simple workflows
- Non-JavaScript projects

## Architecture Patterns

### Project Structure
```
project/
├── .husky/
│   ├── pre-commit          # Pre-commit hook
│   ├── commit-msg          # Commit message validation
│   ├── pre-push            # Pre-push checks
│   ├── prepare-commit-msg  # Prepare commit message
│   └── post-merge          # Post-merge actions
├── package.json
└── .github/
    └── workflows/
        └── ci.yml
```

## Complete Configuration

### Setup

```bash
# Install husky
npm install husky --save-dev

# Initialize husky
npx husky init

# This creates:
# - .husky/ directory
# - .husky/pre-commit (example hook)
# - package.json scripts
```

### package.json Scripts

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "husky": "^9.0.0"
  }
}
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run lint-staged
npx lint-staged

# Check for console.log
if git diff --cached --name-only | xargs grep -l "console.log" 2>/dev/null; then
  echo "❌ Found console.log statements. Please remove them."
  exit 1
fi

# Check for TODO comments
if git diff --cached --name-only | xargs grep -l "TODO" 2>/dev/null; then
  echo "⚠️  Found TODO comments. Consider creating an issue."
fi

echo "✅ Pre-commit checks passed"
```

### Commit-msg Hook

```bash
# .husky/commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "📝 Validating commit message..."

# Run commitlint
npx --no -- commitlint --edit $1

if [ $? -ne 0 ]; then
  echo "❌ Commit message validation failed"
  echo ""
  echo "Please follow conventional commits format:"
  echo "  type(scope): description"
  echo ""
  echo "Examples:"
  echo "  feat: add new feature"
  echo "  fix: resolve bug in login"
  echo "  docs: update README"
  echo ""
  echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  exit 1
fi

echo "✅ Commit message is valid"
```

### Pre-push Hook

```bash
# .husky/pre-push
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🚀 Running pre-push checks..."

# Run typecheck
echo "Running typecheck..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ Typecheck failed"
  exit 1
fi

# Run tests
echo "Running tests..."
npx vitest run
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ Pre-push checks passed"
```

### Prepare-commit-msg Hook

```bash
# .husky/prepare-commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Add branch name to commit message
BRANCH_NAME=$(git branch --show-current)

if [ "$BRANCH_NAME" != "main" ] && [ "$BRANCH_NAME" != "master" ]; then
  # Add branch name as comment
  sed -i.bak -e "1s/^/[$BRANCH_NAME] /" "$1"
fi
```

### Post-merge Hook

```bash
# .husky/post-merge
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔄 Running post-merge tasks..."

# Install dependencies if package.json changed
if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
  echo "📦 Package.json changed, installing dependencies..."
  npm install
fi

# Run database migrations if needed
if git diff --name-only HEAD@{1} HEAD | grep -q "prisma/"; then
  echo "🗄️  Database schema changed, running migrations..."
  npx prisma migrate dev
fi

echo "✅ Post-merge tasks completed"
```

## Security Hardening

### Secure Hook Scripts

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate no secrets in staged files
if git diff --cached --name-only | xargs grep -l -E "(password|secret|api[_-]?key|token)" 2>/dev/null; then
  echo "❌ Potential secrets found in staged files"
  echo "Please review and remove sensitive data"
  exit 1
fi

# Run lint-staged
npx lint-staged
```

### Prevent Secret Leaks

```bash
# .husky/commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check commit message for secrets
if grep -qE "(password|secret|api[_-]?key|token)" "$1"; then
  echo "❌ Commit message contains potential secrets"
  exit 1
fi

# Validate commit message format
npx --no -- commitlint --edit $1
```

## Performance Optimization

### Fast Hook Execution

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Only run lint-staged on staged files
npx lint-staged

# Skip hooks in CI (optional)
# if [ -n "$CI" ]; then
#   echo "CI detected, skipping hooks"
#   exit 0
# fi
```

### Parallel Execution

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run checks in parallel
(
  npx lint-staged &
  npx tsc --noEmit &
  wait
)
```

## Integration Patterns

### With lint-staged

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["biome check --write"],
    "*.{json,css,md}": ["biome format --write"]
  }
}
```

### With commitlint

```bash
# .husky/commit-msg
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
```

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
```

## Anti-Patterns

### ❌ DON'T
- Skip hooks in CI: Always run hooks
- Use slow operations in pre-commit: Keep hooks fast
- Skip commit validation: Always validate messages
- Use `--no-verify` without reason: Document exceptions
- Ignore hook failures: Fix issues before committing

### ✅ DO
- Use lint-staged for fast pre-commit checks
- Run typecheck in pre-push (slower)
- Use commitlint for message validation
- Document hook exceptions
- Test hooks regularly
- Use parallel execution for speed

## Troubleshooting

### Common Issues

**Husky Not Working**
```bash
# Reinstall husky
npx husky install

# Add prepare script
npm pkg set scripts.prepare="husky"

# Ensure hooks are executable
chmod +x .husky/*
```

**Hooks Not Running**
```bash
# Check git hooks directory
git config core.hooksPath

# Ensure hooks are executable
chmod +x .husky/pre-commit

# Test hook manually
. .husky/pre-commit
```

**Slow Hooks**
```bash
# Profile hook execution
time .husky/pre-commit

# Optimize slow operations
# Move typecheck to pre-push
# Use lint-staged for pre-commit
```

## Observability

### Hook Metrics

```bash
# Check hook execution time
time .husky/pre-commit

# Monitor hook success rate
# Add logging to hooks
echo "$(date): Pre-commit started" >> .husky.log
```

### Metrics to Track
- Hook execution time
- Hook success/failure rate
- Common hook errors
- Team adoption rate

## Production Checklist

- [ ] Husky initialized
- [ ] Pre-commit hook configured
- [ ] Commit-msg hook configured
- [ ] Pre-push hook configured
- [ ] lint-staged integrated
- [ ] commitlint integrated
- [ ] Hooks tested
- [ ] Team trained
- [ ] Documentation updated
- [ ] CI/CD pipeline configured

## CI/CD Integration

### GitHub Actions
```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npm run lint
    - run: npm run typecheck
    - run: npm run test
```

### GitLab CI
```yaml
lint:
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm run typecheck
    - npm run test
```

## Team Conventions

- **Configuration Location**: `.husky/` directory
- **Hook Scripts**: Use shell scripts
- **Performance**: Keep hooks fast (<5s)
- **Documentation**: Document exceptions
- **Testing**: Test hooks regularly
- **CI/CD**: Run same checks in CI
- **Training**: Regular team training
